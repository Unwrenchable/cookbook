/**
 * DeployResult.tsx – Post-deploy success card with links and next-step actions.
 */
"use client";

import { useState } from "react";
import type { DeployResult as DeployResultType } from "@/hooks/useDeployToken";
import { getChainById } from "@/lib/chains";
import { ListingHelper } from "@/components/ListingHelper";
import { AuditReport } from "@/components/AuditReport";

interface Props {
  result: DeployResultType;
  chainId: number;
  onReset: () => void;
  tokenName?: string;
  tokenSymbol?: string;
  ownerAddress?: string;
  flavor?: number;
}

export function DeployResult({ result, chainId, onReset, tokenName = "", tokenSymbol = "", ownerAddress = "", flavor = 0 }: Props) {
  const chain = getChainById(chainId);
  const explorerBase = chain?.blockExplorer ?? "";
  const [copied, setCopied] = useState<string | null>(null);

  const swapUrl = buildSwapUrl(chainId, result.tokenAddress);
  const raidText = encodeURIComponent(
    `🚀 ${tokenName || "New token"} ${tokenSymbol ? `($${tokenSymbol})` : ""} is live on ${chain?.name ?? "chain"}.\n` +
    `Contract: ${result.tokenAddress}\n` +
    `TX: ${explorerBase ? `${explorerBase}/tx/${result.txHash}` : result.txHash}\n` +
    "#GOONFORGE #degen"
  );
  const raidXUrl = `https://x.com/intent/post?text=${raidText}`;

  async function copy(text: string, key: string) {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="rounded-2xl border border-dark-border bg-dark-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎉</span>
        <div>
          <h2 className="text-lg font-bold text-white">Token Deployed!</h2>
          <p className="text-sm text-brand-300">Your token is live on-chain.</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        {["Launch", "Liquidity", "Lock", "Community", "Listings"].map((step, i) => (
          <div
            key={step}
            className={`rounded-lg border px-3 py-2 text-xs ${
              i === 0
                ? "border-brand-500/40 bg-brand-500/10 text-brand-300"
                : "border-dark-border bg-dark-muted text-gray-500"
            }`}
          >
            <p className="font-semibold">{i === 0 ? "✓" : i + 1}. {step}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="rounded-xl bg-dark-muted border border-dark-border p-4 space-y-3 text-sm">
        <Row label="Token address">
          <code className="break-all font-mono text-xs text-brand-300">{result.tokenAddress}</code>
        </Row>
        <Row label="Tx hash">
          <code className="break-all font-mono text-xs text-brand-300">{result.txHash}</code>
        </Row>
        <Row label="Network"><span className="text-gray-200">{chain?.name ?? chainId}</span></Row>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <ActionButton label="💧 Add LP" onClick={() => window.open(swapUrl, "_blank", "noopener,noreferrer")} />
        <ActionButton label="🔒 Lock LP (open tab)" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <ActionButton label="💱 Open Swap" onClick={() => window.open(swapUrl, "_blank", "noopener,noreferrer")} />
        <ActionButton
          label={copied === "ref" ? "✅ Copied Referral" : "🤝 Copy Referral"}
          onClick={() => copy(`${window.location.origin}?ref=${ownerAddress || result.tokenAddress}`, "ref")}
        />
        <ActionButton
          label={copied === "raid" ? "✅ Copied Raid Post" : "📣 Copy Raid Post"}
          onClick={() => copy(decodeURIComponent(raidText), "raid")}
        />
        <ActionButton label="📍 Track TX" onClick={() => explorerBase && window.open(`${explorerBase}/tx/${result.txHash}`, "_blank", "noopener,noreferrer")} />
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 text-sm space-y-2">
        <p className="font-semibold text-white">Trust badges</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge>✅ Factory deploy</Badge>
          <Badge>⚖️ Fee limits enforced</Badge>
          <Badge>{flavor === 1 ? "⚠️ Tax token" : "✅ Standard tax profile"}</Badge>
          <Badge>{ownerAddress ? "👤 Owner wallet set" : "⚠️ Owner not provided"}</Badge>
        </div>
      </div>

      {/* Action links */}
      <div className="flex flex-wrap gap-2">
        {explorerBase && result.tokenAddress !== "0x" && (
          <ExplorerLink
            href={`${explorerBase}/address/${result.tokenAddress}`}
            label="View Token"
          />
        )}
        {explorerBase && (
          <ExplorerLink
            href={`${explorerBase}/tx/${result.txHash}`}
            label="View Transaction"
          />
        )}
      </div>

      {/* Next steps */}
      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 text-sm space-y-2">
        <p className="font-semibold text-white">Next steps</p>
        <ul className="list-inside list-disc space-y-1 text-gray-300">
          <li>Add liquidity on Uniswap / PancakeSwap</li>
          <li>
            🔒 Lock LP tokens using the{" "}
            <strong>Lock LP</strong> tab above — no third party needed
          </li>
          <li>
            💱 Swap instantly via the <strong>Swap</strong> tab
          </li>
          <li>Renounce ownership (from the token contract&apos;s write functions)</li>
          <li>Submit a listing on DexTools / CoinGecko</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-dark-border bg-dark-muted px-6 py-2 text-sm font-medium text-gray-200 hover:border-brand-500 transition-colors"
      >
        Launch another token
      </button>

      {/* Listing helper */}
      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 space-y-2">
        <ListingHelper
          tokenAddress={result.tokenAddress}
          chainId={chainId}
          tokenName={tokenName}
          tokenSymbol={tokenSymbol}
        />
      </div>

      {/* Audit report */}
      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 space-y-2">
        <AuditReport
          tokenAddress={result.tokenAddress}
          ownerAddress={ownerAddress}
          flavor={flavor}
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
      <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="text-gray-200">{children}</span>
    </div>
  );
}

function ExplorerLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-sm font-medium text-brand-300 hover:bg-brand-500/20 transition-colors"
    >
      {label} ↗
    </a>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-dark-border bg-dark-muted px-3 py-2 text-xs font-semibold text-gray-200 hover:border-brand-500 hover:text-brand-300 transition-colors"
    >
      {label}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-dark-border bg-dark-card px-2.5 py-1 text-gray-300">{children}</span>;
}

function buildSwapUrl(chainId: number, tokenAddress: string) {
  if (chainId === 56 || chainId === 97) {
    return `https://pancakeswap.finance/swap?outputCurrency=${tokenAddress}`;
  }
  return `https://app.uniswap.org/swap?outputCurrency=${tokenAddress}`;
}
