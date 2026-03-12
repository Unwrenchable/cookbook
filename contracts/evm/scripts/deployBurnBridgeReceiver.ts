/**
 * deployBurnBridgeReceiver.ts – Deploy BurnBridgeReceiver.sol on multiple EVM chains.
 *
 * Usage:
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network sepolia
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network mainnet
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network bsc
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network polygon
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network arbitrum
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network base
 *   npx hardhat run scripts/deployBurnBridgeReceiver.ts --network avalanche
 *
 * Required env vars (in .env):
 *   PRIVATE_KEY                 – deployer private key
 *   ALCHEMY_API_KEY             – Alchemy API key for RPC access
 *   SOLANA_EMITTER              – bytes32 Solana program ID as hex (32 bytes, left-padded)
 *   MINTABLE_TOKEN_<NETWORK>    – address of the ERC20 token to mint on this chain
 *
 * Optional env vars:
 *   MINT_RATIO                  – tokens minted per 1 raw Solana unit (default: 1e9 = 1:1 for 9-dec SPL → 18-dec ERC20)
 *
 * What this script does:
 *   1. Reads the Wormhole core address for the current network.
 *   2. Deploys BurnBridgeReceiver with the configured parameters.
 *   3. Prints the deployed address and the env var to add to frontend/.env.local.
 */

import { ethers, network } from "hardhat";

// ─── Wormhole core bridge addresses per network ───────────────────────────────
// Source: https://docs.wormhole.com/wormhole/reference/contract-addresses

const WORMHOLE_CORE: Record<string, string> = {
  // Mainnets
  mainnet:   "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
  bsc:       "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
  polygon:   "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
  arbitrum:  "0xa5f208e072434bC67592E4C49C1B991BA79BCA46",
  base:      "0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6",
  avalanche: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
  // Testnets
  sepolia:     "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
  bscTestnet:  "0x68605AD7b15c732a30b1BbC62BE8425E9Bb182E9",
  polygonMumbai:    "0x0CBE91CF822c73C2315FB05100C2F714765d5c20",  // deprecated: use Amoy instead
  polygonAmoy:      "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
  arbitrumSepolia:  "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
  baseSepolia:      "0x79A1027a6A159502049F10906D333EC57E95F083",
};

// ─── Wormhole chain IDs per network ───────────────────────────────────────────

const WORMHOLE_CHAIN_ID: Record<string, number> = {
  mainnet:          2,
  bsc:              4,
  polygon:          5,
  avalanche:        6,
  arbitrum:         23,
  base:             30,
  // Testnets share the same Wormhole chain IDs as mainnets
  sepolia:          2,
  bscTestnet:       4,
  polygonMumbai:    5,
  polygonAmoy:      5,
  arbitrumSepolia:  23,
  baseSepolia:      30,
};

// ─── Frontend env var name per network ────────────────────────────────────────

