/**
 * Local fork proof. Spawns anvil against each catalog RPC, deploys the stack,
 * creates a pump token, buys through graduation, and mints through a mock Wormhole core.
 *
 * Refuses any RPC that is not 127.0.0.1. Does not broadcast. Does not write deployments/.
 *
 *   pnpm dry-run:forks
 *   DRY_RUN_NETWORKS=sepolia,base pnpm dry-run:forks
 *
 * The signer is a random key funded with anvil_setBalance on 127.0.0.1 only.
 */
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { CANONICAL_DEX } from "../../../frontend/src/lib/canonicalDex";
import { NETWORKS, type NetworkSpec } from "./networkCatalog";
import { deployContract, deployGoonforge } from "./deployStack";
import { NICK_DEPLOYER, NICK_RUNTIME } from "./uniswapV2Bytecode";

const PORT = 18545;
const RPC = `http://127.0.0.1:${PORT}`;
const DEAD = "0x000000000000000000000000000000000000dEaD";

function loadAbi(rel: string): ethers.InterfaceAbi {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", rel), "utf8"));
  return json.abi;
}

interface ForkResult {
  network: string;
  chainId: number;
  ok: boolean;
  graduated?: boolean;
  dexRouter?: string;
  lpBurned?: boolean;
  wormholeCoreHasCode?: boolean;
  bridgeMinted?: boolean;
  error?: string;
  seconds: number;
}

function selectedNetworks(): NetworkSpec[] {
  const filter = process.env.DRY_RUN_NETWORKS?.split(",").map((s) => s.trim()).filter(Boolean);
  return NETWORKS.filter((spec) => {
    if (spec.unavailable) return false;
    if (filter && !filter.includes(spec.name)) return false;
    return true;
  });
}

