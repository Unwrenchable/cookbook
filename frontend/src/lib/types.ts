/**
 * types.ts – Shared TypeScript types for TokenForge (frontend + scripts).
 */

// ─── Token Flavors ────────────────────────────────────────────────────────────

export enum TokenFlavor {
  Standard      = 0,
  Taxable       = 1,
  Deflationary  = 2,
  Reflection    = 3,
  BondingCurve  = 4,
  AIAgent       = 5,
  PolitiFi      = 6,
  UtilityHybrid = 7,
  PumpMigrate   = 8,
}

export const TOKEN_FLAVOR_LABELS: Record<TokenFlavor, string> = {
  [TokenFlavor.Standard]:      "Standard ERC20",
  [TokenFlavor.Taxable]:       "Taxable (Buy/Sell Tax)",
  [TokenFlavor.Deflationary]:  "Deflationary (Auto-Burn)",
  [TokenFlavor.Reflection]:    "Reflection (Redistribution)",
  [TokenFlavor.BondingCurve]:  "Bonding Curve (Meme / pump.fun)",
  [TokenFlavor.AIAgent]:       "🤖 AI Agent Token",
  [TokenFlavor.PolitiFi]:      "🏛️ PolitiFi (Prediction Market)",
  [TokenFlavor.UtilityHybrid]: "⚙️ Utility Hybrid (Staking + Burns)",
  [TokenFlavor.PumpMigrate]:   "📈 Pump → CEX (Graduation)",
};

export const TOKEN_FLAVOR_DESCRIPTIONS: Record<TokenFlavor, string> = {
  [TokenFlavor.Standard]:      "Plain transferable ERC20 token.",
  [TokenFlavor.Taxable]:       "Configurable buy/sell tax sent to a marketing wallet.",
  [TokenFlavor.Deflationary]:  "Auto-burns a % of every transfer. Forever deflationary.",
  [TokenFlavor.Reflection]:    "Redistributes a % of every transfer to all holders.",
  [TokenFlavor.BondingCurve]:  "Pump.fun-style: price rises as supply increases.",
  [TokenFlavor.AIAgent]:       "On-chain AI agent wallet can auto-burn, redistribute, and post memes within safety caps.",
  [TokenFlavor.PolitiFi]:      "Binary prediction market: YES/NO sides, prize pool for winners, burn for losers.",
  [TokenFlavor.UtilityHybrid]: "Built-in staking (APY), auto-burn, enforced team wallet cap, and governance voting.",
  [TokenFlavor.PumpMigrate]:   "Bonding curve that graduates to CEX when the ETH threshold is hit. Auto-pauses 24h for LP setup.",
};

// ─── Form Data ────────────────────────────────────────────────────────────────

export interface TokenFormData {
  // Core
  name:            string;
  symbol:          string;
  totalSupply:     number;
  decimals:        number;
  flavor:          TokenFlavor;
  // Tax (Taxable flavor)
  buyTaxBps:       number;   // basis points, 100 = 1 %
  sellTaxBps:      number;
  marketingWallet: string;
  // Burn (Deflationary / UtilityHybrid)
  burnBps:         number;
  // Reflection flavor
  reflectionBps:   number;
  // Liquidity
  liquidityBps:    number;
  // AI Agent flavor
  agentWallet:     string;
  agentBurnCapBps: number;
  // PolitiFi flavor
  predictionFeeBps: number;
  loserBurnBps:    number;
  // UtilityHybrid
  rewardRateBps:   number;
  teamCapBps:      number;
  // PumpMigrate
  graduationThresholdEth: number;
  tradingFeeBps:   number;
}

export const DEFAULT_FORM_DATA: TokenFormData = {
  name:                   "",
  symbol:                 "",
  totalSupply:            1_000_000,
  decimals:               18,
  flavor:                 TokenFlavor.Standard,
  buyTaxBps:              0,
  sellTaxBps:             0,
  marketingWallet:        "",
  burnBps:                0,
  reflectionBps:          0,
  liquidityBps:           0,
  agentWallet:            "",
  agentBurnCapBps:        100,
  predictionFeeBps:       100,
  loserBurnBps:           2000,
  rewardRateBps:          10,
  teamCapBps:             500,
  graduationThresholdEth: 0.085,
  tradingFeeBps:          100,
};

// ─── Deployed Token ───────────────────────────────────────────────────────────

export interface DeployedToken {
  address:     string;
  txHash:      string;
  chainId:     number;
  name:        string;
  symbol:      string;
  totalSupply: number;
  flavor:      TokenFlavor;
  deployedAt:  number; // Unix timestamp
}

// ─── Chain Config (mirrors frontend/src/lib/chains.ts) ────────────────────────

export interface ChainConfig {
  id:             number;
  name:           string;
  shortName:      string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl:         string;
  blockExplorer:  string;
  isTestnet:      boolean;
  factoryAddress: string;
}

