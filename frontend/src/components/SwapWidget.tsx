/**
 * SwapWidget.tsx – Quick-launch swap links for each chain's primary DEX,
 * plus a simple token-pair input for pre-filling the DEX URL.
 *
 * v1: Opens the right DEX in a new tab with the token address pre-filled.
 * v2 (planned): Direct on-chain swap via the DEX router.
 */
"use client";

import { useState } from "react";
import { useChainId } from "wagmi";

// Per-chain DEX config
interface DexConfig {
  name:    string;
  logo:    string;
  url:     (tokenIn: string, tokenOut: string, chain: DexChainKey) => string;
  chains:  number[];
}

type DexChainKey = "ethereum" | "bsc" | "polygon" | "arbitrum" | "base" | "avalanche";

const CHAIN_ID_TO_DEX_KEY: Record<number, DexChainKey> = {
  1:     "ethereum",
  11155111: "ethereum",
  56:    "bsc",
  97:    "bsc",
  137:   "polygon",
  80001: "polygon",
  42161: "arbitrum",
  421614:"arbitrum",
  8453:  "base",
  84532: "base",
  43114: "avalanche",
};

// Native / common token addresses per chain (for the "from" default)
const NATIVE_WRAPPED: Record<DexChainKey, string> = {
  ethereum:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  bsc:       "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  polygon:   "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
  arbitrum:  "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
  base:      "0x4200000000000000000000000000000000000006", // WETH
  avalanche: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
};

const DEXES: DexConfig[] = [
  {
    name:   "Uniswap",
    logo:   "🦄",
    chains: [1, 11155111, 137, 80001, 42161, 421614, 8453, 84532],
    url: (tokenIn, tokenOut, chain) => {
      const base = chain === "base" ? "https://app.uniswap.org/swap" : "https://app.uniswap.org/swap";
      return `${base}?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`;
    },
  },
  {
    name:   "PancakeSwap",
    logo:   "🥞",
    chains: [56, 97, 1, 8453],
    url: (tokenIn, tokenOut) =>
      `https://pancakeswap.finance/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "Trader Joe",
    logo:   "🎰",
    chains: [43114],
    url: (tokenIn, tokenOut) =>
      `https://traderjoexyz.com/avalanche/trade?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "QuickSwap",
    logo:   "⚡",
    chains: [137, 80001],
    url: (tokenIn, tokenOut) =>
      `https://quickswap.exchange/#/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "Camelot",
    logo:   "⚔️",
    chains: [42161, 421614],
    url: (tokenIn, tokenOut) =>
      `https://app.camelot.exchange/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "Aerodrome",
    logo:   "🚀",
    chains: [8453, 84532],
    url: (tokenIn, tokenOut) =>
      `https://aerodrome.finance/swap?from=${tokenIn}&to=${tokenOut}`,
  },
];

const inputCls =
  "block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function SwapWidget() {
  const chainId = useChainId();
  const dexKey  = CHAIN_ID_TO_DEX_KEY[chainId] ?? "ethereum";

  const nativeWrapped = NATIVE_WRAPPED[dexKey];
  const [tokenIn,  setTokenIn]  = useState(nativeWrapped);
  const [tokenOut, setTokenOut] = useState("");

  const availableDexes = DEXES.filter((d) => d.chains.includes(chainId));

  function swapTokens() {
    const tmp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(tmp);
  }

  return (
    <div className="space-y-5">
      {/* Token pair inputs */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">From token</label>
        <input
          type="text"
          value={tokenIn}
          onChange={(e) => setTokenIn(e.target.value)}
          placeholder="0x... or paste token address"
          className={inputCls}
        />
      </div>

      {/* Swap arrow */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={swapTokens}
          className="rounded-full border border-dark-border bg-dark-card p-2 text-gray-400 hover:text-brand-400 hover:border-brand-600 transition-colors"
          title="Swap direction"
        >
          ⇅
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">To token</label>
        <input
          type="text"
          value={tokenOut}
          onChange={(e) => setTokenOut(e.target.value)}
          placeholder="0x... paste your newly launched token"
          className={inputCls}
        />
        {!tokenOut && (
          <p className="text-xs text-gray-500">
            Paste the token address you just deployed to pre-fill the DEX URL.
          </p>
        )}
      </div>

      {/* DEX buttons */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-300">
          Open on {availableDexes.length === 0 ? "a DEX" : "your preferred DEX"}
        </p>

        {availableDexes.length === 0 ? (
          <p className="text-sm text-gray-500">No DEX configured for chain {chainId} yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {availableDexes.map((dex) => {
              const href = dex.url(
                tokenIn  || nativeWrapped,
                tokenOut || nativeWrapped,
                dexKey,
              );
              return (
                <a
                  key={dex.name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-medium text-white hover:border-brand-500 hover:bg-brand-500/10 transition-colors"
                >
                  <span className="text-lg">{dex.logo}</span>
                  {dex.name}
                  <span className="text-xs text-gray-500">↗</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Coming soon note */}
      <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-400">🔧 Native swap coming in v2</p>
        <p>
          On-chain swap via DEX router (no redirect) will be added in the next release.
          For now, click any DEX above — your token addresses are pre-filled in the URL.
        </p>
      </div>
    </div>
  );
}
