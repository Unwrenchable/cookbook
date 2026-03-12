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
  solana:    1,
  ethereum:  2,
  bsc:       4,
  polygon:   5,
  avalanche: 6,
  arbitrum:  23,
  base:      30,
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
  // ── Testnets ─────────────────────────────────────────────────────────────────
  {
    evmChainId:      11155111,
    wormholeChainId: WORMHOLE_CHAIN_IDS.ethereum,
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
    wormholeCore:    "0x68605AD7b15c732a30b1BbC62BE8425E9Bb182E9",
    isTestnet:       true,
  },
];

export const MAINNET_TARGETS = CROSS_CHAIN_TARGETS.filter((t) => !t.isTestnet);
export const TESTNET_TARGETS = CROSS_CHAIN_TARGETS.filter((t) =>  t.isTestnet);

export function getTargetByEvmChainId(id: number): CrossChainTarget | undefined {
  return CROSS_CHAIN_TARGETS.find((t) => t.evmChainId === id);
}

// ─── Wormhole REST API (used by the auto-relayer fetch) ───────────────────────

export const WORMHOLE_API = {
  mainnet: "https://api.wormholescan.io",
  testnet: "https://api.testnet.wormholescan.io",
};

export const SOLANA_TOKEN_BURN_BRIDGE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID ??
  // System program ID is used as a safe placeholder — set the real program ID
  // in .env.local after running `anchor build` in contracts/solana/
  "11111111111111111111111111111111";
