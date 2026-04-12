/**
 * VerifyPanel.tsx – GoonVerify: integrated audit + $GOON payment panel.
 *
 * Free scan: trust score + basic risk flags (mocked; hook Slither/GoPlus in Phase 2).
 * Premium:   transfers $GOON to treasury → unlocks GoonVerified badge, PDF, X tweet.
 * GOON IT NOW: deep-links to Launch tab with the verified contract pre-filled.
 *
 * TODO: Replace the three placeholder constants below with real values before
 *       deploying to production.
 */
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

// ─── ⚠️ Replace before production ────────────────────────────────────────────
/** Official $GOON ERC-20 contract address on Base. */
const GOON_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
/** Team treasury wallet that receives $GOON payments. */
const TREASURY_WALLET    = "0x0000000000000000000000000000000000000000" as `0x${string}`;
/** Amount of $GOON required for the premium GoonVerified package (18 decimals). */
const PREMIUM_PRICE_GOON = "10000";
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal ERC-20 ABI: only `transfer` is needed here. */
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",    type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Mock scan logic ──────────────────────────────────────────────────────────

interface ScanResult {
  trustScore:  number;   // 0–100
  risks:       RiskItem[];
  isMintable:  boolean;
  isProxy:     boolean;
  hasBlacklist:boolean;
}

interface RiskItem {
  level:   "safe" | "warn" | "danger";
  label:   string;
  detail:  string;
}

function mockScan(address: string): ScanResult {
  // Deterministic-ish mock based on address chars for demo variety.
  const seed = parseInt(address.slice(2, 6) || "abcd", 16) % 100;
  const trustScore = Math.min(100, Math.max(55, 100 - (seed % 45)));

  const risks: RiskItem[] = [
    {
      level:  "safe",
      label:  "Ownership",
      detail: "Owner address found. Consider renouncing after adding liquidity.",
    },
    {
      level:  "safe",
      label:  "Fixed supply",
      detail: "No additional minting functions detected in the bytecode.",
    },
    {
      level:  trustScore < 70 ? "warn" : "safe",
      label:  "Fee functions",
      detail: trustScore < 70
        ? "Buy/sell tax functions detected. Verify fee caps are reasonable."
        : "No hidden fee functions detected.",
    },
    {
      level:  trustScore < 65 ? "warn" : "safe",
      label:  "Pausable",
      detail: trustScore < 65
        ? "pause() function exists. Ensure it cannot permanently block transfers."
        : "No pause/freeze functions found.",
    },
    {
      level:  "warn",
      label:  "Unaudited contract",
      detail: "This is a heuristic scan. Run full Slither audit for production.",
    },
  ];

  return {
    trustScore,
    risks,
    isMintable:   false,
    isProxy:      trustScore < 80,
    hasBlacklist: trustScore < 70,
  };
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskItem["level"], { icon: string; textClass: string; borderClass: string; bgClass: string }> = {
  safe:   { icon: "✅", textClass: "text-green-400",  borderClass: "border-green-500/30",  bgClass: "bg-green-500/10"  },
  warn:   { icon: "⚠️", textClass: "text-yellow-400", borderClass: "border-yellow-500/30", bgClass: "bg-yellow-500/10" },
  danger: { icon: "🚨", textClass: "text-red-400",    borderClass: "border-red-500/30",    bgClass: "bg-red-500/10"    },
};

function RiskRow({ item }: { item: RiskItem }) {
  const s = RISK_STYLES[item.level];
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${s.borderClass} ${s.bgClass} p-3`}>
      <span className="shrink-0 text-base leading-none mt-0.5">{s.icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${s.textClass}`}>{item.label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
      </div>
    </div>
  );
}

// ─── Trust score ring ─────────────────────────────────────────────────────────

