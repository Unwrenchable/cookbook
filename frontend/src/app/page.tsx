/**
 * app/page.tsx – Main launcher page.
 */
"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { ChainSelector } from "@/components/ChainSelector";
import { TokenForm } from "@/components/TokenForm";
import { DeployResult } from "@/components/DeployResult";
import { TokenDashboard } from "@/components/TokenDashboard";
import { SolanaLaunchPanel } from "@/components/SolanaLaunchPanel";
import { useDeployToken } from "@/hooks/useDeployToken";
import { getChainById } from "@/lib/chains";
import type { TokenFormData } from "@/lib/types";

type Tab = "evm" | "solana-bridge" | "dashboard";

export default function HomePage() {
  const { isConnected } = useAccount();
  const chainId      = useChainId();
  const chainConfig  = getChainById(chainId);

  const { deploy, isPending, error, deployResult, launchFee } = useDeployToken();

  const [activeTab,   setActiveTab]   = useState<Tab>("evm");
  const [isTestnet,   setIsTestnet]   = useState(false);

  async function handleDeploy(formData: TokenFormData) {
    try {
      await deploy(formData);
    } catch {
      // error is captured in the hook
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "evm",           label: "🚀 EVM Launch"        },
    { id: "solana-bridge", label: "🔥 Solana → All Chains" },
    { id: "dashboard",     label: "📋 My Tokens"          },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚒️</span>
            <span className="text-xl font-bold text-gray-900">TokenForge</span>
            <span className="hidden rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 sm:inline">
              Multi-Chain
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Global testnet toggle */}
            <button
              type="button"
              onClick={() => setIsTestnet((v) => !v)}
              className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                isTestnet
                  ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
            >
              {isTestnet ? "🧪 Testnet" : "🌐 Mainnet"}
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white py-10 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Launch your token in{" "}
          <span className="text-brand-600">&lt; 60 seconds</span>
        </h1>
        <p className="mt-3 text-lg text-gray-500 max-w-xl mx-auto">
          No code. No trust. EVM factory pattern or Solana-first burn-to-activate across every chain.
        </p>
        {/* Cross-chain explainer pills */}
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-gray-500">
          {["Ethereum", "BSC", "Polygon", "Arbitrum", "Base", "Avalanche", "Solana"].map((c) => (
            <span key={c} className="rounded-full border border-gray-200 bg-white px-3 py-1">{c}</span>
          ))}
        </div>
      </section>

      {/* ─── Main ─────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit flex-wrap">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── EVM Launch ──────────────────────────────────────────────────── */}
        {activeTab === "evm" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">1. Select Network</h2>
              <ChainSelector />
            </div>
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
                      ⚠️ No factory on <strong>{chainConfig?.name ?? `chain ${chainId}`}</strong> yet.
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
        )}

        {/* ── Solana-first Bridge ─────────────────────────────────────────── */}
        {activeTab === "solana-bridge" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">How it works</h2>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 space-y-3">
                <Step n={1} text="Hold SPL tokens on Solana" />
                <Step n={2} text="Burn tokens → Wormhole emits a VAA" />
                <Step n={3} text="VAA is relayed to your chosen EVM chains" />
                <Step n={4} text="ERC20 tokens minted to your EVM address" />
                <div className="mt-2 rounded-lg bg-orange-50 border border-orange-200 p-3 text-xs text-orange-700">
                  <strong>Burn tiers:</strong><br />
                  100 tokens → 1 chain<br />
                  500 tokens → 3 chains<br />
                  1,000 tokens → all chains
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <SolanaLaunchPanel isTestnet={isTestnet} />
              </div>
            </div>
          </div>
        )}

        {/* ── Dashboard ───────────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">My Deployed Tokens</h2>
            <TokenDashboard />
          </div>
        )}
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        TokenForge · Solana burns activate every chain ·{" "}
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

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
        {n}
      </span>
      <span>{text}</span>
    </div>
  );
}
