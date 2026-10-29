/**
 * app/page.tsx – GOONFORGE.XYZ main launcher page.
 * Pump.fun-quality AAA degen launchpad UI.
 */
"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { ChainSelector } from "@/components/ChainSelector";
import { TokenForm } from "@/components/TokenForm";
import { DeployResult } from "@/components/DeployResult";
import { TokenCard, type TokenCardProps } from "@/components/TokenCard";
import { useDeployToken } from "@/hooks/useDeployToken";
import { getChainById } from "@/lib/chains";
import { useNetwork } from "@/lib/networkContext";
import type { TokenFormData } from "@/lib/types";

const TokenDashboard = dynamic(() => import("@/components/TokenDashboard").then((m) => m.TokenDashboard), { ssr: false });
const SolanaLaunchPanel = dynamic(() => import("@/components/SolanaLaunchPanel").then((m) => m.SolanaLaunchPanel), { ssr: false });
const VanityAddressGenerator = dynamic(() => import("@/components/VanityAddressGenerator").then((m) => m.VanityAddressGenerator), { ssr: false });
const LPLockerPanel = dynamic(() => import("@/components/LPLockerPanel").then((m) => m.LPLockerPanel), { ssr: false });
const SwapWidget = dynamic(() => import("@/components/SwapWidget").then((m) => m.SwapWidget), { ssr: false });
const ReferralPanel = dynamic(() => import("@/components/ReferralPanel").then((m) => m.ReferralPanel), { ssr: false });
const VerifyPanel = dynamic(() => import("@/components/VerifyPanel").then((m) => m.VerifyPanel), { ssr: false });

type Tab = "evm" | "solana-bridge" | "lock" | "swap" | "verify" | "vanity" | "dashboard" | "referral";
type DiscoveryTab = "trending" | "new" | "graduate" | "cross-chain" | "top-earners";

const VALID_TABS: Tab[] = ["evm", "solana-bridge", "lock", "swap", "verify", "vanity", "dashboard", "referral"];

const SIDEBAR_TABS: { id: Tab; emoji: string; label: string; sublabel?: string }[] = [
  { id: "evm",           emoji: "🚀", label: "Launch",    sublabel: "EVM Token" },
  { id: "solana-bridge", emoji: "🔥", label: "Bridge",    sublabel: "Solana → EVM" },
  { id: "swap",          emoji: "💱", label: "Swap",      sublabel: "Quick Trade" },
  { id: "verify",        emoji: "✅", label: "Verify",    sublabel: "Audit + $GOON" },
  { id: "dashboard",     emoji: "📋", label: "Portfolio", sublabel: "My Tokens" },
  { id: "lock",          emoji: "��", label: "Lock LP",   sublabel: "Anti-Rug" },
  { id: "vanity",        emoji: "🔮", label: "Vanity",    sublabel: "0x Prefix" },
  { id: "referral",      emoji: "🤝", label: "Referral",  sublabel: "Earn Fees" },
];

const DISCOVERY_TABS: { id: DiscoveryTab; label: string }[] = [
  { id: "trending",    label: "🔥 Trending" },
  { id: "new",         label: "✨ New" },
  { id: "graduate",    label: "🎓 Graduating" },
  { id: "cross-chain", label: "🌉 Cross-Chain" },
  { id: "top-earners", label: "🤝 Top Earners" },
];

