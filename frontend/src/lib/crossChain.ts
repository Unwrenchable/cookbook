/**
 * crossChain.ts – Cross-chain burn-to-activate configuration for TokenForge.
 *
 * Mechanic:
 *   1. User burns SPL tokens on Solana via `token-burn-bridge` Anchor program.
 *   2. Wormhole guardians produce a VAA.
 *   3. Relayer (or user) submits VAA to BurnBridgeReceiver on the target EVM chain.
 *   4. ERC20 tokens are minted to the EVM recipient.
 *
 * Burn tiers:
 *   ≥  100 tokens → activate 1 EVM chain
 *   ≥  500 tokens → activate 3 EVM chains
 *   ≥ 1000 tokens → activate all chains
 */

// ─── Wormhole chain IDs ───────────────────────────────────────────────────────

export const WORMHOLE_CHAIN_IDS = {
  solana:           1,
  ethereum:         2,
  bsc:              4,
  polygon:          5,
  avalanche:        6,
  arbitrum:         23,
  optimism:         24,
  base:             30,
  // Replaced testnets have their own Wormhole ids. BSC testnet stays on 4.
  // https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/utils/consts.ts
  sepolia:          10002,
  arbitrumSepolia:  10003,
  baseSepolia:      10004,
  optimismSepolia:  10005,
  polygonAmoy:      10007,
} as const;

export type WormholeChainId = typeof WORMHOLE_CHAIN_IDS[keyof typeof WORMHOLE_CHAIN_IDS];

// ─── Burn tiers ───────────────────────────────────────────────────────────────

export const BURN_TIERS = [
  {
    minBurn:         100,
    chainsActivated: 1,
    label:           "Spark",
    description:     "Burn 100 tokens to activate 1 EVM chain",
    color:           "yellow",
  },
  {
    minBurn:         500,
    chainsActivated: 3,
    label:           "Blaze",
    description:     "Burn 500 tokens to activate 3 EVM chains",
    color:           "orange",
  },
  {
    minBurn:         1000,
    chainsActivated: Infinity,
    label:           "Inferno",
    description:     "Burn 1,000 tokens to activate ALL chains",
    color:           "red",
  },
] as const;

export function getBurnTier(burnAmount: number) {
  const sorted = [...BURN_TIERS].reverse();
  return sorted.find((t) => burnAmount >= t.minBurn) ?? null;
}

// ─── EVM chain configs with Wormhole IDs ──────────────────────────────────────

export interface CrossChainTarget {
  evmChainId:        number;
  wormholeChainId:   WormholeChainId;
  name:              string;
  shortName:         string;
  /** BurnBridgeReceiver contract address (post-deploy) */
  receiverAddress:   `0x${string}` | "";
  /** Wormhole core bridge on this EVM chain */
  wormholeCore:      `0x${string}`;
  isTestnet:         boolean;
}

