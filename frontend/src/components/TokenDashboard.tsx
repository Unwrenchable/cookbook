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

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        {tokens.length} token{tokens.length !== 1 ? "s" : ""} deployed on {chainConfig?.name}
      </p>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
        {tokens.map((addr) => (
          <li key={addr} className="flex items-center justify-between px-4 py-3">
            <code className="text-xs font-mono text-gray-700 break-all">{addr}</code>
            {chainConfig?.blockExplorer && (
              <a
                href={`${chainConfig.blockExplorer}/address/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 shrink-0 text-xs text-brand-600 hover:underline"
              >
                View ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
