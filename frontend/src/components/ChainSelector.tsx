/**
 * ChainSelector.tsx – Visual network selector with testnet/mainnet toggle.
 */
"use client";

import { useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { TESTNET_CHAINS, MAINNET_CHAINS } from "@/lib/chains";

// Chain visual metadata
const CHAIN_ICON: Record<number, string> = {
  // Testnets
  11155111: "Ξ",   // Sepolia
  97:       "🔶",  // BSC Testnet
  80002:    "💜",  // Polygon Amoy
  421614:   "🔵",  // Arbitrum Sepolia
  84532:    "⬡",   // Base Sepolia
  11155420: "🔴",  // Optimism Sepolia
  // Mainnets
  1:     "Ξ",   // Ethereum
  56:    "🔶",  // BSC
  137:   "💜",  // Polygon
  42161: "🔵",  // Arbitrum
  8453:  "⬡",   // Base
  43114: "🔺",  // Avalanche
  10:    "🔴",  // Optimism
};

const CHAIN_SHORT: Record<number, string> = {
  11155111: "Sepolia",
  97:       "BSC Test",
  80002:    "Amoy",
  421614:   "Arb Sep",
  84532:    "Base Sep",
  11155420: "OP Sep",
  1:     "Ethereum",
  56:    "BNB Chain",
  137:   "Polygon",
  42161: "Arbitrum",
  8453:  "Base",
  43114: "Avalanche",
  10:    "Optimism",
};

export function ChainSelector() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [showTestnets, setShowTestnets] = useState(false);

  const chains = showTestnets ? TESTNET_CHAINS : MAINNET_CHAINS;

  return (
    <div className="flex flex-col gap-4">
      {/* Testnet / Mainnet toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Network Mode
        </span>
        <button
          type="button"
          onClick={() => setShowTestnets((v) => !v)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
            showTestnets
              ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
              : "border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20"
          }`}
          aria-label="Toggle testnet mode"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              showTestnets ? "bg-yellow-400 animate-pulse" : "bg-brand-400"
            }`}
          />
          {showTestnets ? "🧪 Testnet" : "🌐 Mainnet"}
        </button>
      </div>

      {/* Chain grid */}
      <div className="grid grid-cols-2 gap-2">
        {chains.map((chain) => {
          const isActive = chainId === chain.id;
          const icon = CHAIN_ICON[chain.id] ?? "🔗";
          const short = CHAIN_SHORT[chain.id] ?? chain.name;
          const hasFactory = Boolean(chain.factoryAddress);

          return (
            <button
              key={chain.id}
              type="button"
              disabled={isPending}
              onClick={() => switchChain({ chainId: chain.id })}
              className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all disabled:opacity-50 ${
                isActive
                  ? "border-brand-500/50 bg-brand-500/15 text-brand-300 glow-neon"
                  : "border-dark-border bg-dark-card text-gray-400 hover:border-brand-500/30 hover:bg-dark-muted hover:text-gray-200"
              }`}
            >
              {/* Chain icon */}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${
                  isActive
                    ? "bg-brand-500/20 text-brand-300"
                    : "bg-dark-muted text-gray-300"
                }`}
              >
                {icon}
              </span>

              {/* Chain name */}
              <div className="min-w-0">
                <p className="truncate leading-tight text-xs font-semibold">{short}</p>
                {isActive && (
                  <p className="text-[9px] text-brand-500 leading-tight mt-0.5">Connected</p>
                )}
              </div>

              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              )}

              {/* No factory badge */}
              {!hasFactory && (
                <span className="absolute bottom-1 right-1.5 text-[8px] text-gray-600">soon</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Testnet info */}
      {showTestnets && (
        <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          🧪 You&apos;re in testnet mode. Tokens are free but not real.
        </div>
      )}
    </div>
  );
}
