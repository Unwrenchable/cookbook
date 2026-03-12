/**
 * ListingHelper.tsx – Post-deploy helper for submitting tokens to listing sites.
 */
"use client";

import { useState } from "react";

interface Props {
  tokenAddress: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
}

const LISTINGS = [
  {
    name: "DexTools",
    logo: "🔧",
    url: "https://www.dextools.io/app/token/request",
    description: "Fast indexing, chart tools",
  },
  {
    name: "CoinMarketCap",
    logo: "📊",
    url: "https://coinmarketcap.com/request/",
    description: "Largest crypto data site",
  },
  {
    name: "CoinGecko",
    logo: "🦎",
    url: "https://www.coingecko.com/en/coins/new",
    description: "Trusted price tracker",
  },
];

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  11155111: "Sepolia",
  56: "BSC",
  97: "BSC Testnet",
  137: "Polygon",
  42161: "Arbitrum",
  8453: "Base",
  43114: "Avalanche",
};

export function ListingHelper({ tokenAddress, chainId, tokenName, tokenSymbol }: Props) {
  const [copied, setCopied] = useState(false);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  async function copyAddress() {
    await navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-200">📋 Submit Your Token Listing</h3>

      {/* Token address */}
      <div className="flex items-center gap-2 rounded-xl border border-dark-border bg-dark-muted px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">
            {tokenName ? `${tokenName} (${tokenSymbol}) · ` : ""}{chainName}
          </p>
          <code className="block truncate text-xs text-white font-mono">{tokenAddress}</code>
        </div>
        <button
          type="button"
          onClick={copyAddress}
          className="shrink-0 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-xs text-gray-300 hover:border-brand-500 hover:text-brand-400 transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Listing sites */}
      <div className="grid gap-2 sm:grid-cols-3">
        {LISTINGS.map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1 rounded-xl border border-dark-border bg-dark-card p-4 hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
          >
            <span className="text-xl">{l.logo}</span>
            <span className="text-sm font-semibold text-white">{l.name} ↗</span>
            <span className="text-xs text-gray-500">{l.description}</span>
          </a>
        ))}
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 space-y-2 text-xs text-gray-400">
        <p className="font-semibold text-gray-300 mb-2">✅ What to prepare for listing</p>
        <CheckItem text="Logo: 200×200 PNG with transparent background" />
        <CheckItem text="Website or landing page URL" />
        <CheckItem text="Whitepaper or one-pager (can be a Notion doc)" />
        <CheckItem text="Twitter / Telegram / Discord links" />
        <CheckItem text="Contract address + chain verified on block explorer" />
        <CheckItem text="Brief project description (≤ 200 words)" />
      </div>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-brand-400 shrink-0">▸</span>
      <span>{text}</span>
    </div>
  );
}
