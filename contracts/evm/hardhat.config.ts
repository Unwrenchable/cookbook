import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();
const ACCOUNTS = PRIVATE_KEY ? [PRIVATE_KEY] : [];
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const OPSCAN_API_KEY = process.env.OPSCAN_API_KEY || "";

function rpc(envKey: string, fallback: string): string {
  const fromEnv = process.env[envKey]?.trim();
  return fromEnv || fallback;
}

const ETHERSCAN_V2 = (chainId: number) => `https://api.etherscan.io/v2/api?chainid=${chainId}`;
const explorerKey = (specific?: string) => specific || ETHERSCAN_API_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Testnets
    sepolia: {
      url: rpc("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
      accounts: ACCOUNTS,
      chainId: 11155111,
    },
    bscTestnet: {
      url: rpc("BSC_TESTNET_RPC_URL", "https://data-seed-prebsc-1-s1.binance.org:8545"),
      accounts: ACCOUNTS,
      chainId: 97,
    },
    polygonMumbai: {
      url: rpc("POLYGON_MUMBAI_RPC_URL", "https://polygon-mumbai-bor-rpc.publicnode.com"),
      accounts: ACCOUNTS,
      chainId: 80001,
    },
    // Polygon Amoy replaces Mumbai as the official Polygon testnet
    polygonAmoy: {
      url: rpc("POLYGON_AMOY_RPC_URL", "https://polygon-amoy-bor-rpc.publicnode.com"),
      accounts: ACCOUNTS,
      chainId: 80002,
    },
    arbitrumSepolia: {
      url: rpc("ARBITRUM_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
      accounts: ACCOUNTS,
      chainId: 421614,
    },
    baseSepolia: {
      url: rpc("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org"),
      accounts: ACCOUNTS,
      chainId: 84532,
    },
    // Mainnets
    mainnet: {
      url: rpc("MAINNET_RPC_URL", "https://ethereum-rpc.publicnode.com"),
      accounts: ACCOUNTS,
      chainId: 1,
    },
    bsc: {
      url: rpc("BSC_RPC_URL", "https://bsc-dataseed.binance.org/"),
      accounts: ACCOUNTS,
      chainId: 56,
    },
    polygon: {
      url: rpc("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com"),
      accounts: ACCOUNTS,
      chainId: 137,
    },
    arbitrum: {
      url: rpc("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
      accounts: ACCOUNTS,
      chainId: 42161,
    },
    base: {
      url: rpc("BASE_RPC_URL", "https://mainnet.base.org"),
      accounts: ACCOUNTS,
      chainId: 8453,
    },
    avalanche: {
      url: rpc("AVALANCHE_RPC_URL", "https://api.avax.network/ext/bc/C/rpc"),
      accounts: ACCOUNTS,
      chainId: 43114,
    },
    optimism: {
      url: rpc("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
      accounts: ACCOUNTS,
      chainId: 10,
    },
    optimismSepolia: {
      url: rpc("OPTIMISM_SEPOLIA_RPC_URL", "https://sepolia.optimism.io"),
      accounts: ACCOUNTS,
      chainId: 11155420,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: explorerKey(),
      sepolia: explorerKey(),
      bsc: explorerKey(BSCSCAN_API_KEY),
      bscTestnet: explorerKey(BSCSCAN_API_KEY),
      polygon: explorerKey(POLYGONSCAN_API_KEY),
      polygonMumbai: explorerKey(POLYGONSCAN_API_KEY),
      polygonAmoy: explorerKey(POLYGONSCAN_API_KEY),
      arbitrum: explorerKey(process.env.ARBISCAN_API_KEY),
      arbitrumSepolia: explorerKey(process.env.ARBISCAN_API_KEY),
      base: explorerKey(process.env.BASESCAN_API_KEY),
      baseSepolia: explorerKey(process.env.BASESCAN_API_KEY),
      optimism: explorerKey(OPSCAN_API_KEY),
      optimismSepolia: explorerKey(OPSCAN_API_KEY),
      avalanche: explorerKey(process.env.SNOWTRACE_API_KEY),
    },
    customChains: [
      { network: "polygonAmoy", chainId: 80002, urls: { apiURL: ETHERSCAN_V2(80002), browserURL: "https://amoy.polygonscan.com" } },
      { network: "arbitrum", chainId: 42161, urls: { apiURL: ETHERSCAN_V2(42161), browserURL: "https://arbiscan.io" } },
      { network: "arbitrumSepolia", chainId: 421614, urls: { apiURL: ETHERSCAN_V2(421614), browserURL: "https://sepolia.arbiscan.io" } },
      { network: "base", chainId: 8453, urls: { apiURL: ETHERSCAN_V2(8453), browserURL: "https://basescan.org" } },
      { network: "baseSepolia", chainId: 84532, urls: { apiURL: ETHERSCAN_V2(84532), browserURL: "https://sepolia.basescan.org" } },
      { network: "optimism", chainId: 10, urls: { apiURL: ETHERSCAN_V2(10), browserURL: "https://optimistic.etherscan.io" } },
      { network: "optimismSepolia", chainId: 11155420, urls: { apiURL: ETHERSCAN_V2(11155420), browserURL: "https://sepolia-optimism.etherscan.io" } },
      { network: "avalanche", chainId: 43114, urls: { apiURL: ETHERSCAN_V2(43114), browserURL: "https://snowtrace.io" } },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 180000,
  },
};

export default config;