// Mock discovery data
const MOCK_TOKENS: Record<DiscoveryTab, TokenCardProps[]> = {
  trending: [
    { symbol: "$GOON",     chain: "Base",     velocity: "+38%", isPositive: true,  age: "2m",  volume: "12.4 ETH", traders: 312 },
    { symbol: "$FIZZ",     chain: "Arbitrum", velocity: "+24%", isPositive: true,  age: "6m",  volume: "7.1 ETH",  traders: 218 },
    { symbol: "$CAPS",     chain: "BSC",      velocity: "+19%", isPositive: true,  age: "9m",  volume: "18.9 BNB", traders: 401 },
    { symbol: "$BUNKERAI", chain: "Polygon",  velocity: "+14%", isPositive: true,  age: "15m", volume: "6.3 MATIC",traders: 97 },
  ],
  new: [
    { symbol: "$FROTH",      chain: "Ethereum", velocity: "+5%",  isPositive: true,  age: "2m",  volume: "0.4 ETH",  traders: 8 },
    { symbol: "$TRENCH",     chain: "Base",     velocity: "+2%",  isPositive: true,  age: "4m",  volume: "1.2 ETH",  traders: 22 },
    { symbol: "$VOIDX",      chain: "BSC",      velocity: "-3%",  isPositive: false, age: "7m",  volume: "0.8 BNB",  traders: 15 },
    { symbol: "$GIGA",       chain: "Arbitrum", velocity: "+8%",  isPositive: true,  age: "11m", volume: "2.1 ETH",  traders: 44 },
  ],
  graduate: [
    { symbol: "$REKTBOX",   chain: "Base",     velocity: "+91%", isPositive: true, age: "2h",  volume: "82 ETH",   traders: 1204, isGraduating: true, graduationPct: 89 },
    { symbol: "$NEONBURN",  chain: "Arbitrum", velocity: "+67%", isPositive: true, age: "3h",  volume: "61 ETH",   traders: 876,  isGraduating: true, graduationPct: 83 },
    { symbol: "$SLEEPLESS", chain: "BSC",      velocity: "+44%", isPositive: true, age: "4h",  volume: "43 BNB",   traders: 621,  isGraduating: true, graduationPct: 79 },
    { symbol: "$TRENCHDAO", chain: "Base",     velocity: "+38%", isPositive: true, age: "5h",  volume: "38 ETH",   traders: 511,  isGraduating: true, graduationPct: 72 },
  ],
  "cross-chain": [
    { symbol: "$SPARK",  chain: "Ethereum", velocity: "+28%", isPositive: true, age: "1h",  volume: "24 ETH", traders: 388 },
    { symbol: "$ATOMIC", chain: "BSC",      velocity: "+21%", isPositive: true, age: "2h",  volume: "18 BNB", traders: 277 },
    { symbol: "$VAULT",  chain: "Polygon",  velocity: "+15%", isPositive: true, age: "3h",  volume: "12 MATIC",traders: 199 },
    { symbol: "$NEXUS",  chain: "Arbitrum", velocity: "+11%", isPositive: true, age: "4h",  volume: "9 ETH",  traders: 143 },
  ],
  "top-earners": [
    { symbol: "$GOON",    chain: "Base",     velocity: "+38%", isPositive: true, age: "2m",  volume: "12 ETH", traders: 312 },
    { symbol: "$CAPS",    chain: "BSC",      velocity: "+19%", isPositive: true, age: "9m",  volume: "18 BNB", traders: 401 },
    { symbol: "$ATOMIC",  chain: "Polygon",  velocity: "+21%", isPositive: true, age: "2h",  volume: "18 MATIC",traders: 277 },
    { symbol: "$FIZZ",    chain: "Arbitrum", velocity: "+24%", isPositive: true, age: "6m",  volume: "7 ETH",  traders: 218 },
  ],
};

const TICKER_ITEMS = [
  "🚀 $GOON +38% · Base", "🔥 $FIZZ +24% · Arb", "📈 $CAPS +19% · BSC",
  "⚡ $SPARK minted on 4 chains", "🎓 $REKTBOX 89% to graduation",
  "🌉 $ATOMIC cross-chain activated", "💎 $BUNKERAI just launched",
  "🤖 $AICORE +31% · Ethereum", "🏛️ $VOTE +12% · Polygon",
  "🚀 $MOON +55% · Base", "📊 $VAULT 3 chains activated",
];

// TODO: Replace with live API data when analytics endpoint is available.
// Expected response: { tokensLaunched: number; totalVolumeUsd: number; activeTraders: number }
const MOCK_STATS = [
  { label: "Tokens Launched", value: "12,847", icon: "🚀" },
  { label: "Total Volume",    value: "$4.2M",   icon: "💰" },
  { label: "Active Traders",  value: "8,291",   icon: "👥" },
] as const;

/** Returns true for valid 20-byte Ethereum addresses (0x-prefixed, 42 chars). */
function isValidEthAddress(addr: string): boolean {
  return addr.startsWith("0x") && addr.length === 42;
}

