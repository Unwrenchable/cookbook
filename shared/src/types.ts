/**
 * types.ts – Shared TypeScript types for TokenForge.
 */

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
  [TokenFlavor.AIAgent]:       "AI Agent Token",
  [TokenFlavor.PolitiFi]:      "PolitiFi (Prediction Market)",
  [TokenFlavor.UtilityHybrid]: "Utility Hybrid (Staking + Burns)",
  [TokenFlavor.PumpMigrate]:   "Pump → CEX (Graduation)",
};

export interface TokenFormData {
  name:            string;
  symbol:          string;
  totalSupply:     number;
  decimals:        number;
  flavor:          TokenFlavor;
  buyTaxBps:       number;
  sellTaxBps:      number;
  marketingWallet: string;
  burnBps:         number;
  reflectionBps:   number;
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

export interface DeployedToken {
  address:     string;
  txHash:      string;
  chainId:     number;
  name:        string;
  symbol:      string;
  totalSupply: number;
  flavor:      TokenFlavor;
  deployedAt:  number;
}