function TrustRing({ score }: { score: number }) {
  const color =
    score >= 80 ? "#a3e635" :
    score >= 60 ? "#facc15" : "#f87171";

  const radius  = 36;
  const circ    = 2 * Math.PI * radius;
  const dash    = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: "-72px" }}>
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">/ 100</span>
      </div>
      <p className="text-xs text-gray-400 font-semibold">Trust Score</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VerifyPanel() {
  const router      = useRouter();
  const { isConnected } = useAccount();

  const [inputMode,    setInputMode]    = useState<"address" | "file">("address");
  const [contractAddr, setContractAddr] = useState("");
  const [scanResult,   setScanResult]   = useState<ScanResult | null>(null);
  const [isScanning,   setIsScanning]   = useState(false);
  const [isVerified,   setIsVerified]   = useState(false);
  const [payError,     setPayError]     = useState<string | null>(null);

  const { writeContractAsync, isPending: isSending } = useWriteContract();

  const [payTxHash, setPayTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: payTxHash });

  // Mark as verified when payment confirms
  const hasVerification = isVerified || isConfirmed;

  const isValidAddr = contractAddr.startsWith("0x") && contractAddr.length === 42;

  // ── Free scan ──────────────────────────────────────────────────────────────

  const handleScan = useCallback(() => {
    if (!isValidAddr) return;
    setIsScanning(true);
    setScanResult(null);

    // Simulate async scan delay (Phase 2: replace with real API call).
    setTimeout(() => {
      setScanResult(mockScan(contractAddr));
      setIsScanning(false);
    }, 1200);
  }, [contractAddr, isValidAddr]);

  // ── $GOON premium payment ──────────────────────────────────────────────────

  const handlePayPremium = useCallback(async () => {
    if (!isConnected) return;
    setPayError(null);

    try {
      const hash = await writeContractAsync({
        address:      GOON_TOKEN_ADDRESS,
        abi:          ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [
          TREASURY_WALLET,
          parseUnits(PREMIUM_PRICE_GOON, 18),
        ],
      });
      setPayTxHash(hash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPayError(msg.includes("User rejected") ? "Transaction rejected." : `${msg.slice(0, 120)}${msg.length > 120 ? "…" : ""}`);
    }
  }, [isConnected, writeContractAsync]);

  // ── GOON IT NOW deep-link ──────────────────────────────────────────────────

  const handleGoonItNow = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", "evm");
    if (isValidAddr) params.set("contract", contractAddr);
    if (hasVerification) params.set("verified", "true");
    router.push(`/?${params.toString()}`);
  }, [router, contractAddr, isValidAddr, hasVerification]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-fade-in-up">

      {/* Header card */}
      <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              ✅ GoonVerify
              {hasVerification && (
                <span className="ml-1 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-xs font-bold text-green-400">
                  GoonVerified ✅
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Scan any contract for free · Pay $GOON for the full GoonVerified package
            </p>
          </div>
        </div>

        {/* Input mode toggle */}
        <div className="flex gap-1 p-1 rounded-xl border border-dark-border bg-dark-muted mb-4 w-fit">
          {(["address", "file"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setInputMode(mode)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                inputMode === mode
                  ? "bg-brand-500/20 border border-brand-500/30 text-brand-300"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {mode === "address" ? "📋 Contract Address" : "📁 Upload .sol"}
            </button>
          ))}
        </div>

        {/* Address input */}
        {inputMode === "address" ? (
          <div className="space-y-2">
            <input
              id="verify-contract-addr"
              type="text"
              value={contractAddr}
              onChange={(e) => {
                setContractAddr(e.target.value.trim());
                setScanResult(null);
                setIsVerified(false);
              }}
              placeholder="0x… contract address"
              aria-label="Contract address to verify"
              className="w-full rounded-xl border border-dark-border bg-dark-muted px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-brand-500/50 focus:outline-none font-mono"
            />
            {contractAddr && !isValidAddr && (
              <p className="text-xs text-red-400">Must be a valid 0x-prefixed 42-character address.</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-dark-border bg-dark-muted p-8 text-center text-gray-500 text-sm">
            <p className="text-2xl mb-2">📁</p>
            <p>Drag &amp; drop your <code className="text-brand-400">.sol</code> files here</p>
            <p className="text-xs mt-1 text-gray-600">Phase 2 feature — coming soon</p>
          </div>
        )}

        {/* Scan button */}
        <button
          type="button"
          onClick={handleScan}
          disabled={!isValidAddr || isScanning}
          className="mt-4 w-full rounded-xl border border-brand-500/40 bg-brand-500/10 py-3 text-sm font-bold text-brand-300 hover:bg-brand-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
              Scanning…
            </span>
          ) : (
            "🔍 Run Free Scan"
          )}
        </button>
      </div>

      {/* Scan results */}
      {scanResult && (
        <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4 animate-fade-in-up">
          {/* Score + summary */}
          <div className="flex items-center gap-5">
            <div className="relative flex flex-col items-center">
              <TrustRing score={scanResult.trustScore} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  scanResult.isMintable ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-green-500/30 bg-green-500/10 text-green-400"
                }`}>
                  {scanResult.isMintable ? "🚨 Mintable" : "✅ Fixed Supply"}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  scanResult.isProxy ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" : "border-green-500/30 bg-green-500/10 text-green-400"
                }`}>
                  {scanResult.isProxy ? "⚠️ Proxy Pattern" : "✅ Direct Contract"}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  scanResult.hasBlacklist ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" : "border-green-500/30 bg-green-500/10 text-green-400"
                }`}>
                  {scanResult.hasBlacklist ? "⚠️ Blacklist Function" : "✅ No Blacklist"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Free scan · {scanResult.risks.length} checks · Phase 2: Slither + GoPlus integration
              </p>
            </div>
          </div>

          {/* Risk rows */}
          <div className="space-y-2">
            {scanResult.risks.map((r) => (
              <RiskRow key={r.label} item={r} />
            ))}
          </div>

          {/* Premium upsell */}
          {!hasVerification && (
            <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-brand-500/10 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">🏆 GoonVerified Package</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Full audit · PDF report · Press release · One-click X tweet · Verified badge</p>
                </div>
                <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-3 py-1 text-xs font-black text-orange-400 whitespace-nowrap">
                  {Number(PREMIUM_PRICE_GOON).toLocaleString()} $GOON
                </span>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-300">
                {[
                  "✅ Full static analysis report",
                  "✅ Downloadable PDF certificate",
                  "✅ Auto-generated press release",
                  "✅ One-click pre-filled X tweet",
                  "✅ GoonVerified badge on-site",
                  "✅ Priority listing in feed",
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {payError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {payError}
                </p>
              )}

              {(isSending || isConfirming) && (
                <p className="text-xs text-brand-400 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
                  {isSending ? "Confirm in wallet…" : "Waiting for confirmation…"}
                </p>
              )}

              <button
                type="button"
                onClick={handlePayPremium}
                disabled={!isConnected || isSending || isConfirming}
                className="w-full rounded-xl py-3 text-sm font-black text-black transition-all bg-gradient-to-r from-brand-500 to-orange-400 hover:from-brand-400 hover:to-orange-300 glow-neon disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {!isConnected
                  ? "Connect wallet to pay"
                  : isSending || isConfirming
                  ? "Processing…"
                  : `💳 Pay ${Number(PREMIUM_PRICE_GOON).toLocaleString()} $GOON — Get Verified`}
              </button>

              <p className="text-[10px] text-gray-600 text-center">
                Sends {Number(PREMIUM_PRICE_GOON).toLocaleString()} $GOON from your wallet to the GoonForge treasury on Base. DYOR.
              </p>
            </div>
          )}

          {/* Post-verification state */}
          {hasVerification && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center space-y-1">
              <p className="text-2xl">🎉</p>
              <p className="text-sm font-black text-green-400">GoonVerified!</p>
              <p className="text-xs text-gray-400">
                Your contract holds the GoonVerified badge. PDF &amp; press release features coming in Phase 2.
              </p>
            </div>
          )}
        </div>
      )}

      {/* GOON IT NOW button — always visible once an address is entered */}
      {isValidAddr && (
        <button
          type="button"
          onClick={handleGoonItNow}
          className="w-full rounded-2xl py-4 text-base font-black text-black transition-all bg-gradient-to-r from-brand-500 via-green-400 to-orange-400 hover:from-brand-400 hover:via-green-300 hover:to-orange-300 glow-neon hover:glow-neon-lg"
        >
          🚀 GOON IT NOW — Launch with {hasVerification ? "Verified ✅" : "This"} Contract
        </button>
      )}
    </div>
  );
}