const ENV_VAR: Record<string, string> = {
  mainnet:          "NEXT_PUBLIC_RECEIVER_MAINNET",
  bsc:              "NEXT_PUBLIC_RECEIVER_BSC",
  polygon:          "NEXT_PUBLIC_RECEIVER_POLYGON",
  avalanche:        "NEXT_PUBLIC_RECEIVER_AVALANCHE",
  arbitrum:         "NEXT_PUBLIC_RECEIVER_ARBITRUM",
  base:             "NEXT_PUBLIC_RECEIVER_BASE",
  sepolia:          "NEXT_PUBLIC_RECEIVER_SEPOLIA",
  bscTestnet:       "NEXT_PUBLIC_RECEIVER_BSC_TESTNET",
  polygonMumbai:    "NEXT_PUBLIC_RECEIVER_POLYGON_MUMBAI",
  polygonAmoy:      "NEXT_PUBLIC_RECEIVER_POLYGON_AMOY",
  arbitrumSepolia:  "NEXT_PUBLIC_RECEIVER_ARB_SEPOLIA",
  baseSepolia:      "NEXT_PUBLIC_RECEIVER_BASE_SEPOLIA",
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const netName    = network.name;

  console.log(`\n🔥 Deploying BurnBridgeReceiver on ${netName}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ── Resolve parameters ────────────────────────────────────────────────────

  const wormholeCore = WORMHOLE_CORE[netName];
  if (!wormholeCore) {
    throw new Error(`No Wormhole core address configured for network "${netName}". Add it to WORMHOLE_CORE.`);
  }

  const wormholeChainId = WORMHOLE_CHAIN_ID[netName];
  if (!wormholeChainId) {
    throw new Error(`No Wormhole chain ID configured for network "${netName}". Add it to WORMHOLE_CHAIN_ID.`);
  }

  // Solana emitter = the token-burn-bridge program ID encoded as bytes32
  // Run `anchor build` to get the real program ID, then convert:
  //   node -e "const {PublicKey}=require('@solana/web3.js'); console.log('0x'+Buffer.from(new PublicKey('YOUR_PROGRAM_ID').toBytes()).toString('hex'))"
  const rawSolanaEmitter = process.env.SOLANA_EMITTER;
  if (!rawSolanaEmitter || rawSolanaEmitter === "0x" + "00".repeat(32)) {
    throw new Error(
      "Missing or zero SOLANA_EMITTER in .env.\n" +
      "  Set it to the token-burn-bridge program ID as a 32-byte hex string.\n" +
      "  Derive it with: node -e \"const {PublicKey}=require('@solana/web3.js'); " +
      "console.log('0x'+Buffer.from(new PublicKey('YOUR_PROGRAM_ID').toBytes()).toString('hex'))\""
    );
  }
  const trustedSolanaEmitter = ethers.zeroPadValue(rawSolanaEmitter, 32) as `0x${string}`;

  // Mintable token address for this chain (must grant MINTER_ROLE to the deployed receiver)
  const mintableTokenEnvKey = `MINTABLE_TOKEN_${netName.toUpperCase()}`;
  const mintableToken =
    process.env[mintableTokenEnvKey] ?? process.env.MINTABLE_TOKEN;

  if (!mintableToken) {
    throw new Error(
      `Missing mintable token address. Set ${mintableTokenEnvKey} or MINTABLE_TOKEN in .env.\n` +
      `  This is the ERC20 contract that BurnBridgeReceiver will call .mint() on.\n` +
      `  It must grant MINTER_ROLE to the deployed receiver address.`
    );
  }

  // Mint ratio: how many EVM token units per 1 raw Solana token unit
  // Default 1e9 = burning 1 SPL token (9 decimals) mints 1 ERC20 token (18 decimals)
  const mintRatio = BigInt(process.env.MINT_RATIO ?? "1000000000");

  console.log(`   Wormhole core    : ${wormholeCore}`);
  console.log(`   Wormhole chain ID: ${wormholeChainId}`);
  console.log(`   Solana emitter   : ${trustedSolanaEmitter}`);
  console.log(`   Mintable token   : ${mintableToken}`);
  console.log(`   Mint ratio       : ${mintRatio.toString()}\n`);

  // ── Deploy ────────────────────────────────────────────────────────────────

  const BurnBridgeReceiverFactory = await ethers.getContractFactory("BurnBridgeReceiver");

  const receiver = await BurnBridgeReceiverFactory.deploy(
    wormholeChainId,
    wormholeCore,
    trustedSolanaEmitter,
    mintableToken,
    mintRatio
  );
  await receiver.waitForDeployment();

  const receiverAddress = await receiver.getAddress();
  console.log(`✅ BurnBridgeReceiver deployed!`);
  console.log(`   Address : ${receiverAddress}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const envVarName = ENV_VAR[netName] ?? `NEXT_PUBLIC_RECEIVER_${netName.toUpperCase()}`;
  console.log(`\n=== Add to frontend/.env.local ===`);
  console.log(`${envVarName}=${receiverAddress}`);

  console.log(`\n=== Add to contracts/solana/scripts/deploy.ts EVM_RECEIVERS ===`);
  console.log(JSON.stringify({
    chainId:         wormholeChainId,
    receiverAddress: receiverAddress,
    isActive:        true,
  }, null, 2));

  // ── Block explorer link ───────────────────────────────────────────────────
  const explorers: Record<string, string> = {
    mainnet:          `https://etherscan.io/address/${receiverAddress}`,
    sepolia:          `https://sepolia.etherscan.io/address/${receiverAddress}`,
    bsc:              `https://bscscan.com/address/${receiverAddress}`,
    bscTestnet:       `https://testnet.bscscan.com/address/${receiverAddress}`,
    polygon:          `https://polygonscan.com/address/${receiverAddress}`,
    polygonMumbai:    `https://mumbai.polygonscan.com/address/${receiverAddress}`,
    arbitrum:         `https://arbiscan.io/address/${receiverAddress}`,
    arbitrumSepolia:  `https://sepolia.arbiscan.io/address/${receiverAddress}`,
    base:             `https://basescan.org/address/${receiverAddress}`,
    baseSepolia:      `https://sepolia.basescan.org/address/${receiverAddress}`,
    avalanche:        `https://snowtrace.io/address/${receiverAddress}`,
  };
  if (explorers[netName]) {
    console.log(`\nExplorer: ${explorers[netName]}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Deploy failed:", err);
    process.exit(1);
  });
