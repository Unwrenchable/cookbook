/**
 * One-command deploy for a catalog network.
 *
 *   pnpm deploy:sepolia
 *   VERIFY=1 pnpm deploy:baseSepolia
 *   CONFIRM_MAINNET=yes-deploy-mainnet CONFIRM_NETWORK=base FEE_RECIPIENT=0xMultisig pnpm deploy:base
 *
 * Does not broadcast unless you run it. Mainnet also requires the confirm flags in
 * docs/MAINNET_CHECKLIST.md. Addresses are written under deployments/ (gitignored)
 * and printed as frontend env lines.
 */
import { ethers, network, run } from "hardhat";
import { assertBroadcastAllowed, normalizeEmitter } from "./mainnetGuard";
import { networkByName } from "./networkCatalog";
import { deployGoonforge, frontendEnvLines, writeDeploymentFiles, type DeployResult } from "./deployStack";

function launchFeeWei(): bigint {
  const raw = process.env.LAUNCH_FEE?.trim();
  const fee = raw ? ethers.parseEther(raw) : ethers.parseEther("0.001");
  if (fee > ethers.parseEther("1")) {
    throw new Error("LAUNCH_FEE is above the 1 ether factory cap.");
  }
  return fee;
}

async function verifyOne(address: string, constructorArguments: unknown[]): Promise<void> {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`  verified ${address}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  verify skipped for ${address}: ${message.split("\n")[0]}`);
  }
}

async function verifyAll(result: DeployResult): Promise<void> {
  console.log("\nVerifying our contracts (the Uniswap bytecode is the published npm artifact)...");
  for (const address of [...Object.values(result.implementations), result.lpLocker]) {
    await verifyOne(address, []);
  }
  await verifyOne(result.tokenFactory, result.factoryArgs);
  await verifyOne(result.bridgeToken, result.bridgeTokenArgs);
  await verifyOne(
    result.burnBridgeReceiver,
    result.receiverArgs.map((v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

async function main() {
  const netName = network.name;
  if (netName === "hardhat" || netName === "localhost") {
    throw new Error(
      "Refusing a local Hardhat deploy. Graduation reads block.chainid, which is 31337 here and has no router. " +
        "Use pnpm dry-run:forks for a local proof, or deploy to a catalog network."
    );
  }

  const spec = networkByName(netName);
  if (spec.unavailable) throw new Error(spec.unavailable);

  const [deployer] = await ethers.getSigners();
  const feeRecipient = (process.env.FEE_RECIPIENT?.trim() || (spec.isMainnet ? "" : deployer.address));
  // ["emitter"] PDA as bytes32, from `pnpm emitter <programId>`. Not the program id.
  const emitter = normalizeEmitter(process.env.SOLANA_EMITTER);
  assertBroadcastAllowed({
    networkName: spec.name,
    isMainnet: spec.isMainnet,
    emitter,
    feeRecipient,
    deployer: deployer.address,
  });

  const rpcChain = await ethers.provider.getNetwork();
  if (Number(rpcChain.chainId) !== spec.chainId) {
    throw new Error(`Connected chain ${rpcChain.chainId} is not ${spec.name} (${spec.chainId}).`);
  }

  console.log(`\nDeploying GOONFORGE on ${spec.name} (${spec.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))}`);
  if (spec.testnetDex) {
    console.log("This network has no publisher V2 router. Deploying the pinned Uniswap V2 bytecode first.");
  }

  const result = await deployGoonforge(deployer, spec, {
    launchFee: launchFeeWei(),
    feeRecipient,
    solanaEmitter: emitter,
    mintRatio: BigInt(process.env.MINT_RATIO ?? "1000000000"),
    bridgeTokenName: process.env.BRIDGE_TOKEN_NAME ?? "GoonForge Bridged Token",
    bridgeTokenSymbol: process.env.BRIDGE_TOKEN_SYMBOL ?? "gBRIDGE",
  });

  const files = writeDeploymentFiles(result, spec);
  console.log("\n=== Frontend env ===");
  console.log(frontendEnvLines(result, spec));
  console.log(`\nWrote ${files.jsonPath}`);
  console.log(`Wrote ${files.envPath}`);

  if (process.env.VERIFY === "1") {
    await verifyAll(result);
  } else {
    console.log("\nSet VERIFY=1 to submit our contracts to the explorer. The pinned DEX bytecode is not recompiled.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
