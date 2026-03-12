/**
 * ChainSelector.tsx – Network selector with testnet/mainnet toggle.
 */
"use client";

import { useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { TESTNET_CHAINS, MAINNET_CHAINS } from "@/lib/chains";

export function ChainSelector() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [showTestnets, setShowTestnets] = useState(false);

  const chains = showTestnets ? TESTNET_CHAINS : MAINNET_CHAINS;

  return (
    <div className="flex flex-col gap-3">
      {/* Testnet / Mainnet toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Network:</span>
        <button
          type="button"
          onClick={() => setShowTestnets((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
            showTestnets ? "bg-yellow-400" : "bg-brand-500"
          }`}
          aria-label="Toggle testnet mode"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              showTestnets ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-gray-500">
          {showTestnets ? "🧪 Testnet" : "🟢 Mainnet"}
        </span>
      </div>

      {/* Chain grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {chains.map((chain) => {
          const isActive = chainId === chain.id;
          return (
            <button
              key={chain.id}
              type="button"
              disabled={isPending}
              onClick={() => switchChain({ chainId: chain.id })}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50"
              } disabled:opacity-50`}
            >
              <span>{chain.name}</span>
              {!chain.factoryAddress && (
                <span className="ml-auto rounded bg-gray-100 px-1 text-xs text-gray-400">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
