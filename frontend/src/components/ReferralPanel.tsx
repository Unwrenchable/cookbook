/**
 * ReferralPanel.tsx – Referral link + earnings claim panel.
 */
"use client";

import { useState } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { getChainById } from "@/lib/chains";
import { TOKEN_FACTORY_ABI } from "@/lib/tokenFactoryAbi";

export function ReferralPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chain = getChainById(chainId);
  const factoryAddress = chain?.factoryAddress as `0x${string}` | undefined;

  const [copied, setCopied] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  const { data: earnings, refetch } = useReadContract(
    factoryAddress && address
      ? {
          address: factoryAddress,
          abi: TOKEN_FACTORY_ABI,
          functionName: "referralEarnings",
          args: [address],
        }
      : undefined
  );

  const { data: referralShareBps } = useReadContract(
    factoryAddress
      ? {
          address: factoryAddress,
          abi: TOKEN_FACTORY_ABI,
          functionName: "referralShareBps",
        }
      : undefined
  );

  const referralPct = referralShareBps !== undefined
    ? `${(Number(referralShareBps) / 100).toFixed(0)}%`
    : "20%";  // display fallback while loading

  const { writeContractAsync, isPending } = useWriteContract();

  const referralUrl =
    typeof window !== "undefined" && address
      ? `${window.location.origin}?ref=${address}`
      : "";

  async function copyLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClaim() {
    if (!factoryAddress) return;
    setClaimError(null);
    setClaimSuccess(false);
    try {
      await writeContractAsync({
        address: factoryAddress,
        abi: TOKEN_FACTORY_ABI,
        functionName: "claimReferralEarnings",
      });
      setClaimSuccess(true);
      await refetch();
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : "Claim failed");
    }
  }

  const earningsBigInt = typeof earnings === "bigint" ? earnings : 0n;
  const earningsEth = (Number(earningsBigInt) / 1e18).toFixed(6);
  const hasEarnings = earningsBigInt > 0n;

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-dark-border bg-dark-card p-6 text-center text-sm text-gray-400 space-y-2">
        <p className="text-2xl">🤝</p>
        <p>Connect your wallet to see your referral link.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold text-white">🤝 Your Referral Link</h3>

      {/* Referral link */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          Share this link. When someone deploys via your link, you earn {referralPct} of their launch fee.
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-dark-border bg-dark-muted px-4 py-3">
          <code className="flex-1 truncate text-xs text-brand-400">
            {referralUrl || "—"}
          </code>
          <button
            type="button"
            onClick={copyLink}
            disabled={!referralUrl}
            className="shrink-0 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-xs text-gray-300 hover:border-brand-500 hover:text-brand-400 transition-colors disabled:opacity-50"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        {copied && (
          <p className="text-xs text-brand-400" aria-live="polite">
            Link copied. Share it anywhere — rewards are tracked on-chain.
          </p>
        )}
      </div>

      {/* Earnings */}
      {factoryAddress ? (
        <div className="rounded-xl border border-dark-border bg-dark-muted p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">Accumulated Earnings</p>
            <p className="text-lg font-bold text-brand-400">
              {earningsEth}{" "}
              <span className="text-sm font-normal text-gray-400">
                {chain?.nativeCurrency.symbol ?? "ETH"}
              </span>
            </p>
          </div>

          {claimSuccess && (
            <p className="text-xs text-green-400">✅ Claimed successfully!</p>
          )}
          {claimError && (
            <p className="text-xs text-red-400">{claimError}</p>
          )}

          <button
            type="button"
            onClick={handleClaim}
            disabled={!hasEarnings || isPending}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Claiming…" : hasEarnings ? "💰 Claim Earnings" : "No earnings yet"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
          ⚠️ No factory deployed on this chain yet. Switch to a supported network.
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-400">How referrals work</p>
        <p>1. Share your link above</p>
        <p>2. When someone launches with <code>?ref=yourAddress</code>, their TX uses <code>createTokenWithReferral</code></p>
        <p>3. 20% of their launch fee is credited to your account on-chain</p>
        <p>4. Claim any time — no expiry</p>
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Referral Top Earners</p>
        <ul className="space-y-2 text-xs text-gray-300">
          <li className="rounded-md border border-dark-border bg-dark-card px-3 py-2">#1 0x91d4…f1a2 · 4.32 ETH · 22 launches</li>
          <li className="rounded-md border border-dark-border bg-dark-card px-3 py-2">#2 0x5c2b…8f88 · 3.11 ETH · 17 launches</li>
          <li className="rounded-md border border-dark-border bg-dark-card px-3 py-2">#3 0xa7e9…d421 · 2.67 ETH · 13 launches</li>
        </ul>
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <Metric label="Your streak tier" value={hasEarnings ? "Alpha" : "Rookie"} />
          <Metric label="Quality rewards" value="Volume consistency" />
          <Metric label="Post-grad share" value="Tiered unlocks" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dark-border bg-dark-card px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-gray-300">{value}</p>
    </div>
  );
}
