/**
 * app/page.tsx – GOONFORGE.XYZ main launcher page.
 */
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { ChainSelector } from "@/components/ChainSelector";
import { TokenForm } from "@/components/TokenForm";
import { DeployResult } from "@/components/DeployResult";
import { TokenDashboard } from "@/components/TokenDashboard";
import { SolanaLaunchPanel } from "@/components/SolanaLaunchPanel";
import { VanityAddressGenerator } from "@/components/VanityAddressGenerator";
import { LPLockerPanel } from "@/components/LPLockerPanel";
import { SwapWidget } from "@/components/SwapWidget";
import { ReferralPanel } from "@/components/ReferralPanel";
import { useDeployToken } from "@/hooks/useDeployToken";
import { getChainById } from "@/lib/chains";
import { useNetwork } from "@/lib/networkContext";
import type { TokenFormData } from "@/lib/types";

type Tab = "evm" | "solana-bridge" | "lock" | "swap" | "vanity" | "dashboard" | "referral";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const { isConnected } = useAccount();
  const chainId      = useChainId();
  const chainConfig  = getChainById(chainId);
  const searchParams = useSearchParams();

  // Read referral address from ?ref= query param
  const referrer = searchParams?.get("ref") ?? undefined;

  const { deploy, isPending, error, deployResult, launchFee } = useDeployToken();

  const { isTestnet, setIsTestnet } = useNetwork();
  const [activeTab,  setActiveTab]  = useState<Tab>("evm");
  const [lastFormData, setLastFormData] = useState<TokenFormData | null>(null);

  async function handleDeploy(formData: TokenFormData) {
    setLastFormData(formData);
    try {
      await deploy(formData, referrer);
    } catch {
      // error captured in hook
    }
  }

  const primaryTabs: { id: Tab; label: string }[] = [
    { id: "evm",           label: "🚀 Launch" },
    { id: "solana-bridge", label: "🔥 Bridge" },
    { id: "swap",          label: "💱 Swap" },
    { id: "dashboard",     label: "📋 My Tokens" },
  ];

  const toolTabs: { id: Tab; label: string }[] = [
    { id: "lock",      label: "🔒 Lock LP" },
    { id: "vanity",    label: "🔮 Vanity" },
    { id: "referral",  label: "🤝 Referral" },
  ];

  const evmStep = deployResult
    ? 4
    : isPending
      ? 3
      : isConnected
        ? 2
        : 1;

  return (
    <div className="min-h-screen bg-dark-bg text-white">

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-dark-border bg-dark-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚒️</span>
            <div className="leading-tight">
              <span className="block text-base font-black tracking-tight text-brand-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.6)]">
                GOONFORGE.XYZ
              </span>
              <span className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-widest">
                Degen Launchpad
              </span>
            </div>
            <span className="hidden rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-400 sm:inline uppercase tracking-wider">
              Multi-Chain
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Wallet auto-detect badge */}
            <span className="hidden sm:inline text-[10px] text-gray-500 border border-dark-border rounded-full px-2 py-1">
              🔍 Auto-detects wallets
            </span>
            {/* Testnet toggle */}
            <button
              type="button"
              onClick={() => setIsTestnet(!isTestnet)}
              className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                isTestnet
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : "border-dark-border bg-dark-muted text-gray-400 hover:border-gray-500"
              }`}
            >
              {isTestnet ? "🧪 Testnet" : "🌐 Mainnet"}
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-dark-border bg-gradient-to-b from-dark-card to-dark-bg py-10 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            <span className="text-white">The degen launchpad that</span>{" "}
            <span className="text-brand-400 drop-shadow-[0_0_16px_rgba(163,230,53,0.5)]">
              prints the next 100x
            </span>
          </h1>
          <p className="mt-4 text-base text-gray-400 max-w-xl mx-auto leading-relaxed">
            Launch any meme, any chain, any flavor in under{" "}
            <span className="text-brand-400 font-semibold">60 seconds</span>.{" "}
            Testnet toggle. Bonding curves. Tax / Reflection / AI tokens.
            Renounce + lock + liquidity add in one click.
          </p>
          <p className="mt-2 text-sm text-gray-600 italic">
            Built by frens. For frens who actually goon the charts.
          </p>
          {/* Chain pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            {["Ethereum", "BSC", "Polygon", "Arbitrum", "Base", "Optimism", "Avalanche", "Solana"].map((c) => (
              <span
                key={c}
                className="rounded-full border border-dark-border bg-dark-card px-3 py-1 text-gray-400"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Main ─────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* Referral banner — shown when a ?ref= param is present */}
        {referrer && referrer.startsWith("0x") && referrer.length === 42 && (
          <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
            🤝 You{"'"}re using a referral link from{" "}
            <code className="font-mono text-brand-400 text-xs">
              {referrer.slice(0, 6)}…{referrer.slice(-4)}
            </code>
            . A share of your launch fee goes to them — no extra cost to you.
          </div>
        )}

        {/* Navigation */}
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-full gap-1 rounded-xl border border-dark-border bg-dark-card p-1 sm:min-w-0">
              {primaryTabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === id
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-gray-400 hover:bg-dark-muted hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tools</span>
            <div className="inline-flex gap-1 rounded-xl border border-dark-border bg-dark-card p-1">
              {toolTabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === id
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-gray-400 hover:bg-dark-muted hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── EVM Launch ──────────────────────────────────────────────────── */}
        {activeTab === "evm" && (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Launch Progress</h3>
                <span className="text-xs text-gray-400">Step {evmStep} / 4</span>
              </div>
              <ProgressStepper
                currentStep={evmStep}
                steps={["Pick network", "Configure token", "Deploy", "Post-launch"]}
              />
              <p className="text-xs text-gray-400">
                New here? Connect wallet, choose a chain, fill the token form, and deploy. After launch, use Swap or the Tools tabs above.
              </p>
            </Card>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4">
                <SectionTitle>1. Select Network</SectionTitle>
                <Card>
                  <ChainSelector />
                </Card>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <SectionTitle>2. Configure &amp; Deploy</SectionTitle>
                {!isConnected ? (
                  <Card className="p-8 text-center space-y-4">
                    <p className="text-2xl">👛</p>
                    <p className="text-gray-300 text-sm font-medium">Connect your wallet to start launching.</p>
                    <p className="text-gray-500 text-xs max-w-sm mx-auto">
                      We will auto-detect your network. You can still switch chains manually from the Select Network section.
                    </p>
                    <ConnectButton />
                  </Card>
                ) : deployResult ? (
                  <DeployResult
                    result={deployResult}
                    chainId={chainId}
                    onReset={() => window.location.reload()}
                    tokenName={lastFormData?.name}
                    tokenSymbol={lastFormData?.symbol}
                    ownerAddress={lastFormData?.marketingWallet || ""}
                    flavor={lastFormData?.flavor ?? 0}
                  />
                ) : (
                  <Card>
                    {!chainConfig?.factoryAddress && (
                      <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                        ⚠️ No factory on <strong>{chainConfig?.name ?? `chain ${chainId}`}</strong> yet. Deploy one first.
                      </div>
                    )}
                    {error && (
                      <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error.message}
                      </div>
                    )}
                    <TokenForm
                      onSubmit={handleDeploy}
                      isSubmitting={isPending}
                      launchFee={launchFee as bigint | undefined}
                      nativeCurrencySymbol={chainConfig?.nativeCurrency.symbol ?? "ETH"}
                    />
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Solana Bridge ───────────────────────────────────────────────── */}
        {activeTab === "solana-bridge" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <SectionTitle>How it works</SectionTitle>
              <Card className="text-sm text-gray-400 space-y-3">
                <Step n={1} text="Hold SPL tokens on Solana" />
                <Step n={2} text="Burn tokens → Wormhole emits a VAA" />
                <Step n={3} text="VAA is relayed to your chosen EVM chains" />
                <Step n={4} text="ERC20 tokens minted to your EVM address" />
                <div className="mt-2 rounded-lg bg-orange-500/10 border border-orange-500/30 p-3 text-xs text-orange-300">
                  <strong className="text-orange-400">Burn tiers:</strong><br />
                  100 tokens → 1 chain<br />
                  500 tokens → 3 chains<br />
                  1,000 tokens → all chains
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <SolanaLaunchPanel isTestnet={isTestnet} />
              </Card>
            </div>
          </div>
        )}

        {/* ── Lock LP ─────────────────────────────────────────────────────── */}
        {activeTab === "lock" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <SectionTitle>Why lock LP?</SectionTitle>
              <Card className="text-sm text-gray-400 space-y-3">
                <Step n={1} text="Add liquidity on Uniswap / PancakeSwap to get LP tokens" />
                <Step n={2} text="Paste the LP token address and choose a lock duration" />
                <Step n={3} text="Approve the locker contract, then lock" />
                <Step n={4} text="Your community sees the lock on-chain — no rug risk" />
                <div className="rounded-lg bg-brand-500/10 border border-brand-500/30 p-3 text-xs text-brand-300">
                  <strong>Locked = No rug.</strong> The contract holds your LP tokens until the unlock date. Not even you can touch them early.
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <LPLockerPanel />
              </Card>
            </div>
          </div>
        )}

        {/* ── Swap ────────────────────────────────────────────────────────── */}
        {activeTab === "swap" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <SectionTitle>Quick Swap</SectionTitle>
              <Card className="text-sm text-gray-400 space-y-3">
                <Step n={1} text="Paste your newly deployed token address in 'To token'" />
                <Step n={2} text="Choose a DEX for your chain" />
                <Step n={3} text="Opens with the pair pre-filled — just set your amount and swap" />
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-300">
                  <strong>Native on-chain swap</strong> (no redirect) coming in v2.
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <SwapWidget />
              </Card>
            </div>
          </div>
        )}

        {/* ── Vanity Address ──────────────────────────────────────────────── */}
        {activeTab === "vanity" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <SectionTitle>Vanity Addresses</SectionTitle>
              <Card className="text-sm text-gray-400 space-y-3">
                <Step n={1} text='Choose a prefix like "cafe", "dead", or "f122" (fizz in leet hex)' />
                <Step n={2} text="The miner generates random private keys until an address matches" />
                <Step n={3} text="Copy and save the private key — it's never stored or sent anywhere" />
                <Step n={4} text="Import into MetaMask or use as your token's owner address" />
              </Card>
              <Card className="text-xs text-gray-500">
                <p className="font-semibold mb-1 text-gray-400">Leet-hex cheatsheet</p>
                <div className="grid grid-cols-2 gap-0.5 font-mono">
                  {[["fizz","f122"],["caps","ca95"],["dead","dead"],["cafe","cafe"],["face","face"],["beef","beef"]].map(([w,h])=>(
                    <span key={w} className="text-brand-400">{w} → <span className="text-gray-400">{h}</span></span>
                  ))}
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <VanityAddressGenerator />
              </Card>
            </div>
          </div>
        )}

        {/* ── Dashboard ───────────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <SectionTitle>My Deployed Tokens</SectionTitle>
            <TokenDashboard />
          </div>
        )}

        {/* ── Referral ────────────────────────────────────────────────────── */}
        {activeTab === "referral" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <SectionTitle>Earn Referral Fees</SectionTitle>
              <Card className="text-sm text-gray-400 space-y-3">
                <Step n={1} text="Copy your unique referral link below" />
                <Step n={2} text="Share it with degens who want to launch tokens" />
                <Step n={3} text="Earn 20% of their launch fee automatically on-chain" />
                <Step n={4} text="Claim your earnings any time — no expiry" />
                <div className="rounded-lg bg-brand-500/10 border border-brand-500/30 p-3 text-xs text-brand-300">
                  <strong>Passive income.</strong> Every token launched via your link puts ETH in your wallet.
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <ReferralPanel />
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-dark-border py-8 text-center text-sm text-gray-600">
        <p className="font-black text-brand-500 text-base tracking-tight">GOONFORGE.XYZ</p>
        <p className="mt-1 text-gray-600">
          Solana burns activate every chain · Built by frens, for frens ·{" "}
          <a
            href="https://github.com/Unwrenchable/cookbook"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-400 hover:underline"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-300">{children}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-dark-border bg-dark-card p-6 ${className}`}>
      {children}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-400">
        {n}
      </span>
      <span>{text}</span>
    </div>
  );
}

function ProgressStepper({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {steps.map((step, i) => {
        const index = i + 1;
        const isDone = currentStep > index;
        const isActive = currentStep === index;
        return (
          <div
            key={step}
            className={`rounded-lg border px-3 py-2 text-xs ${
              isDone
                ? "border-brand-500/40 bg-brand-500/10 text-brand-300"
                : isActive
                  ? "border-blue-400/50 bg-blue-500/10 text-blue-300"
                  : "border-dark-border bg-dark-muted/60 text-gray-500"
            }`}
          >
            <p className="font-semibold">{isDone ? "✓" : index}. {step}</p>
          </div>
        );
      })}
    </div>
  );
}
