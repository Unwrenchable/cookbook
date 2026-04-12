import { ethers, network } from "hardhat";

function requiredEnv(keys: string[]) {
  const missing = keys.filter((k) => !process.env[k] || process.env[k]?.trim() === "");
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

async function main() {
  const netName = network.name;
  const isTestnet = [
    "sepolia",
    "bscTestnet",
    "polygonMumbai",
    "polygonAmoy",
    "arbitrumSepolia",
    "baseSepolia",
    "optimismSepolia",
  ].includes(netName);
  const isLocal = ["hardhat", "localhost"].includes(netName);

  if (!isTestnet) {
    console.warn(`Preflight is intended for testnets. Current network: ${netName}`);
  }

  if (!isLocal) {
    requiredEnv(["PRIVATE_KEY"]);
  }

  if (["sepolia", "polygonAmoy", "arbitrumSepolia", "baseSepolia", "optimismSepolia"].includes(netName)) {
    requiredEnv(["ALCHEMY_API_KEY"]);
  }

  const provider = ethers.provider;
  const [signer] = await ethers.getSigners();

  const chain = await provider.getNetwork();
  const block = await provider.getBlockNumber();
  const balance = await provider.getBalance(signer.address);

  console.log("=== EVM Deployment Preflight ===");
  console.log(`Network      : ${netName}`);
  console.log(`Chain ID     : ${chain.chainId}`);
  console.log(`Latest block : ${block}`);
  console.log(`Deployer     : ${signer.address}`);
  console.log(`Balance      : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Deployer has 0 balance on target network. Fund wallet before deploying.");
  }

  console.log("Preflight passed. Ready to deploy.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Preflight failed:", error);
    process.exit(1);
  });
