import fs from "fs";
import path from "path";
import { ethers } from "ethers";

/** Arachnid deterministic deployment proxy. Present on the testnets we pin. */
export const NICK_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
export const NICK_RUNTIME =
  "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";

export const FACTORY_SALT = ethers.id("goonforge.testnet.uniswap-v2.factory.v1");
export const ROUTER_SALT = ethers.id("goonforge.testnet.uniswap-v2.router.v1");

/** Canonical Uniswap V2 pair init-code hash. The published router bakes this in. */
export const OFFICIAL_PAIR_INIT_HASH =
  "0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f";

function pkgJson(rel: string): { bytecode: string; abi: unknown } {
  const file = require.resolve(rel, { paths: [path.join(__dirname, "..")] });
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const bytecode = json.bytecode.startsWith("0x") ? json.bytecode : `0x${json.bytecode}`;
  return { bytecode, abi: json.abi };
}

export function officialFactoryArtifact() {
  return pkgJson("@uniswap/v2-core/build/UniswapV2Factory.json");
}

export function officialPairArtifact() {
  return pkgJson("@uniswap/v2-core/build/UniswapV2Pair.json");
}

export function officialRouterArtifact() {
  return pkgJson("@uniswap/v2-periphery/build/UniswapV2Router02.json");
}

export function create2Address(salt: string, initCode: string): string {
  const hash = ethers.keccak256(
    ethers.concat(["0xff", NICK_DEPLOYER, salt, ethers.keccak256(initCode)])
  );
  return ethers.getAddress(`0x${hash.slice(-40)}`);
}

export function factoryInitCode(): string {
  const { bytecode } = officialFactoryArtifact();
  return ethers.concat([
    bytecode,
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [ethers.ZeroAddress]),
  ]);
}

export function routerInitCode(factory: string, wrappedNative: string): string {
  const { bytecode } = officialRouterArtifact();
  return ethers.concat([
    bytecode,
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"], [factory, wrappedNative]),
  ]);
}

export function pinnedFactoryAddress(): string {
  return create2Address(FACTORY_SALT, factoryInitCode());
}

export function pinnedRouterAddress(wrappedNative: string): string {
  return create2Address(ROUTER_SALT, routerInitCode(pinnedFactoryAddress(), wrappedNative));
}

export async function ensureNick(provider: ethers.Provider): Promise<void> {
  const code = await provider.getCode(NICK_DEPLOYER);
  if (code === "0x") {
    throw new Error(
      `Deterministic deployer ${NICK_DEPLOYER} has no code on this chain. ` +
        "The testnet DEX addresses are pinned to that deployer."
    );
  }
}

export async function deployCreate2(
  signer: ethers.Signer,
  salt: string,
  initCode: string,
  gasLimit?: bigint
): Promise<string> {
  const provider = signer.provider;
  if (!provider) throw new Error("signer has no provider");
  await ensureNick(provider);
  const predicted = create2Address(salt, initCode);
  if ((await provider.getCode(predicted)) !== "0x") return predicted;
  const tx = await signer.sendTransaction({
    to: NICK_DEPLOYER,
    data: ethers.concat([salt, initCode]),
    gasLimit: gasLimit ?? 12_000_000n,
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`CREATE2 transaction failed at ${predicted}`);
  }
  return predicted;
}
