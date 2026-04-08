/**
 * Navbar.tsx – Sticky top navigation bar for GOONFORGE.XYZ
 * Logo · Nav links · Testnet/Mainnet toggle · RainbowKit ConnectButton
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetwork } from "@/lib/networkContext";

const NAV_TABS = [
  { href: "/?tab=evm",           label: "Launch",    emoji: "🚀" },
  { href: "/?tab=solana-bridge", label: "Bridge",    emoji: "🔥" },
  { href: "/?tab=swap",          label: "Swap",      emoji: "💱" },
  { href: "/?tab=dashboard",     label: "Portfolio", emoji: "📋" },
  { href: "/?tab=vanity",        label: "Tools",     emoji: "🔮" },
] as const;

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isTestnet, setIsTestnet } = useNetwork();

  return (
    <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-card/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 gap-4">

        {/* ── Logo ───────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="text-xl animate-float select-none">⚒️</span>
          <div className="leading-none">
            <span className="block text-[15px] font-black tracking-tighter text-brand-400 group-hover:text-brand-300 transition-colors drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]">
              GOONFORGE.XYZ
            </span>
            <span className="hidden sm:block text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">
              Multi-Chain Degen Launchpad
            </span>
          </div>
          <span className="hidden sm:inline shrink-0 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[9px] font-bold text-brand-500 uppercase tracking-wider">
            Beta
          </span>
        </Link>

        {/* ── Desktop nav links ──────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {NAV_TABS.map(({ href, label, emoji }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-muted transition-all"
            >
              <span className="text-xs">{emoji}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* ── Right controls ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Testnet / Mainnet pill */}
          <button
            type="button"
            onClick={() => setIsTestnet(!isTestnet)}
            className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
              isTestnet
                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                : "border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isTestnet ? "bg-yellow-400 animate-pulse" : "bg-brand-400"
              }`}
            />
            {isTestnet ? "Testnet" : "Mainnet"}
          </button>

          {/* RainbowKit connect */}
          <ConnectButton accountStatus="avatar" showBalance={false} chainStatus="icon" />

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-dark-border bg-dark-muted text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-dark-border bg-dark-card/95 backdrop-blur-xl px-4 pb-4 pt-3 space-y-1 animate-fade-in-up">
          {NAV_TABS.map(({ href, label, emoji }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-dark-muted hover:text-white transition-colors"
            >
              <span>{emoji}</span>
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-dark-border mt-2">
            <button
              type="button"
              onClick={() => setIsTestnet(!isTestnet)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                isTestnet
                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                  : "border-brand-500/30 bg-brand-500/10 text-brand-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isTestnet ? "bg-yellow-400 animate-pulse" : "bg-brand-400"}`} />
              {isTestnet ? "🧪 Testnet Mode" : "🌐 Mainnet Mode"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
