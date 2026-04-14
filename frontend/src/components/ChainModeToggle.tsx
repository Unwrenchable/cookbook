/**
 * ChainModeToggle – Pill toggle switching between EVM and Solana mode.
 * EVM active: neon blue glow. Solana active: neon lime/purple glow.
 */
"use client";

import { useId } from "react";
import { useChainMode } from "@/context/ChainModeContext";

/** Ethereum diamond SVG */
function EthIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="12,2 20,12 12,17 4,12" fill="currentColor" opacity="0.9" />
      <polygon points="12,17 20,12 12,22 4,12" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** Solana gradient circle SVG — uses a unique gradient ID to avoid collisions */
function SolIcon({ size = 16, gradientId }: { size?: number; gradientId: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9945ff" />
          <stop offset="100%" stopColor="#14f195" />
        </linearGradient>
      </defs>
      <path d="M4 17h13.5l2.5-2.5H6.5L4 17z" fill={`url(#${gradientId})`} />
      <path d="M4 7h13.5L20 9.5H6.5L4 7z" fill={`url(#${gradientId})`} />
      <path d="M6.5 12H20l-2.5 2.5H4L6.5 12z" fill={`url(#${gradientId})`} />
    </svg>
  );
}

export function ChainModeToggle() {
  const { chainMode, setChainMode } = useChainMode();
  const solGradientId = useId().replace(/:/g, "");
  const isEVM = chainMode === "evm";
  const isSolana = chainMode === "solana";

  return (
    <div
      role="group"
      aria-label="Chain mode selector"
      className="flex items-center rounded-full border border-white/10 bg-black/40 p-0.5 gap-0.5"
      style={{ backdropFilter: "blur(8px)" }}
    >
      {/* EVM side */}
      <button
        type="button"
        aria-pressed={isEVM}
        onClick={() => setChainMode("evm")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
          isEVM
            ? "bg-blue-600/20 border border-blue-500/50 text-blue-300"
            : "text-slate-500 hover:text-slate-300 border border-transparent"
        }`}
        style={
          isEVM
            ? { boxShadow: "0 0 10px rgba(59,130,246,0.35), inset 0 1px 0 rgba(59,130,246,0.15)" }
            : {}
        }
      >
        <EthIcon size={13} />
        <span>EVM</span>
        {isEVM && (
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
        )}
      </button>

      {/* Solana side */}
      <button
        type="button"
        aria-pressed={isSolana}
        onClick={() => setChainMode("solana")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
          isSolana
            ? "bg-purple-600/15 border border-purple-500/40 text-[#14f195]"
            : "text-slate-500 hover:text-slate-300 border border-transparent"
        }`}
        style={
          isSolana
            ? { boxShadow: "0 0 10px rgba(20,241,149,0.30), inset 0 1px 0 rgba(20,241,149,0.10)" }
            : {}
        }
      >
        <SolIcon size={13} gradientId={`sol-grad-${solGradientId}`} />
        <span>SOL</span>
        {isSolana && (
          <span className="h-1.5 w-1.5 rounded-full bg-[#14f195] animate-pulse" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
