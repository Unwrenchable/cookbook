/**
 * Shared deploy used by scripts/deploy.ts and the local fork dry run.
 * Broadcast safety (mainnet confirm flags, leaked emitter) is enforced by the caller
 * before this function sends a transaction.
 */
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import type { NetworkSpec } from "./networkCatalog";
import {
  FACTORY_SALT,
  ROUTER_SALT,
  deployCreate2,
  factoryInitCode,
  pinnedFactoryAddress,
  pinnedRouterAddress,
  routerInitCode,
} from "./uniswapV2Bytecode";

const ARTIFACTS: Record<string, string> = {
  StandardERC20: "contracts/templates/StandardERC20.sol/StandardERC20.json",
  TaxableERC20: "contracts/templates/TaxableERC20.sol/TaxableERC20.json",
  DeflationaryERC20: "contracts/templates/DeflationaryERC20.sol/DeflationaryERC20.json",
  ReflectionERC20: "contracts/templates/ReflectionERC20.sol/ReflectionERC20.json",
  BondingCurveToken: "contracts/templates/BondingCurveToken.sol/BondingCurveToken.json",
  AIAgentToken: "contracts/templates/AIAgentToken.sol/AIAgentToken.json",
  PolitiFiToken: "contracts/templates/PolitiFiToken.sol/PolitiFiToken.json",
  UtilityHybridToken: "contracts/templates/UtilityHybridToken.sol/UtilityHybridToken.json",
  PumpMigrateToken: "contracts/templates/PumpMigrateToken.sol/PumpMigrateToken.json",
  TokenFactory: "contracts/factories/TokenFactory.sol/TokenFactory.json",
  LPLocker: "contracts/lockers/LPLocker.sol/LPLocker.json",
  BridgeMintableToken: "contracts/bridge/BridgeMintableToken.sol/BridgeMintableToken.json",
  BurnBridgeReceiver: "contracts/bridge/BurnBridgeReceiver.sol/BurnBridgeReceiver.json",
  MockWormholeCore: "contracts/mocks/MockWormholeCore.sol/MockWormholeCore.json",
};

const IMPL_ORDER = [
  "StandardERC20",
  "TaxableERC20",
  "DeflationaryERC20",
  "ReflectionERC20",
  "BondingCurveToken",
  "AIAgentToken",
  "PolitiFiToken",
  "UtilityHybridToken",
  "PumpMigrateToken",
] as const;

export interface DeployOptions {
  launchFee: bigint;
  feeRecipient: string;
  solanaEmitter: string;
  mintRatio: bigint;
  bridgeTokenName: string;
  bridgeTokenSymbol: string;
  /** When set, every transaction must go to this loopback URL. */
  localOnlyRpc?: string;
  /** Fork deploys. Real broadcasts keep the estimator. */
  deployGasLimit?: bigint;
}

export interface DeployResult {
  network: string;
  chainId: number;
  deployer: string;
  testnetDex?: { factory: string; router: string; wrappedNative: string };
  implementations: Record<string, string>;
  tokenFactory: string;
  factoryArgs: string[];
  lpLocker: string;
  bridgeToken: string;
  bridgeTokenArgs: (string | number)[];
  burnBridgeReceiver: string;
  receiverArgs: (string | number | bigint)[];
  wormholeChainId?: number;
  wormholeCore?: string;
  launchFee: bigint;
  feeRecipient: string;
  solanaEmitter: string;
}

