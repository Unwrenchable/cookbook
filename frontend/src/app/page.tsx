/**
 * app/page.tsx – Main launcher page.
 */
"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useNetwork } from "wagmi";
import { ChainSelector } from "@/components/ChainSelector";
import { TokenForm } from "@/components/TokenForm";
import { DeployResult } from "@/components/DeployResult";
import { TokenDashboard } from "@/components/TokenDashboard";
import { useDeployToken } from "@/hooks/useDeployToken";
import { getChainById } from "@/lib/chains";
import type { TokenFormData } from "@/lib/types";

export default function HomePage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const chainConfig = getChainById(chainId);

  const { deploy, isPending, error, deployResult, launchFee } = useDeployToken();

  const [activeTab, setActiveTab] = useState<"launch" | "dashboard">("launch");

  async function handleDeploy(formData: TokenFormData) {
    try {
      await deploy(formData);
    } catch {
      // error is captured in the hook
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚒️</span>
            <span className="text-xl font-bold text-gray-900">TokenForge</span>
            <span className="hidden rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 sm:inline">
              Multi-Chain
            </span>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white py-10 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Launch your token in{" "}
          <span className="text-brand-600">&lt; 60 seconds</span>
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          No code. No trust. Factory pattern. EVM chains + Solana coming soon.
        </p>
      </section>

      {/* ─── Main content ───────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit">
          {(["launch", "dashboard"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "launch" ? "🚀 Launch" : "📋 My Tokens"}
            </button>
          ))}
        </div>

        {activeTab === "launch" ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column: chain selector */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">1. Select Network</h2>
              <ChainSelector />
            </div>

            {/* Right column: form or result */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">2. Configure &amp; Deploy</h2>

              {!isConnected ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center space-y-3">
                  <p className="text-gray-500 text-sm">Connect your wallet to get started.</p>
                  <ConnectButton />
                </div>
              ) : deployResult ? (
                <DeployResult
                  result={deployResult}
                  chainId={chainId}
                  onReset={() => window.location.reload()}
                />
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  {!chainConfig?.factoryAddress && (
                    <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                      ⚠️ No factory deployed on <strong>{chainConfig?.name ?? `chain ${chainId}`}</strong> yet. Switch to a supported network or deploy the factory first.
                    </div>
                  )}
                  {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error.message}
                    </div>
                  )}
                  <TokenForm
                    onSubmit={handleDeploy}
                    isSubmitting={isPending}
                    launchFee={launchFee as bigint | undefined}
                    nativeCurrencySymbol={chainConfig?.nativeCurrency.symbol ?? "ETH"}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">My Deployed Tokens</h2>
            <TokenDashboard />
          </div>
        )}
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        TokenForge · Built for degens who want to ship in 60 seconds ·{" "}
        <a
          href="https://github.com/Unwrenchable/cookbook"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