const LEET_HEX_EXAMPLES: [string, string][] = [
  ["fizz", "f122"],
  ["caps", "ca95"],
  ["dead", "dead"],
  ["cafe", "cafe"],
  ["face", "face"],
  ["beef", "beef"],
];

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const chainConfig = getChainById(chainId);
  const searchParams = useSearchParams();
  const router = useRouter();

  const referrer = searchParams?.get("ref") ?? undefined;
  const tabParam = searchParams?.get("tab");
  const activeTab: Tab = (VALID_TABS.includes(tabParam as Tab) ? tabParam : "evm") as Tab;

  const { deploy, isPending, error, deployResult, launchFee } = useDeployToken();
  const { isTestnet } = useNetwork();
  const [lastFormData, setLastFormData] = useState<TokenFormData | null>(null);
  const [discoveryTab, setDiscoveryTab] = useState<DiscoveryTab>("trending");

  function setActiveTab(tab: Tab) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tab);
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  async function handleDeploy(formData: TokenFormData) {
    setLastFormData(formData);
    try {
      await deploy(formData, referrer);
    } catch {
      // error captured in hook
    }
  }

  const evmStep = getEvmStep({ hasDeployResult: Boolean(deployResult), isPending, isConnected });
  const tokens = getDiscoveryTokens(discoveryTab);

  return (
    <div className="min-h-screen bg-dark-bg text-white">

      {/* ── Ticker bar ──────────────────────────────────────────────────── */}
      <div className="border-b border-surface-5/60 bg-surface-1/70 py-2 overflow-hidden">
        <div className="ticker-wrapper">
          <div className="ticker-inner">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 mx-8 text-[11px] text-slate-400 shrink-0 font-medium">
                <span className="text-brand-500 text-[8px]">◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-surface-5/60 hero-orbs bg-dots">
        {/* Top glow line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface-0 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center">
          {/* Live badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/8 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-[0.15em]">
              Multi-Chain Token Launchpad · Live on 9 Networks
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[0.95] mb-5">
            <span className="text-white block">LAUNCH THE NEXT</span>
            <span className="text-gradient-neon animate-glow-text block mt-1">100X TOKEN</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-9">
            Deploy any meme, any chain, any flavor in{" "}
            <span className="text-brand-400 font-semibold">under 60 seconds</span>.
            Bonding curves, AI agents, PolitiFi, Solana bridge — one click.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-12">
            <button
              type="button"
              onClick={() => setActiveTab("evm")}
              className="group relative flex items-center gap-2 rounded-xl overflow-hidden px-7 py-3 text-sm font-black text-black transition-all"
              style={{ background: "linear-gradient(135deg, #c4ff5a 0%, #a3e635 60%, #22d3ee 100%)" }}
            >
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(135deg, #d4ff6a 0%, #b5f045 60%, #30e4ff 100%)" }} />
              <span className="relative">🚀</span>
              <span className="relative">Launch Token</span>
            </button>
            <button
              type="button"
              onClick={() => setDiscoveryTab("trending")}
              className="flex items-center gap-2 rounded-xl border border-surface-6 bg-surface-3/80 hover:bg-surface-4 hover:border-surface-6 text-slate-200 font-semibold px-7 py-3 text-sm transition-all"
            >
              🔥 Explore Tokens
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            {MOCK_STATS.map(({ label, value, icon }) => (
              <div key={label} className="rounded-2xl border border-surface-5/80 bg-surface-2/60 px-3 py-3.5 backdrop-blur-sm">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5 font-medium">{icon} {label}</p>
                <p className="text-xl font-black text-brand-400 stat-value">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Referral banner ─────────────────────────────────────────────── */}
      {referrer && isValidEthAddress(referrer) && (
        <div className="border-b border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-center text-sm text-brand-300">
          🤝 Referral link from{" "}
          <code className="font-mono text-brand-400">
            {referrer.slice(0, 6)}…{referrer.slice(-4)}
          </code>{" "}
          — 20% of your launch fee goes to them. No extra cost.
        </div>
      )}

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-5 lg:grid lg:grid-cols-[210px_1fr_276px]">

          {/* ── Left: Sidebar tab nav (desktop only) ──────────────────── */}
          <aside className="hidden lg:flex flex-col gap-0.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 px-3 mb-2">
              Navigate
            </p>
            {SIDEBAR_TABS.map(({ id, emoji, label, sublabel }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  activeTab === id
                    ? "bg-brand-500/12 border border-brand-500/25 text-white shadow-sm"
                    : "border border-transparent text-slate-400 hover:bg-surface-4/70 hover:text-slate-200"
                }`}
              >
                <span className="text-base shrink-0">{emoji}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight">{label}</p>
                  {sublabel && (
                    <p className={`text-[10px] leading-tight mt-0.5 ${activeTab === id ? "text-brand-500/80" : "text-slate-600"}`}>
                      {sublabel}
                    </p>
                  )}
                </div>
                {activeTab === id && (
                  <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                )}
              </button>
            ))}

            {/* Separator */}
            <div className="my-3 h-px bg-surface-5/60" />

            {/* Chain indicator */}
            <div className="rounded-xl border border-surface-5/80 bg-surface-2/60 px-3 py-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1.5 font-medium">Active Network</p>
              <p className="text-xs font-semibold text-slate-200 truncate">
                {chainConfig?.name ?? `Chain ${chainId}`}
              </p>
              {isTestnet && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-yellow-500/12 border border-yellow-500/25 px-2 py-0.5 text-[9px] font-semibold text-yellow-400">
                  <span className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
                  Testnet
                </span>
              )}
            </div>
          </aside>

          {/* ── Center: Main content ───────────────────────────────────── */}
          <main className="min-w-0 flex-1 space-y-4">
            {/* Mobile horizontal tab bar */}
            <div className="lg:hidden overflow-x-auto pb-1">
              <div className="inline-flex gap-1 p-1 rounded-xl border border-surface-5/60 bg-surface-2/80 min-w-full sm:min-w-0">
                {SIDEBAR_TABS.map(({ id, emoji, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                      activeTab === id
                        ? "bg-brand-500/18 border border-brand-500/28 text-brand-300"
                        : "text-slate-400 hover:bg-surface-4 hover:text-slate-200"
                    }`}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── EVM Launch ────────────────────────────────────────── */}
            {activeTab === "evm" && (
              <div className="space-y-4 animate-fade-in-up">
                {/* Progress stepper */}
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white">Launch Progress</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Step {evmStep} / 4</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["Pick Network", "Configure", "Deploy", "Post-Launch"].map((step, i) => {
                      const n = i + 1;
                      const isDone = evmStep > n;
                      const isActive = evmStep === n;
                      return (
                        <div
                          key={step}
                          className={`rounded-xl border px-2 py-2.5 text-center text-xs transition-colors ${
                            isDone
                              ? "border-brand-500/35 bg-brand-500/8 text-brand-300"
                              : isActive
                              ? "border-accent-500/35 bg-accent-500/8 text-accent-300"
                              : "border-surface-5/60 bg-surface-3/40 text-slate-600"
                          }`}
                        >
                          <p className="font-bold text-sm">{isDone ? "✓" : n}</p>
                          <p className="leading-tight mt-0.5 text-[10px]">{step}</p>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                  {/* Chain Selector */}
                  <div>
                    <SectionLabel>1. Select Network</SectionLabel>
                    <GlassCard className="mt-1">
                      <ChainSelector />
                    </GlassCard>
                  </div>

                  {/* Token Form / Deploy result */}
                  <div>
                    <SectionLabel>2. Configure &amp; Deploy</SectionLabel>
                    <div className="mt-1">
                      {!isConnected ? (
                        <GlassCard className="py-12 text-center">
                          <div className="text-4xl mb-4">👛</div>
                          <h3 className="text-white font-semibold mb-2">Connect Your Wallet</h3>
                          <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                            Connect to start deploying. We auto-detect your network — or switch manually.
                          </p>
                          <ConnectButton />
                        </GlassCard>
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
                        <GlassCard>
                          {!chainConfig?.factoryAddress && (
                            <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                              ⚠️ No factory on{" "}
                              <strong>{chainConfig?.name ?? `chain ${chainId}`}</strong> yet.
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
                        </GlassCard>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Solana Bridge ─────────────────────────────────────── */}
            {activeTab === "solana-bridge" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr] animate-fade-in-up">
                <div>
                  <SectionLabel>How the Bridge Works</SectionLabel>
                  <GlassCard className="mt-1 text-sm text-gray-400 space-y-3">
                    {[
                      "Hold SPL tokens on Solana",
                      "Burn tokens → Wormhole emits a VAA",
                      "VAA is relayed to your chosen EVM chains",
                      "ERC20 tokens minted to your EVM address",
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-black text-brand-400">
                          {i + 1}
                        </span>
                        <span>{text}</span>
                      </div>
                    ))}
                    <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-orange-300 mt-2">
                      <p className="font-bold text-orange-400 mb-1">🔥 Burn Tiers</p>
                      <p>100 tokens → 1 chain</p>
                      <p>500 tokens → 3 chains</p>
                      <p>1,000 tokens → all chains</p>
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <SectionLabel>Solana Burn → EVM Mint</SectionLabel>
                  <GlassCard className="mt-1">
                    <SolanaLaunchPanel isTestnet={isTestnet} />
                  </GlassCard>
                </div>
              </div>
            )}

            {/* ── Swap ──────────────────────────────────────────────── */}
            {activeTab === "swap" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr] animate-fade-in-up">
                <div>
                  <SectionLabel>Quick Swap Guide</SectionLabel>
                  <GlassCard className="mt-1 text-sm text-gray-400 space-y-3">
                    {[
                      "Paste your deployed token address in 'To token'",
                      "Choose a DEX for your chain",
                      "Pair is pre-filled — set amount and swap",
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-black text-blue-400">
                          {i + 1}
                        </span>
                        <span>{text}</span>
                      </div>
                    ))}
                    <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-300">
                      Native on-chain swap coming in v2.
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <SectionLabel>Swap Widget</SectionLabel>
                  <GlassCard className="mt-1">
                    <SwapWidget />
                  </GlassCard>
                </div>
              </div>
            )}

            {/* ── Verify ────────────────────────────────────────────── */}
            {activeTab === "verify" && (
              <div className="animate-fade-in-up">
                <SectionLabel>Contract Verification</SectionLabel>
                <div className="mt-1">
                  <VerifyPanel />
                </div>
              </div>
            )}

            {/* ── Portfolio / Dashboard ─────────────────────────────── */}
            {activeTab === "dashboard" && (
              <div className="animate-fade-in-up">
                <SectionLabel>My Deployed Tokens</SectionLabel>
                <div className="mt-1">
                  <TokenDashboard />
                </div>
              </div>
            )}

            {/* ── Lock LP ───────────────────────────────────────────── */}
            {activeTab === "lock" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr] animate-fade-in-up">
                <div>
                  <SectionLabel>Why Lock LP?</SectionLabel>
                  <GlassCard className="mt-1 text-sm text-gray-400 space-y-3">
                    {[
                      "Add liquidity on Uniswap/PancakeSwap to get LP tokens",
                      "Paste the LP token address and choose a lock duration",
                      "Approve the locker contract and lock",
                      "Community sees the lock on-chain — no rug risk",
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-black text-brand-400">
                          {i + 1}
                        </span>
                        <span>{text}</span>
                      </div>
                    ))}
                    <div className="rounded-xl border border-brand-500/25 bg-brand-500/10 p-3 text-xs text-brand-300">
                      <strong className="text-brand-400">Locked = No rug.</strong>{" "}
                      Contract holds LP tokens until unlock date. Immutable.
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <SectionLabel>LP Locker</SectionLabel>
                  <GlassCard className="mt-1">
                    <LPLockerPanel />
                  </GlassCard>
                </div>
              </div>
            )}

            {/* ── Vanity Address ────────────────────────────────────── */}
            {activeTab === "vanity" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr] animate-fade-in-up">
                <div>
                  <SectionLabel>Vanity Addresses</SectionLabel>
                  <GlassCard className="mt-1 text-sm text-gray-400 space-y-3">
                    {[
                      'Choose a prefix like "cafe", "dead", or "f122"',
                      "Miner generates random private keys until one matches",
                      "Copy + save the private key — never stored anywhere",
                      "Import into MetaMask or use as owner address",
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-black text-brand-400">
                          {i + 1}
                        </span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </GlassCard>
                  <GlassCard className="mt-2 text-xs text-gray-500">
                    <p className="font-semibold text-gray-400 mb-2">Leet-hex cheatsheet</p>
                    <div className="grid grid-cols-2 gap-0.5 font-mono">
                      {LEET_HEX_EXAMPLES.map(([w, h]) => (
                        <span key={w} className="text-brand-400">
                          {w} → <span className="text-gray-400">{h}</span>
                        </span>
                      ))}
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <SectionLabel>Vanity Generator</SectionLabel>
                  <GlassCard className="mt-1">
                    <VanityAddressGenerator />
                  </GlassCard>
                </div>
              </div>
            )}

            {/* ── Referral ──────────────────────────────────────────── */}
            {activeTab === "referral" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr] animate-fade-in-up">
                <div>
                  <SectionLabel>Earn Referral Fees</SectionLabel>
                  <GlassCard className="mt-1 text-sm text-gray-400 space-y-3">
                    {[
                      "Copy your unique referral link below",
                      "Share it with degens who want to launch tokens",
                      "Earn 20% of their launch fee automatically on-chain",
                      "Claim earnings any time — no expiry",
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-black text-brand-400">
                          {i + 1}
                        </span>
                        <span>{text}</span>
                      </div>
                    ))}
                    <div className="rounded-xl border border-brand-500/25 bg-brand-500/10 p-3 text-xs text-brand-300">
                      <strong className="text-brand-400">Passive income.</strong>{" "}
                      Every token launched via your link puts ETH in your wallet.
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <SectionLabel>Your Referral Dashboard</SectionLabel>
                  <GlassCard className="mt-1">
                    <ReferralPanel />
                  </GlassCard>
                </div>
              </div>
            )}
          </main>

          {/* ── Right: Discovery Feed ─────────────────────────────────── */}
          <aside className="hidden lg:block shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Live Feed
              </p>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                Live
              </span>
            </div>

            {/* Discovery filter tabs */}
            <div className="flex flex-wrap gap-1">
              {DISCOVERY_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDiscoveryTab(id)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition-all ${
                    discoveryTab === id
                      ? "bg-brand-500/15 border border-brand-500/28 text-brand-300"
                      : "border border-transparent text-slate-500 hover:text-slate-300 hover:bg-surface-4/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Token cards */}
            <div className="space-y-2">
              {tokens.map((token, i) => (
                <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <TokenCard
                    symbol={token.symbol}
                    name={token.name}
                    chain={token.chain}
                    velocity={token.velocity}
                    isPositive={token.isPositive}
                    age={token.age}
                    volume={token.volume}
                    traders={token.traders}
                    isGraduating={token.isGraduating}
                    graduationPct={token.graduationPct}
                  />
                </div>
              ))}
            </div>

            {/* Graduated section */}
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-2">
                🏁 Recent Graduates
              </p>
              <div className="space-y-1.5">
                {[
                  { sym: "$WASTED", dest: "Uniswap" },
                  { sym: "$BUNKER", dest: "PancakeSwap" },
                  { sym: "$VOID",   dest: "Aerodrome" },
                ].map(({ sym, dest }) => (
                  <div
                    key={sym}
                    className="flex items-center justify-between rounded-xl border border-surface-5/60 bg-surface-2/50 px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-white">{sym}</span>
                    <span className="text-slate-500">→ {dest}</span>
                    <span className="text-brand-400 font-semibold">100%</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ── Mobile: Discovery Feed below content ────────────────────── */}
        <div className="lg:hidden mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">🔥 Token Discovery</p>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex gap-1 p-1 rounded-xl border border-surface-5/60 bg-surface-2/80">
              {DISCOVERY_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDiscoveryTab(id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold whitespace-nowrap transition-all ${
                    discoveryTab === id
                      ? "bg-brand-500/18 border border-brand-500/28 text-brand-300"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tokens.map((token, i) => (
              <div key={i}>
                <TokenCard
                  symbol={token.symbol}
                  name={token.name}
                  chain={token.chain}
                  velocity={token.velocity}
                  isPositive={token.isPositive}
                  age={token.age}
                  volume={token.volume}
                  traders={token.traders}
                  isGraduating={token.isGraduating}
                  graduationPct={token.graduationPct}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-surface-5/50 py-10 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-black text-gradient-brand text-base tracking-tight">GOONFORGE.XYZ</p>
            <p className="mt-1 text-xs text-slate-600">
              Solana burns activate every chain · Built by frens, for frens
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <a
              href="https://github.com/Unwrenchable/cookbook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-400 transition-colors"
            >
              GitHub
            </a>
            {/* TODO: Add official Twitter/X and Discord links when GoonForge social accounts are created */}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{children}</h2>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-3xl animate-float">⚒️</div>
        <p className="text-gradient-brand font-black text-lg animate-glow-text">GOONFORGE.XYZ</p>
        <p className="text-slate-600 text-sm">Loading the forge…</p>
      </div>
    </div>
  );
}

function getEvmStep({
  hasDeployResult,
  isPending,
  isConnected,
}: {
  hasDeployResult: boolean;
  isPending: boolean;
  isConnected: boolean;
}) {
  if (hasDeployResult) return 4;
  if (isPending) return 3;
  if (isConnected) return 2;
  return 1;
}

function getDiscoveryTokens(tab: DiscoveryTab): TokenCardProps[] {
  if (tab === "trending")    return MOCK_TOKENS.trending;
  if (tab === "new")         return MOCK_TOKENS.new;
  if (tab === "graduate")    return MOCK_TOKENS.graduate;
  if (tab === "cross-chain") return MOCK_TOKENS["cross-chain"];
  return MOCK_TOKENS["top-earners"];
}
