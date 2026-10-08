/**
 * Networks the deploy scripts know about.
 * RPC URLs are public fallbacks. Hardhat reads the same names from the environment.
 * Wormhole chain ids: https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/utils/consts.ts
 * Wormhole cores: https://wormhole.com/docs/products/reference/contract-addresses/
 */

export interface NetworkSpec {
  name: string;
  chainId: number;
  isMainnet: boolean;
  rpcEnv: string;
  rpc: string;
  explorer: string;
  factoryEnv: string;
  lockerEnv: string;
  receiverEnv: string;
  /** Wormhole chain id. Omitted when Wormhole has no core for this network. */
  wormholeChainId?: number;
  wormholeCore?: `0x${string}`;
  /** Pin and deploy the official Uniswap V2 bytecode before graduation. */
  testnetDex: boolean;
  /** Wrapped native the pinned router is constructed with. Testnet DEX only. */
  wrappedNative?: `0x${string}`;
  /** Shut down or otherwise not a deploy target. */
  unavailable?: string;
}

export const NETWORKS: NetworkSpec[] = [
  {
    name: "mainnet",
    chainId: 1,
    isMainnet: true,
    rpcEnv: "MAINNET_RPC_URL",
    rpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_MAINNET",
    lockerEnv: "NEXT_PUBLIC_LOCKER_MAINNET",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_MAINNET",
    wormholeChainId: 2,
    wormholeCore: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    testnetDex: false,
  },
  {
    name: "bsc",
    chainId: 56,
    isMainnet: true,
    rpcEnv: "BSC_RPC_URL",
    rpc: "https://bsc-dataseed.binance.org/",
    explorer: "https://bscscan.com",
    factoryEnv: "NEXT_PUBLIC_FACTORY_BSC",
    lockerEnv: "NEXT_PUBLIC_LOCKER_BSC",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_BSC",
    wormholeChainId: 4,
    wormholeCore: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    testnetDex: false,
  },
  {
    name: "polygon",
    chainId: 137,
    isMainnet: true,
    rpcEnv: "POLYGON_RPC_URL",
    rpc: "https://polygon-bor-rpc.publicnode.com",
    explorer: "https://polygonscan.com",
    factoryEnv: "NEXT_PUBLIC_FACTORY_POLYGON",
    lockerEnv: "NEXT_PUBLIC_LOCKER_POLYGON",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_POLYGON",
    wormholeChainId: 5,
    wormholeCore: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
    testnetDex: false,
  },
  {
    name: "arbitrum",
    chainId: 42161,
    isMainnet: true,
    rpcEnv: "ARBITRUM_RPC_URL",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_ARBITRUM",
    lockerEnv: "NEXT_PUBLIC_LOCKER_ARBITRUM",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_ARBITRUM",
    wormholeChainId: 23,
    wormholeCore: "0xa5f208e072434bC67592E4C49C1B991BA79BCA46",
    testnetDex: false,
  },
  {
    name: "base",
    chainId: 8453,
    isMainnet: true,
    rpcEnv: "BASE_RPC_URL",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    factoryEnv: "NEXT_PUBLIC_FACTORY_BASE",
    lockerEnv: "NEXT_PUBLIC_LOCKER_BASE",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_BASE",
    wormholeChainId: 30,
    wormholeCore: "0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6",
    testnetDex: false,
  },
  {
    name: "avalanche",
    chainId: 43114,
    isMainnet: true,
    rpcEnv: "AVALANCHE_RPC_URL",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_AVALANCHE",
    lockerEnv: "NEXT_PUBLIC_LOCKER_AVALANCHE",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_AVALANCHE",
    wormholeChainId: 6,
    wormholeCore: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
    testnetDex: false,
  },
  {
    name: "optimism",
    chainId: 10,
    isMainnet: true,
    rpcEnv: "OPTIMISM_RPC_URL",
    rpc: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_OPTIMISM",
    lockerEnv: "NEXT_PUBLIC_LOCKER_OPTIMISM",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_OPTIMISM",
    wormholeChainId: 24,
    wormholeCore: "0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722",
    testnetDex: false,
  },
  {
    name: "sepolia",
    chainId: 11155111,
    isMainnet: false,
    rpcEnv: "SEPOLIA_RPC_URL",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_SEPOLIA",
    lockerEnv: "NEXT_PUBLIC_LOCKER_SEPOLIA",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_SEPOLIA",
    wormholeChainId: 10002,
    wormholeCore: "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
    testnetDex: false,
  },
  {
    name: "bscTestnet",
    chainId: 97,
    isMainnet: false,
    rpcEnv: "BSC_TESTNET_RPC_URL",
    rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorer: "https://testnet.bscscan.com",
    factoryEnv: "NEXT_PUBLIC_FACTORY_BSC_TESTNET",
    lockerEnv: "NEXT_PUBLIC_LOCKER_BSC_TESTNET",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_BSC_TESTNET",
    wormholeChainId: 4,
    wormholeCore: "0x68605AD7b15c732a30b1BbC62BE8F2A509D74b4D",
    testnetDex: false,
  },
  {
    name: "polygonAmoy",
    chainId: 80002,
    isMainnet: false,
    rpcEnv: "POLYGON_AMOY_RPC_URL",
    rpc: "https://polygon-amoy-bor-rpc.publicnode.com",
    explorer: "https://amoy.polygonscan.com",
    factoryEnv: "NEXT_PUBLIC_FACTORY_POLYGON_AMOY",
    lockerEnv: "NEXT_PUBLIC_LOCKER_POLYGON_AMOY",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_POLYGON_AMOY",
    wormholeChainId: 10007,
    wormholeCore: "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
    testnetDex: true,
    wrappedNative: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
  },
  {
    name: "arbitrumSepolia",
    chainId: 421614,
    isMainnet: false,
    rpcEnv: "ARBITRUM_SEPOLIA_RPC_URL",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_ARB_SEPOLIA",
    lockerEnv: "NEXT_PUBLIC_LOCKER_ARB_SEPOLIA",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_ARB_SEPOLIA",
    wormholeChainId: 10003,
    wormholeCore: "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
    testnetDex: true,
    wrappedNative: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
  },
  {
    name: "baseSepolia",
    chainId: 84532,
    isMainnet: false,
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    rpc: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    factoryEnv: "NEXT_PUBLIC_FACTORY_BASE_SEPOLIA",
    lockerEnv: "NEXT_PUBLIC_LOCKER_BASE_SEPOLIA",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_BASE_SEPOLIA",
    wormholeChainId: 10004,
    wormholeCore: "0x79A1027a6A159502049F10906D333EC57E95F083",
    testnetDex: true,
    wrappedNative: "0x4200000000000000000000000000000000000006",
  },
  {
    name: "optimismSepolia",
    chainId: 11155420,
    isMainnet: false,
    rpcEnv: "OPTIMISM_SEPOLIA_RPC_URL",
    rpc: "https://sepolia.optimism.io",
    explorer: "https://sepolia-optimism.etherscan.io",
    factoryEnv: "NEXT_PUBLIC_FACTORY_OP_SEPOLIA",
    lockerEnv: "NEXT_PUBLIC_LOCKER_OP_SEPOLIA",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_OP_SEPOLIA",
    wormholeChainId: 10005,
    wormholeCore: "0x31377888146f3253211EFEf5c676D41ECe7D58Fe",
    testnetDex: true,
    wrappedNative: "0x4200000000000000000000000000000000000006",
  },
  {
    name: "polygonMumbai",
    chainId: 80001,
    isMainnet: false,
    rpcEnv: "POLYGON_MUMBAI_RPC_URL",
    rpc: "https://polygon-mumbai-bor-rpc.publicnode.com",
    explorer: "https://mumbai.polygonscan.com",
    factoryEnv: "NEXT_PUBLIC_FACTORY_POLYGON_MUMBAI",
    lockerEnv: "NEXT_PUBLIC_LOCKER_POLYGON_MUMBAI",
    receiverEnv: "NEXT_PUBLIC_RECEIVER_POLYGON_MUMBAI",
    testnetDex: false,
    unavailable: "Polygon Mumbai is shut down. Use polygonAmoy.",
  },
];

export function networkByName(name: string): NetworkSpec {
  const spec = NETWORKS.find((n) => n.name === name);
  if (!spec) {
    throw new Error(`No catalog entry for network "${name}".`);
  }
  return spec;
}
