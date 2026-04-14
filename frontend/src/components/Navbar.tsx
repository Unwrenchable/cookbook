/**
 * Navbar.tsx – Sticky top navigation bar for GOONFORGE.XYZ
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetwork } from "@/lib/networkContext";
import { useChainMode } from "@/context/ChainModeContext";
import { ChainModeToggle } from "@/components/ChainModeToggle";

const SolanaWalletBtn = dynamic(
  () => import("@/components/SolanaWalletBtn").then((m) => m.SolanaWalletBtn),
  { ssr: false }
);

const NAV_TABS = [
  { href: "/?tab=evm",           label: "Launch",    icon: "🚀" },
  { href: "/?tab=solana-bridge", label: "Bridge",    icon: "🔥" },
  { href: "/?tab=swap",          label: "Swap",      icon: "💱" },
  { href: "/?tab=verify",        label: "Verify",    icon: "✅" },
  { href: "/?tab=dashboard",     label: "Portfolio", icon: "📋" },
  { href: "/?tab=vanity",        label: "Tools",     icon: "🔮" },
] as const;

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isTestnet, setIsTestnet } = useNetwork();
  const { chainMode } = useChainMode();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-5/80 bg-surface-1/90 backdrop-blur-2xl">
      {/* Subtle top line accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 gap-4">

        {/* ── Logo ───────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 border border-brand-500/25 group-hover:border-brand-500/50 transition-all">
            <span className="text-sm animate-float select-none" aria-hidden="true">⚒️</span>
          </div>
          <div className="leading-none">
            <span className="block text-[15px] font-black tracking-tight text-gradient-brand group-hover:opacity-90 transition-opacity">
              GOONFORGE
            </span>
            <span className="hidden sm:block text-[9px] text-slate-500 uppercase tracking-widest mt-0.5 font-medium">
              Multi-Chain Launchpad
            </span>
          </div>
          <span className="hidden sm:inline shrink-0 rounded-full border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-[9px] font-bold text-accent-400 uppercase tracking-wider">
            Beta
          </span>
        </Link>

        {/* ── Desktop nav links ──────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {NAV_TABS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-all hover:bg-surface-4/80"
            >
              <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* ── Right controls ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Chain mode toggle (EVM ↔ SOL) */}
          <ChainModeToggle />

          {/* Testnet / Mainnet pill */}
          <button
            type="button"
            onClick={() => setIsTestnet(!isTestnet)}
            className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
              isTestnet
                ? "border-yellow-500/40 bg-yellow-500/8 text-yellow-400 hover:bg-yellow-500/15"
                : "border-brand-500/25 bg-brand-500/8 text-brand-400 hover:bg-brand-500/15"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isTestnet ? "bg-yellow-400 animate-pulse" : "bg-brand-500"
              }`}
            />
            {isTestnet ? "Testnet" : "Mainnet"}
          </button>

          {/* Wallet button — shown based on chain mode */}
          {chainMode === "solana" ? (
            <div className="hidden md:flex">
              <SolanaWalletBtn />
            </div>
          ) : (
            <ConnectButton accountStatus="avatar" showBalance={false} chainStatus="icon" />
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl border border-surface-5 bg-surface-3 text-slate-400 hover:text-white hover:border-surface-6 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <span className="text-[11px] font-bold">{menuOpen ? "✕" : "≡"}</span>
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-surface-4/60 bg-surface-1/98 backdrop-blur-2xl px-4 pb-5 pt-3 space-y-1 animate-fade-in-up">
          {NAV_TABS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-surface-4 hover:text-white transition-all"
            >
              <span className="text-sm">{icon}</span>
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-surface-5/50 mt-1 space-y-2.5">
            {/* Chain mode toggle in mobile */}
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Chain Mode</p>
              <ChainModeToggle />
            </div>
            <button
              type="button"
              onClick={() => setIsTestnet(!isTestnet)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                isTestnet
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : "border-brand-500/25 bg-brand-500/10 text-brand-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isTestnet ? "bg-yellow-400 animate-pulse" : "bg-brand-500"}`} />
              {isTestnet ? "🧪 Testnet Mode" : "🌐 Mainnet Mode"}
            </button>
            {/* Wallet per chain mode */}
            {chainMode === "solana" ? (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Solana Wallet</p>
                <SolanaWalletBtn fullWidth />
              </div>
            ) : (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">EVM Wallet</p>
                <ConnectButton accountStatus="full" showBalance={false} chainStatus="icon" />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
