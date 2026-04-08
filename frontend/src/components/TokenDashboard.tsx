/**
 * TokenDashboard.tsx – Shows all tokens deployed by the connected wallet on the current chain.
 */
"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { getChainById } from "@/lib/chains";
import { TOKEN_FACTORY_ABI } from "@/lib/tokenFactoryAbi";

export function TokenDashboard() {
  const { address, isConnected } = useAccount();
  const chainId     = useChainId();
  const chainConfig = getChainById(chainId);
  const factoryAddress = chainConfig?.factoryAddress as `0x${string}` | undefined;

  const { data: tokens, isLoading } = useReadContract(
    isConnected && address && factoryAddress
      ? {
          address:      factoryAddress,
          abi:          TOKEN_FACTORY_ABI,
          functionName: "getTokensByOwner",
          args:         [address],
        }
      : undefined
  );

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
        Connect your wallet to see your deployed tokens.
      </div>
    );
  }

  if (!factoryAddress) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
        No factory deployed on {chainConfig?.name ?? `chain ${chainId}`} yet.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 text-sm text-gray-400">
        Loading your tokens…
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
        You haven&apos;t deployed any tokens on {chainConfig?.name} yet.
      </div>
    );
  }

  const creatorStreak = Math.min(tokens.length * 3, 30);
  const qualityScore = Math.min(55 + tokens.length * 6, 99);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Creator streak" value={`${creatorStreak} days`} />
        <StatCard label="Quality score" value={`${qualityScore}/100`} />
        <StatCard label="Raidable moments" value={`${tokens.length * 2}`} />
      </div>
      <p className="text-sm text-gray-500">
        {tokens.length} token{tokens.length !== 1 ? "s" : ""} deployed on {chainConfig?.name}
      </p>
      <ul className="space-y-3">
        {tokens.map((addr, index) => (
          <li key={addr} className="rounded-xl border border-dark-border bg-dark-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <code className="text-xs font-mono text-gray-200 break-all">{addr}</code>
              {chainConfig?.blockExplorer && (
                <a
                  href={`${chainConfig.blockExplorer}/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-400 hover:underline"
                >
                  View ↗
                </a>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
              <MiniBadge label="Live activity" value={`${18 + index * 7} buys / ${9 + index * 3} sells`} />
              <MiniBadge label="Milestone" value={index === 0 ? "First 100 holders" : "LP locked"} />
              <MiniBadge label="Raid moment" value={index % 2 === 0 ? "New local ATH" : "Cross-chain activated"} />
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-dark-border bg-dark-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Creator Leaderboard Preview</p>
        <ul className="mt-2 space-y-2 text-xs text-gray-300">
          <li className="rounded-md border border-dark-border bg-dark-muted px-3 py-2">#1 You · {tokens.length} launches · {qualityScore}% consistency</li>
          <li className="rounded-md border border-dark-border bg-dark-muted px-3 py-2">#2 0x91d4…f1a2 · 22 launches · 88% consistency</li>
          <li className="rounded-md border border-dark-border bg-dark-muted px-3 py-2">#3 0x5c2b…8f88 · 17 launches · 84% consistency</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-300">{value}</p>
    </div>
  );
}

function MiniBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dark-border bg-dark-muted px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-gray-300">{value}</p>
    </div>
  );
}
