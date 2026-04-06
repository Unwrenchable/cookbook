/**
 * chains.ts – Supported networks for TokenForge.
 *
 * Adding a new chain takes < 10 minutes:
 *   1. Import the chain from viem/chains.
 *   2. Add an entry to SUPPORTED_CHAINS with the deployed factory address.
 *   3. Deploy the factory via `pnpm deploy:<network>` in contracts/evm.
 */

export interface ChainConfig {
  id: number;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  iconUrl?: string;
  /** Address of the deployed TokenFactory contract on this chain (empty = not deployed) */
  factoryAddress: `0x${string}` | "";
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  // ─── Testnets ──────────────────────────────────────────────────────────────
  {
    id: 11155111,
    name: "Ethereum Sepolia",
    shortName: "sepolia",
    nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/11155111",
    blockExplorer: "https://sepolia.etherscan.io",
    isTestnet: true,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_SEPOLIA as `0x${string}`) ?? "",
  },
  {
    id: 97,
    name: "BNB Smart Chain Testnet",
    shortName: "bscTestnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
    isTestnet: true,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_BSC_TESTNET as `0x${string}`) ?? "",
  },
  {
    id: 80002,
    name: "Polygon Amoy",
    shortName: "polygonAmoy",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrl: "/api/rpc/80002",
    blockExplorer: "https://amoy.polygonscan.com",
    isTestnet: true,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_POLYGON_AMOY as `0x${string}`) ?? "",
  },
  {
    id: 421614,
    name: "Arbitrum Sepolia",
    shortName: "arbitrumSepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/421614",
    blockExplorer: "https://sepolia.arbiscan.io",
    isTestnet: true,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_ARB_SEPOLIA as `0x${string}`) ?? "",
  },
  {
    id: 84532,
    name: "Base Sepolia",
    shortName: "baseSepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/84532",
    blockExplorer: "https://sepolia.basescan.org",
    isTestnet: true,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_BASE_SEPOLIA as `0x${string}`) ?? "",
  },
  // ─── Mainnets ─────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Ethereum",
    shortName: "mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/1",
    blockExplorer: "https://etherscan.io",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_MAINNET as `0x${string}`) ?? "",
  },
  {
    id: 56,
    name: "BNB Smart Chain",
    shortName: "bsc",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrl: "https://bsc-dataseed.binance.org/",
    blockExplorer: "https://bscscan.com",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_BSC as `0x${string}`) ?? "",
  },
  {
    id: 137,
    name: "Polygon",
    shortName: "polygon",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrl: "/api/rpc/137",
    blockExplorer: "https://polygonscan.com",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_POLYGON as `0x${string}`) ?? "",
  },
  {
    id: 42161,
    name: "Arbitrum One",
    shortName: "arbitrum",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/42161",
    blockExplorer: "https://arbiscan.io",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_ARBITRUM as `0x${string}`) ?? "",
  },
  {
    id: 8453,
    name: "Base",
    shortName: "base",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/8453",
    blockExplorer: "https://basescan.org",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_BASE as `0x${string}`) ?? "",
  },
  {
    id: 43114,
    name: "Avalanche C-Chain",
    shortName: "avalanche",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    blockExplorer: "https://snowtrace.io",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_AVALANCHE as `0x${string}`) ?? "",
  },
  {
    id: 10,
    name: "Optimism",
    shortName: "optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/10",
    blockExplorer: "https://optimistic.etherscan.io",
    isTestnet: false,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_OPTIMISM as `0x${string}`) ?? "",
  },
  {
    id: 11155420,
    name: "Optimism Sepolia",
    shortName: "opSepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "/api/rpc/11155420",
    blockExplorer: "https://sepolia-optimism.etherscan.io",
    isTestnet: true,
    factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_OP_SEPOLIA as `0x${string}`) ?? "",
  },
];

export const TESTNET_CHAINS  = SUPPORTED_CHAINS.filter((c) => c.isTestnet);
export const MAINNET_CHAINS  = SUPPORTED_CHAINS.filter((c) => !c.isTestnet);

export function getChainById(id: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id);
}
