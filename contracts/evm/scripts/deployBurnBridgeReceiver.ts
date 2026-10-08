/**
 * Deploy BurnBridgeReceiver against an existing BridgeMintableToken.
 * The one-command script (scripts/deploy.ts) already deploys both and calls setMinter.
 * Use this only to replace a receiver on a token you already deployed.
 *
 * Wormhole chain ids and cores come from scripts/networkCatalog.ts.
 */
import { ethers, network } from "hardhat";
import { assertBroadcastAllowed, normalizeEmitter } from "./mainnetGuard";
import { networkByName } from "./networkCatalog";

async function main() {
  const spec = networkByName(network.name);
  if (spec.unavailable) throw new Error(spec.unavailable);
  if (spec.wormholeChainId === undefined || !spec.wormholeCore) {
    throw new Error(`No Wormhole core configured for ${spec.name}.`);
  }

  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT?.trim() || (spec.isMainnet ? "" : deployer.address);
  const trustedSolanaEmitter = normalizeEmitter(process.env.SOLANA_EMITTER);
  assertBroadcastAllowed({
    networkName: spec.name,
    isMainnet: spec.isMainnet,
    emitter: trustedSolanaEmitter,
    feeRecipient,
    deployer: deployer.address,
  });

  const mintableTokenEnvKey = `MINTABLE_TOKEN_${spec.name.toUpperCase()}`;
  const mintableToken = process.env[mintableTokenEnvKey] ?? process.env.MINTABLE_TOKEN;
  if (!mintableToken) {
    throw new Error(
      `Missing mintable token address. Set ${mintableTokenEnvKey} or MINTABLE_TOKEN, ` +
        "or run scripts/deploy.ts which deploys the token and the receiver together."
    );
  }

  const mintRatio = BigInt(process.env.MINT_RATIO ?? "1000000000");
  console.log(`\nDeploying BurnBridgeReceiver on ${spec.name}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Wormhole core    : ${spec.wormholeCore}`);
  console.log(`   Wormhole chain ID: ${spec.wormholeChainId}`);
  console.log(`   Solana emitter   : ${trustedSolanaEmitter}`);
  console.log(`   Mintable token   : ${mintableToken}`);

  const factory = await ethers.getContractFactory("BurnBridgeReceiver");
  const receiver = await factory.deploy(
    spec.wormholeChainId,
    spec.wormholeCore,
    trustedSolanaEmitter,
    mintableToken,
    mintRatio
  );
  await receiver.waitForDeployment();
  const receiverAddress = await receiver.getAddress();
  console.log(`\nBurnBridgeReceiver: ${receiverAddress}`);

  const token = await ethers.getContractAt("BridgeMintableToken", mintableToken);
  const owner = await token.owner();
  if (owner.toLowerCase() === deployer.address.toLowerCase()) {
    const tx = await token.setMinter(receiverAddress);
    await tx.wait();
    console.log(`setMinter(${receiverAddress}) confirmed.`);
  } else {
    console.log(`Token owner is ${owner}. That owner must call setMinter(${receiverAddress}).`);
  }

  console.log(`\n=== frontend/.env.local ===`);
  console.log(`${spec.receiverEnv}=${receiverAddress}`);
  console.log(`\nExplorer: ${spec.explorer}/address/${receiverAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeploy failed:", err);
    process.exit(1);
  });