function artifact(name: string): { abi: ethers.InterfaceAbi; bytecode: string } {
  const rel = ARTIFACTS[name];
  if (!rel) throw new Error(`No artifact path for ${name}`);
  const file = path.join(__dirname, "..", "artifacts", rel);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

export async function deployContract(
  signer: ethers.Signer,
  name: string,
  args: unknown[] = [],
  gasLimit?: bigint
): Promise<ethers.BaseContract> {
  const { abi, bytecode } = artifact(name);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const overrides = gasLimit ? { gasLimit } : {};
  const contract = await factory.deploy(...args, overrides);
  await contract.waitForDeployment();
  return contract;
}

function assertLoopback(rpcUrl: string): void {
  let host = "";
  try {
    host = new URL(rpcUrl).hostname;
  } catch {
    throw new Error(`Dry run RPC is not a URL: ${rpcUrl}`);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to send transactions to ${host}. Dry runs only talk to a local fork.`);
  }
}

export async function deployGoonforge(
  signer: ethers.Signer,
  spec: NetworkSpec,
  opts: DeployOptions
): Promise<DeployResult> {
  if (spec.unavailable) throw new Error(spec.unavailable);
  if (opts.localOnlyRpc) assertLoopback(opts.localOnlyRpc);
  if (opts.launchFee > ethers.parseEther("1")) {
    throw new Error("LAUNCH_FEE is above the 1 ether factory cap.");
  }
  const provider = signer.provider;
  if (!provider) throw new Error("signer has no provider");
  const chain = await provider.getNetwork();
  if (Number(chain.chainId) !== spec.chainId) {
    throw new Error(
      `RPC chain id ${chain.chainId} does not match catalog chain id ${spec.chainId} for ${spec.name}.`
    );
  }
  const deployer = await signer.getAddress();
  if (!opts.feeRecipient || opts.feeRecipient === ethers.ZeroAddress) {
    throw new Error("FEE_RECIPIENT is empty.");
  }

  let testnetDex: DeployResult["testnetDex"];
  if (spec.testnetDex) {
    if (!spec.wrappedNative) throw new Error(`${spec.name} is missing wrappedNative.`);
    const factoryAddress = await deployCreate2(signer, FACTORY_SALT, factoryInitCode(), opts.deployGasLimit);
    if (factoryAddress !== pinnedFactoryAddress()) {
      throw new Error(`Factory landed at ${factoryAddress}, expected ${pinnedFactoryAddress()}.`);
    }
    const routerAddress = await deployCreate2(
      signer,
      ROUTER_SALT,
      routerInitCode(factoryAddress, spec.wrappedNative),
      opts.deployGasLimit
    );
    const expectedRouter = pinnedRouterAddress(spec.wrappedNative);
    if (routerAddress !== expectedRouter) {
      throw new Error(`Router landed at ${routerAddress}, expected ${expectedRouter}.`);
    }
    testnetDex = {
      factory: factoryAddress,
      router: routerAddress,
      wrappedNative: spec.wrappedNative,
    };
    console.log(`  Testnet DEX factory → ${factoryAddress}`);
    console.log(`  Testnet DEX router  → ${routerAddress}`);
  }

  const implementations: Record<string, string> = {};
  const implAddresses: string[] = [];
  for (const name of IMPL_ORDER) {
    const contract = await deployContract(signer, name, [], opts.deployGasLimit);
    const address = await contract.getAddress();
    implementations[name] = address;
    implAddresses.push(address);
    console.log(`  ${name.padEnd(20)} → ${address}`);
  }

  const factoryArgs = [...implAddresses, opts.launchFee, opts.feeRecipient];
  const tokenFactory = await deployContract(signer, "TokenFactory", factoryArgs, opts.deployGasLimit);
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log(`  TokenFactory         → ${tokenFactoryAddress}`);

  const lpLocker = await deployContract(signer, "LPLocker", [], opts.deployGasLimit);
  const lpLockerAddress = await lpLocker.getAddress();
  console.log(`  LPLocker             → ${lpLockerAddress}`);

  if (spec.wormholeChainId === undefined || !spec.wormholeCore) {
    throw new Error(`${spec.name} has no Wormhole core in the catalog.`);
  }

  const bridgeTokenArgs: (string | number)[] = [
    opts.bridgeTokenName,
    opts.bridgeTokenSymbol,
    18,
    deployer,
  ];
  const bridgeToken = await deployContract(signer, "BridgeMintableToken", bridgeTokenArgs, opts.deployGasLimit);
  const bridgeTokenAddress = await bridgeToken.getAddress();
  console.log(`  BridgeMintableToken  → ${bridgeTokenAddress}`);

  const receiverArgs: (string | number | bigint)[] = [
    spec.wormholeChainId,
    spec.wormholeCore,
    opts.solanaEmitter,
    bridgeTokenAddress,
    opts.mintRatio,
  ];
  const receiver = await deployContract(signer, "BurnBridgeReceiver", receiverArgs, opts.deployGasLimit);
  const receiverAddress = await receiver.getAddress();
  console.log(`  BurnBridgeReceiver   → ${receiverAddress}`);

  const mintable = new ethers.Contract(bridgeTokenAddress, artifact("BridgeMintableToken").abi, signer);
  const setMinterTx = await mintable.setMinter(
    receiverAddress,
    opts.deployGasLimit ? { gasLimit: 500_000n } : {}
  );
  await setMinterTx.wait();
  console.log(`  setMinter            → ${receiverAddress}`);

  return {
    network: spec.name,
    chainId: spec.chainId,
    deployer,
    testnetDex,
    implementations,
    tokenFactory: tokenFactoryAddress,
    factoryArgs: factoryArgs.map((v) => (typeof v === "bigint" ? v.toString() : String(v))),
    lpLocker: lpLockerAddress,
    bridgeToken: bridgeTokenAddress,
    bridgeTokenArgs,
    burnBridgeReceiver: receiverAddress,
    receiverArgs,
    wormholeChainId: spec.wormholeChainId,
    wormholeCore: spec.wormholeCore,
    launchFee: opts.launchFee,
    feeRecipient: opts.feeRecipient,
    solanaEmitter: opts.solanaEmitter,
  };
}

export function writeDeploymentFiles(result: DeployResult, spec: NetworkSpec): { jsonPath: string; envPath: string } {
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, `${spec.name}.json`);
  const envPath = path.join(dir, `${spec.name}.env`);
  const json = JSON.stringify(
    result,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
  fs.writeFileSync(jsonPath, json + "\n");
  const lines = [
    `${spec.factoryEnv}=${result.tokenFactory}`,
    `${spec.lockerEnv}=${result.lpLocker}`,
    `${spec.receiverEnv}=${result.burnBridgeReceiver}`,
    "",
  ];
  fs.writeFileSync(envPath, lines.join("\n"));
  return { jsonPath, envPath };
}

export function frontendEnvLines(result: DeployResult, spec: NetworkSpec): string {
  return [
    `${spec.factoryEnv}=${result.tokenFactory}`,
    `${spec.lockerEnv}=${result.lpLocker}`,
    `${spec.receiverEnv}=${result.burnBridgeReceiver}`,
  ].join("\n");
}
