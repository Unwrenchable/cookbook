/**
 * deployBridgeMintableToken.ts – Deploy the ERC20 that BurnBridgeReceiver mints.
 *
 * Usage (do not run against mainnet until the bridge verification path is finished):
 *   npx hardhat run scripts/deployBridgeMintableToken.ts --network sepolia
 *
 * After both this token and BurnBridgeReceiver are deployed, the token owner must
 * call setMinter(receiverAddress). Nothing in this repository deploys to a network
 * on its own.
 */
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const name = process.env.BRIDGE_TOKEN_NAME ?? "GoonForge Bridged Token";
  const symbol = process.env.BRIDGE_TOKEN_SYMBOL ?? "gBRIDGE";
  const decimals = Number(process.env.BRIDGE_TOKEN_DECIMALS ?? "18");

  console.log(`\nDeploying BridgeMintableToken on ${network.name}`);
  console.log(`   Deployer: ${deployer.address}`);

  const factory = await ethers.getContractFactory("BridgeMintableToken");
  const token = await factory.deploy(name, symbol, decimals, deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  const envKey = `MINTABLE_TOKEN_${network.name.toUpperCase()}`;
  console.log(`\nBridgeMintableToken: ${address}`);
  console.log(`\n=== Add to contracts/evm/.env ===`);
  console.log(`${envKey}=${address}`);
  console.log(`\nNext: deploy BurnBridgeReceiver, then token.setMinter(receiver).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeploy failed:", err);
    process.exit(1);
  });