export const CROSS_CHAIN_TARGETS: CrossChainTarget[] = [
  // ── Mainnets ────────────────────────────────────────────────────────────────
  {
    evmChainId:      1,
    wormholeChainId: WORMHOLE_CHAIN_IDS.ethereum,
    name:            "Ethereum",
    shortName:       "mainnet",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_MAINNET as `0x${string}`) || "",
    wormholeCore:    "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    isTestnet:       false,
  },
  {
    evmChainId:      56,
    wormholeChainId: WORMHOLE_CHAIN_IDS.bsc,
    name:            "BNB Chain",
    shortName:       "bsc",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_BSC as `0x${string}`) || "",
    wormholeCore:    "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    isTestnet:       false,
  },
  {
    evmChainId:      137,
    wormholeChainId: WORMHOLE_CHAIN_IDS.polygon,
    name:            "Polygon",
    shortName:       "polygon",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_POLYGON as `0x${string}`) || "",
    wormholeCore:    "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
    isTestnet:       false,
  },
  {
    evmChainId:      42161,
    wormholeChainId: WORMHOLE_CHAIN_IDS.arbitrum,
    name:            "Arbitrum One",
    shortName:       "arbitrum",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_ARBITRUM as `0x${string}`) || "",
    wormholeCore:    "0xa5f208e072434bC67592E4C49C1B991BA79BCA46",
    isTestnet:       false,
  },
  {
    evmChainId:      8453,
    wormholeChainId: WORMHOLE_CHAIN_IDS.base,
    name:            "Base",
    shortName:       "base",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_BASE as `0x${string}`) || "",
    wormholeCore:    "0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6",
    isTestnet:       false,
  },
  {
    evmChainId:      43114,
    wormholeChainId: WORMHOLE_CHAIN_IDS.avalanche,
    name:            "Avalanche",
    shortName:       "avalanche",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_AVALANCHE as `0x${string}`) || "",
    wormholeCore:    "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
    isTestnet:       false,
  },
  {
    evmChainId:      10,
    wormholeChainId: WORMHOLE_CHAIN_IDS.optimism,
    name:            "OP Mainnet",
    shortName:       "optimism",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_OPTIMISM as `0x${string}`) || "",
    wormholeCore:    "0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722",
    isTestnet:       false,
  },
  // ── Testnets ─────────────────────────────────────────────────────────────────
  {
    evmChainId:      11155111,
    wormholeChainId: WORMHOLE_CHAIN_IDS.sepolia,
    name:            "Ethereum Sepolia",
    shortName:       "sepolia",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_SEPOLIA as `0x${string}`) || "",
    wormholeCore:    "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
    isTestnet:       true,
  },
  {
    evmChainId:      97,
    wormholeChainId: WORMHOLE_CHAIN_IDS.bsc,
    name:            "BNB Testnet",
    shortName:       "bscTestnet",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_BSC_TESTNET as `0x${string}`) || "",
    wormholeCore:    "0x68605AD7b15c732a30b1BbC62BE8F2A509D74b4D",
    isTestnet:       true,
  },
  {
    evmChainId:      80002,
    wormholeChainId: WORMHOLE_CHAIN_IDS.polygonAmoy,
    name:            "Polygon Amoy",
    shortName:       "polygonAmoy",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_POLYGON_AMOY as `0x${string}`) || "",
    wormholeCore:    "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
    isTestnet:       true,
  },
  {
    evmChainId:      421614,
    wormholeChainId: WORMHOLE_CHAIN_IDS.arbitrumSepolia,
    name:            "Arbitrum Sepolia",
    shortName:       "arbitrumSepolia",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_ARB_SEPOLIA as `0x${string}`) || "",
    wormholeCore:    "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
    isTestnet:       true,
  },
  {
    evmChainId:      84532,
    wormholeChainId: WORMHOLE_CHAIN_IDS.baseSepolia,
    name:            "Base Sepolia",
    shortName:       "baseSepolia",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_BASE_SEPOLIA as `0x${string}`) || "",
    wormholeCore:    "0x79A1027a6A159502049F10906D333EC57E95F083",
    isTestnet:       true,
  },
  {
    evmChainId:      11155420,
    wormholeChainId: WORMHOLE_CHAIN_IDS.optimismSepolia,
    name:            "OP Sepolia",
    shortName:       "optimismSepolia",
    receiverAddress: (process.env.NEXT_PUBLIC_RECEIVER_OP_SEPOLIA as `0x${string}`) || "",
    wormholeCore:    "0x31377888146f3253211EFEf5c676D41ECe7D58Fe",
    isTestnet:       true,
  },
];

export const MAINNET_TARGETS = CROSS_CHAIN_TARGETS.filter((t) => !t.isTestnet);
export const TESTNET_TARGETS = CROSS_CHAIN_TARGETS.filter((t) =>  t.isTestnet);

export function getTargetByEvmChainId(id: number): CrossChainTarget | undefined {
  return CROSS_CHAIN_TARGETS.find((t) => t.evmChainId === id);
}

// ─── WormholeScan API (VAA lookup before the wallet calls receiveMessage) ────

export const WORMHOLE_API = {
  mainnet: "https://api.wormholescan.io",
  testnet: "https://api.testnet.wormholescan.io",
};

export const SOLANA_TOKEN_BURN_BRIDGE_PROGRAM_ID =
  // `||` instead of `??` so an empty-string env var also falls back to the
  // System program ID placeholder — safe no-op address used until
  // `anchor deploy` provides the real program ID in .env.local.
  process.env.NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID ||
  "11111111111111111111111111111111";