function assertLoopback(url: string): void {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to send transactions to ${host}`);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`fork exercise timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForChain(expected: number): Promise<void> {
  const start = Date.now();
  let last = "no response";
  while (Date.now() - start < 90_000) {
    const provider = new ethers.JsonRpcProvider(RPC);
    try {
      const net = await provider.getNetwork();
      if (Number(net.chainId) === expected) return;
      last = `chain ${net.chainId}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    } finally {
      provider.destroy();
    }
    await sleep(500);
  }
  throw new Error(`anvil did not serve chain ${expected}: ${last}`);
}

function usesLocalChain(spec: NetworkSpec): boolean {
  // BSC testnet's public node is missing trie nodes, so a fork never mines the launch.
  return spec.testnetDex || spec.name === "bscTestnet";
}

function startAnvil(spec: NetworkSpec): ChildProcess {
  const log = fs.openSync(`/tmp/anvil-${spec.name}.log`, "w");
  // Local chains avoid fork RPCs that answer eth_getCode from upstream and hide
  // contracts anvil just created, or that cannot serve archive trie nodes.
  const args = usesLocalChain(spec)
    ? ["--chain-id", String(spec.chainId)]
    : [
        "--fork-url",
        spec.rpc,
        "--fork-state-by-number",
        "--chain-id",
        String(spec.chainId),
        "--timeout",
        "20000",
        "--retries",
        "2",
      ];
  args.push(
    "--port",
    String(PORT),
    "--host",
    "127.0.0.1",
    "--accounts",
    "1",
    "--balance",
    "10000",
    "--gas-limit",
    "60000000"
  );
  const child = spawn("anvil", args, { stdio: ["ignore", log, log], detached: true });
  return child;
}

async function fetchCode(rpc: string, address: string): Promise<string> {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  const body = (await response.json()) as { result?: string; error?: { message?: string } };
  if (!body.result || body.result === "0x") {
    throw new Error(body.error?.message || `no code for ${address} on ${rpc}`);
  }
  return body.result;
}

function stopAnvil(child: ChildProcess): void {
  try {
    if (child.pid) process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function bridgePayload(recipient: string, amount: bigint, targetChainId: number, nonce: bigint): string {
  const payload = ethers.concat([
    ethers.hexlify(ethers.randomBytes(32)),
    ethers.hexlify(ethers.randomBytes(32)),
    ethers.getBytes(recipient),
    "0x000000000000000000000000",
    ethers.toBeHex(amount, 8),
    ethers.toBeHex(targetChainId, 2),
    ethers.toBeHex(nonce, 8),
  ]);
  if (ethers.getBytes(payload).length !== 114) {
    throw new Error(`bridge payload is ${ethers.getBytes(payload).length} bytes`);
  }
  return payload;
}

async function exercise(spec: NetworkSpec, signer: ethers.Signer): Promise<Omit<ForkResult, "network" | "chainId" | "ok" | "seconds" | "error">> {
  assertLoopback(RPC);
  const launchFee = ethers.parseEther("0.001");
  const emitter = "0x" + "11".repeat(32);
  const deployed = await deployGoonforge(signer, spec, {
    launchFee,
    feeRecipient: await signer.getAddress(),
    solanaEmitter: emitter,
    mintRatio: 1_000_000_000n,
    bridgeTokenName: "GoonForge Bridged Token",
    bridgeTokenSymbol: "gBRIDGE",
    localOnlyRpc: RPC,
    deployGasLimit: 30_000_000n,
  });

  const factory = new ethers.Contract(deployed.tokenFactory, loadAbi("contracts/factories/TokenFactory.sol/TokenFactory.json"), signer);
  const deployer = await signer.getAddress();
  const createTx = await factory.createToken(
    {
      name: "DryRun",
      symbol: "DRY",
      totalSupply: ethers.parseEther("0.02"),
      decimals: 18,
      buyTaxBps: 100,
      sellTaxBps: 0,
      burnBps: 0,
      reflectionBps: 0,
      marketingWallet: deployer,
      liquidityBps: 0,
      owner: deployer,
      flavor: 8,
    },
    { value: launchFee, gasLimit: 8_000_000n }
  );
  const createReceipt = await createTx.wait();
  const created = createReceipt.logs
    .map((log: ethers.Log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: ethers.LogDescription | null) => parsed?.name === "TokenCreated");
  if (!created) throw new Error("TokenCreated was not emitted");
  const tokenAddress = created.args.tokenAddress as string;

  const token = new ethers.Contract(
    tokenAddress,
    loadAbi("contracts/templates/PumpMigrateToken.sol/PumpMigrateToken.json"),
    signer
  );
  const buyTx = await token.buy(1, { value: ethers.parseEther("0.1"), gasLimit: 8_000_000n });
  await buyTx.wait();
  const graduated = await token.isGraduated();
  const dexRouter = (await token.dexRouter()) as string;
  const locked = (await token.lpTokensLocked()) as bigint;
  if (!graduated) throw new Error("pump buy did not graduate");
  if (dexRouter === ethers.ZeroAddress) throw new Error("dexRouter is zero after graduation");
  if (locked === 0n) throw new Error("no LP was burned");

  const pair = new ethers.Contract(
    await token.liquidityPair(),
    ["function balanceOf(address) view returns (uint256)"],
    signer
  );
  const burned = (await pair.balanceOf(DEAD)) as bigint;
  if (burned === 0n) throw new Error(`LP balance of ${DEAD} is zero`);

  const provider = signer.provider!;
  let wormholeCoreHasCode = false;
  if (spec.wormholeCore) {
    try {
      const coreCode = usesLocalChain(spec)
        ? await fetchCode(spec.rpc, spec.wormholeCore)
        : await provider.getCode(spec.wormholeCore);
      wormholeCoreHasCode = coreCode !== "0x";
    } catch {
      wormholeCoreHasCode = false;
    }
  }

  const forkGas = 30_000_000n;
  const mock = await deployContract(signer, "MockWormholeCore", [], forkGas);
  const mintable = await deployContract(
    signer,
    "BridgeMintableToken",
    ["Dry Bridge", "dBRIDGE", 18, deployer],
    forkGas
  );
  const mockReceiver = await deployContract(
    signer,
    "BurnBridgeReceiver",
    [spec.wormholeChainId, await mock.getAddress(), emitter, await mintable.getAddress(), 1_000_000_000n],
    forkGas
  );
  const setTx = await mintable.setMinter(await mockReceiver.getAddress());
  await setTx.wait();

  const recipient = ethers.Wallet.createRandom().address;
  const amount = 5n;
  const payload = bridgePayload(recipient, amount, spec.wormholeChainId!, 7n);
  const configureTx = await mock.configure(true, 1, emitter, 1, payload, { gasLimit: 1_000_000n });
  await configureTx.wait();
  const relayTx = await mockReceiver.receiveMessage("0x01", { gasLimit: 2_000_000n });
  await relayTx.wait();
  const balance = (await mintable.balanceOf(recipient)) as bigint;
  if (balance !== amount * 1_000_000_000n) {
    throw new Error(`bridge mint balance ${balance}`);
  }

  return {
    graduated: true,
    dexRouter,
    lpBurned: true,
    wormholeCoreHasCode,
    bridgeMinted: true,
  };
}

async function runOne(spec: NetworkSpec): Promise<ForkResult> {
  const started = Date.now();
  console.log(`\n=== fork ${spec.name} (${spec.chainId}) ${spec.rpc} ===`);
  const child = startAnvil(spec);
  let provider: ethers.JsonRpcProvider | undefined;
  try {
    await waitForChain(spec.chainId);
    assertLoopback(RPC);
    provider = new ethers.JsonRpcProvider(RPC, spec.chainId, { staticNetwork: true });
    const funded = ethers.Wallet.createRandom().connect(provider);
    await provider.send("anvil_setBalance", [
      funded.address,
      ethers.toQuantity(ethers.parseEther("1000")),
    ]);
    // Anvil's pending nonce can lag a fork. Count locally so deploys stay in order.
    const signer = new ethers.NonceManager(funded);
    if (spec.testnetDex) {
      if (!spec.wrappedNative) throw new Error(`${spec.name} is missing wrappedNative`);
      const wrappedCode = await fetchCode(spec.rpc, spec.wrappedNative);
      await provider.send("anvil_setCode", [NICK_DEPLOYER, NICK_RUNTIME]);
      await provider.send("anvil_setCode", [spec.wrappedNative, wrappedCode]);
    } else if (spec.name === "bscTestnet") {
      const venue = CANONICAL_DEX.find((row) => row.chainId === spec.chainId);
      if (!venue) throw new Error("BSC testnet is missing from CANONICAL_DEX");
      for (const address of [venue.router, venue.factory, venue.wrappedNative]) {
        await provider.send("anvil_setCode", [address, await fetchCode(spec.rpc, address)]);
      }
    }
    const detail = await withTimeout(exercise(spec, signer), 360_000);
    return {
      network: spec.name,
      chainId: spec.chainId,
      ok: true,
      seconds: Math.round((Date.now() - started) / 1000),
      ...detail,
    };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const logPath = `/tmp/anvil-${spec.name}.log`;
    let tail = "";
    try {
      const text = fs.readFileSync(logPath, "utf8");
      tail = text
        .split("\n")
        .filter((line) => /error|reject|panic/i.test(line))
        .slice(-2)
        .join(" | ")
        .slice(0, 400);
    } catch {
      tail = "";
    }
    return {
      network: spec.name,
      chainId: spec.chainId,
      ok: false,
      error: tail ? `${message} | anvil: ${tail}` : message,
      seconds: Math.round((Date.now() - started) / 1000),
    };
  } finally {
    provider?.destroy();
    stopAnvil(child);
    await sleep(800);
  }
}

process.on("unhandledRejection", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`ignored unhandled rejection: ${message.slice(0, 300)}`);
});

async function main() {
  const specs = selectedNetworks();
  if (specs.length === 0) throw new Error("No catalog networks selected.");
  const results: ForkResult[] = [];
  for (const spec of specs) {
    results.push(await runOne(spec));
    const last = results[results.length - 1];
    console.log(last.ok ? `PASS ${spec.name} (${last.seconds}s)` : `FAIL ${spec.name}: ${last.error}`);
  }
  const out = "/tmp/goonforge-fork-dry-run.json";
  fs.writeFileSync(out, JSON.stringify(results, null, 2) + "\n");
  console.log(`\nWrote ${out}`);
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
