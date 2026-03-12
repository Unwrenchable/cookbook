/**
 * DeployResult.tsx – Post-deploy success card with links and next-step actions.
 */
"use client";

import type { DeployResult as DeployResultType } from "@/hooks/useDeployToken";
import { getChainById } from "@/lib/chains";

interface Props {
  result: DeployResultType;
  chainId: number;
  onReset: () => void;
}

export function DeployResult({ result, chainId, onReset }: Props) {
  const chain = getChainById(chainId);
  const explorerBase = chain?.blockExplorer ?? "";

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎉</span>
        <div>
          <h2 className="text-lg font-bold text-brand-900">Token Deployed!</h2>
          <p className="text-sm text-brand-700">Your token is live on-chain.</p>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl bg-white border border-brand-100 p-4 space-y-3 text-sm">
        <Row label="Token address">
          <code className="break-all font-mono text-xs">{result.tokenAddress}</code>
        </Row>
        <Row label="Tx hash">
          <code className="break-all font-mono text-xs">{result.txHash}</code>
        </Row>
        <Row label="Network">{chain?.name ?? chainId}</Row>
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
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm space-y-2">
        <p className="font-semibold text-gray-700">Next steps</p>
        <ul className="list-inside list-disc space-y-1 text-gray-600">
          <li>Add liquidity on Uniswap / PancakeSwap</li>
          <li>Renounce ownership (from the token contract&apos;s write functions)</li>
          <li>Lock LP tokens via Team Finance or Unicrypt</li>
          <li>Submit a listing on DexTools / CoinGecko</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Launch another token
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
      <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="text-gray-800">{children}</span>
    </div>
  );
}

function ExplorerLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-200 transition-colors"
    >
      {label} ↗
    </a>
  );
}
