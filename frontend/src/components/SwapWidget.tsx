/**
 * SwapWidget.tsx – Quick-launch swap links for each chain's primary DEX,
 * plus a native on-chain swap tab via Uniswap V2 router.
 *
 * v1: Opens the right DEX in a new tab with the token address pre-filled.
 * v2: Direct on-chain swap via DEX router (🔄 On-Chain Swap sub-tab).
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChainId, useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther } from "viem";

// Per-chain DEX config
const SWAP_DEADLINE_SECONDS = 300; // 5 minutes
interface DexConfig {
  name:    string;
  logo:    string;
  url:     (tokenIn: string, tokenOut: string, chain: DexChainKey) => string;
  chains:  number[];
}

type DexChainKey = "ethereum" | "bsc" | "polygon" | "arbitrum" | "base" | "avalanche";

const CHAIN_ID_TO_DEX_KEY: Record<number, DexChainKey> = {
  1:     "ethereum",
  11155111: "ethereum",
  56:    "bsc",
  97:    "bsc",
  137:   "polygon",
  80001: "polygon",
  42161: "arbitrum",
  421614:"arbitrum",
  8453:  "base",
  84532: "base",
  43114: "avalanche",
};

// Native / common token addresses per chain (for the "from" default)
const NATIVE_WRAPPED: Record<DexChainKey, string> = {
  ethereum:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  bsc:       "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  polygon:   "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
  arbitrum:  "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
  base:      "0x4200000000000000000000000000000000000006", // WETH
  avalanche: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
};

const DEXES: DexConfig[] = [
  {
    name:   "Uniswap",
    logo:   "🦄",
    chains: [1, 11155111, 137, 80001, 42161, 421614, 8453, 84532],
    url: (tokenIn, tokenOut, chain) => {
      const base = chain === "base" ? "https://app.uniswap.org/swap" : "https://app.uniswap.org/swap";
      return `${base}?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`;
    },
  },
  {
    name:   "PancakeSwap",
    logo:   "🥞",
    chains: [56, 97, 1, 8453],
    url: (tokenIn, tokenOut) =>
      `https://pancakeswap.finance/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "Trader Joe",
    logo:   "🎰",
    chains: [43114],
    url: (tokenIn, tokenOut) =>
      `https://traderjoexyz.com/avalanche/trade?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "QuickSwap",
    logo:   "⚡",
    chains: [137, 80001],
    url: (tokenIn, tokenOut) =>
      `https://quickswap.exchange/#/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "Camelot",
    logo:   "⚔️",
    chains: [42161, 421614],
    url: (tokenIn, tokenOut) =>
      `https://app.camelot.exchange/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
  },
  {
    name:   "Aerodrome",
    logo:   "🚀",
    chains: [8453, 84532],
    url: (tokenIn, tokenOut) =>
      `https://aerodrome.finance/swap?from=${tokenIn}&to=${tokenOut}`,
  },
];

const inputCls =
  "block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// ─── Uniswap V2 router addresses per chain ────────────────────────────────────
const UNISWAP_V2_ROUTERS: Record<number, `0x${string}`> = {
  1:        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  11155111: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  56:       "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  97:       "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  137:      "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  42161:    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
  8453:     "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  43114:    "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
};

const UNISWAP_V2_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactETHForTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForETH",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Parse a user-entered ETH/token amount string to bigint wei using viem's parseEther
function safeParseEther(val: string): bigint {
  try {
    if (!val || parseFloat(val) <= 0) return 0n;
    return parseEther(val as `${number}`);
  } catch {
    return 0n;
  }
}

export function SwapWidget() {
  const chainId = useChainId();
  const { address } = useAccount();
  const dexKey  = CHAIN_ID_TO_DEX_KEY[chainId] ?? "ethereum";

  const nativeWrapped = NATIVE_WRAPPED[dexKey];
  const [tokenIn,  setTokenIn]  = useState(nativeWrapped);
  const [tokenOut, setTokenOut] = useState("");
  const [subTab,   setSubTab]   = useState<"links" | "onchain">("links");

  // On-chain swap state
  const [swapDirection, setSwapDirection] = useState<"ethToToken" | "tokenToEth">("ethToToken");
  const [amountIn, setAmountIn]   = useState("");
  // Debounced amount used for the read contract call
  const [debouncedAmountIn, setDebouncedAmountIn] = useState("");
  const [estimatedOut, setEstimatedOut] = useState<bigint | null>(null);
  const [swapStatus, setSwapStatus] = useState<"idle" | "approving" | "swapping" | "success" | "error">("idle");
  const [swapError,  setSwapError]  = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAmountChange = useCallback((val: string) => {
    setAmountIn(val);
    setEstimatedOut(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedAmountIn(val), 500);
  }, []);

  const routerAddress = UNISWAP_V2_ROUTERS[chainId];
  const isEthToToken  = swapDirection === "ethToToken";

  // Build swap path
  const swapPath: `0x${string}`[] = (() => {
    const wrapped = nativeWrapped as `0x${string}`;
    const out = tokenOut as `0x${string}`;
    if (!out || out === "0x") return [wrapped, wrapped];
    return isEthToToken ? [wrapped, out] : [out, wrapped];
  })();

  const amountInWei = safeParseEther(amountIn);
  const debouncedAmountInWei = safeParseEther(debouncedAmountIn);

  // getAmountsOut query (debounced — only fires after user stops typing)
  const { data: amountsOut } = useReadContract(
    routerAddress && debouncedAmountInWei > 0n && swapPath[0] !== swapPath[1]
      ? {
          address: routerAddress,
          abi: UNISWAP_V2_ABI,
          functionName: "getAmountsOut",
          args: [debouncedAmountInWei, swapPath],
        }
      : undefined
  );

  // Sync estimated output via useEffect to avoid setState during render
  useEffect(() => {
    if (Array.isArray(amountsOut) && amountsOut.length >= 2) {
      setEstimatedOut(amountsOut[amountsOut.length - 1] as bigint);
    }
  }, [amountsOut]);

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  async function handleSwap() {
    if (!routerAddress || !address || amountInWei === 0n) return;
    setSwapStatus("idle");
    setSwapError(null);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS);
    const amountOutMin = estimatedOut ? (estimatedOut * 99n) / 100n : 0n; // 1% slippage

    try {
      if (isEthToToken) {
        setSwapStatus("swapping");
        await writeContractAsync({
          address: routerAddress,
          abi: UNISWAP_V2_ABI,
          functionName: "swapExactETHForTokens",
          args: [amountOutMin, swapPath, address, deadline],
          value: amountInWei,
        });
      } else {
        // Token → ETH: approve first
        const tokenAddr = tokenOut as `0x${string}`;
        setSwapStatus("approving");
        await writeContractAsync({
          address: tokenAddr,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [routerAddress, amountInWei],
        });
        setSwapStatus("swapping");
        await writeContractAsync({
          address: routerAddress,
          abi: UNISWAP_V2_ABI,
          functionName: "swapExactTokensForETH",
          args: [amountInWei, amountOutMin, swapPath, address, deadline],
        });
      }
      setSwapStatus("success");
    } catch (err: unknown) {
      setSwapError(err instanceof Error ? err.message : "Swap failed");
      setSwapStatus("error");
    }
  }

  const availableDexes = DEXES.filter((d) => d.chains.includes(chainId));

  function swapTokens() {
    const tmp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(tmp);
  }

  function toggleSwapDirection() {
    setSwapDirection((d) => (d === "ethToToken" ? "tokenToEth" : "ethToToken"));
    setEstimatedOut(null);
    setAmountIn("");
  }

  const subTabCls = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"
    }`;

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-xl border border-dark-border bg-dark-card p-1 w-fit">
        <button type="button" onClick={() => setSubTab("links")} className={subTabCls(subTab === "links")}>
          🔗 DEX Links
        </button>
        <button type="button" onClick={() => setSubTab("onchain")} className={subTabCls(subTab === "onchain")}>
          🔄 On-Chain Swap
        </button>
      </div>

      {/* ── DEX Links sub-tab ─────────────────────────────────────────────── */}
      {subTab === "links" && (
        <>
          {/* Token pair inputs */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">From token</label>
            <input
              type="text"
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              placeholder="0x... or paste token address"
              className={inputCls}
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={swapTokens}
              className="rounded-full border border-dark-border bg-dark-card p-2 text-gray-400 hover:text-brand-400 hover:border-brand-600 transition-colors"
              title="Swap direction"
            >
              ⇅
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">To token</label>
            <input
              type="text"
              value={tokenOut}
              onChange={(e) => setTokenOut(e.target.value)}
              placeholder="0x... paste your newly launched token"
              className={inputCls}
            />
            {!tokenOut && (
              <p className="text-xs text-gray-500">
                Paste the token address you just deployed to pre-fill the DEX URL.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">
              Open on {availableDexes.length === 0 ? "a DEX" : "your preferred DEX"}
            </p>
            {availableDexes.length === 0 ? (
              <p className="text-sm text-gray-500">No DEX configured for chain {chainId} yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableDexes.map((dex) => {
                  const href = dex.url(
                    tokenIn  || nativeWrapped,
                    tokenOut || nativeWrapped,
                    dexKey,
                  );
                  return (
                    <a
                      key={dex.name}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-medium text-white hover:border-brand-500 hover:bg-brand-500/10 transition-colors"
                    >
                      <span className="text-lg">{dex.logo}</span>
                      {dex.name}
                      <span className="text-xs text-gray-500">↗</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── On-Chain Swap sub-tab ─────────────────────────────────────────── */}
      {subTab === "onchain" && (
        <div className="space-y-4">
          {!routerAddress ? (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
              ⚠️ No Uniswap V2 router configured for chain {chainId}. Switch to a supported network.
            </div>
          ) : (
            <>
              {/* Direction toggle */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300">
                  {isEthToToken ? "ETH → Token" : "Token → ETH"}
                </span>
                <button
                  type="button"
                  onClick={toggleSwapDirection}
                  className="rounded-full border border-dark-border bg-dark-card p-1.5 text-gray-400 hover:text-brand-400 hover:border-brand-600 transition-colors"
                  title="Toggle swap direction"
                >
                  ⇅
                </button>
              </div>

              {/* Token address */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Token address
                </label>
                <input
                  type="text"
                  value={tokenOut}
                  onChange={(e) => { setTokenOut(e.target.value); setEstimatedOut(null); }}
                  placeholder="0x... token contract address"
                  className={inputCls}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Amount in ({isEthToToken ? "ETH" : "Token"})
                </label>
                <input
                  type="number"
                  value={amountIn}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="any"
                  className={inputCls}
                />
              </div>

              {/* Estimated output */}
              {estimatedOut !== null && (
                <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-300">
                  Estimated output: {isEthToToken
                    ? `${(Number(estimatedOut) / 1e18).toFixed(6)} tokens`
                    : `${(Number(estimatedOut) / 1e18).toFixed(6)} ETH`}
                  <span className="ml-2 text-gray-500">(1% slippage applied)</span>
                </div>
              )}

              {/* Status */}
              {swapStatus === "success" && (
                <p className="text-xs text-green-400">✅ Swap successful!</p>
              )}
              {swapStatus === "error" && swapError && (
                <p className="text-xs text-red-400">{swapError}</p>
              )}
              {swapStatus === "approving" && (
                <p className="text-xs text-yellow-400">⏳ Approving token spend…</p>
              )}
              {swapStatus === "swapping" && (
                <p className="text-xs text-yellow-400">⏳ Swapping…</p>
              )}

              <button
                type="button"
                onClick={handleSwap}
                disabled={isWritePending || !address || amountInWei === 0n || !tokenOut}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                {isWritePending ? "Confirm in wallet…" : `🔄 Swap ${isEthToToken ? "ETH → Token" : "Token → ETH"}`}
              </button>

              {!address && (
                <p className="text-xs text-gray-500 text-center">Connect wallet to swap</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
