/**
 * types.ts – Shared TypeScript types for TokenForge (frontend + scripts).
 */

// ─── Token Flavors ────────────────────────────────────────────────────────────

export enum TokenFlavor {
  Standard     = 0,
  Taxable      = 1,
  Deflationary = 2,
  Reflection   = 3,
  BondingCurve = 4,
}

export const TOKEN_FLAVOR_LABELS: Record<TokenFlavor, string> = {
  [TokenFlavor.Standard]:     "Standard ERC20",
  [TokenFlavor.Taxable]:      "Taxable (Buy/Sell Tax)",
  [TokenFlavor.Deflationary]: "Deflationary (Auto-Burn)",
  [TokenFlavor.Reflection]:   "Reflection (Redistribution)",
  [TokenFlavor.BondingCurve]: "Bonding Curve (Meme / pump.fun)",
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
  // Burn (Deflationary flavor)
  burnBps:         number;
  // Reflection flavor
  reflectionBps:   number;
  // Liquidity
  liquidityBps:    number;
}

export const DEFAULT_FORM_DATA: TokenFormData = {
  name:            "",
  symbol:          "",
  totalSupply:     1_000_000,
  decimals:        18,
  flavor:          TokenFlavor.Standard,
  buyTaxBps:       0,
  sellTaxBps:      0,
  marketingWallet: "",
  burnBps:         0,
  reflectionBps:   0,
  liquidityBps:    0,
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
