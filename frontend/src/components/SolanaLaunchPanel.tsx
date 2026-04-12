/**
 * SolanaLaunchPanel.tsx – UI for the Solana-first cross-chain burn-to-activate mechanic.
 *
 * The user:
 *  1. Connects their Phantom / Solflare / Backpack wallet via the wallet-adapter button.
 *  2. Pastes their SPL token mint address.
 *  3. Selects how many SPL tokens to burn (chooses a burn tier).
 *  4. Chooses which EVM chains to activate.
 *  5. Enters their EVM recipient address.
 *  6. Clicks "Burn & Activate" → wallet signs the Solana tx → Wormhole VAA → EVM mint.
 */
"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  BURN_TIERS,
  getBurnTier,
  TESTNET_TARGETS,
  MAINNET_TARGETS,
} from "@/lib/crossChain";
import { TOKEN_BURN_BRIDGE_PROGRAM_ID } from "@/lib/solanaIdl";
import { useSolanaLaunch } from "@/hooks/useSolanaLaunch";

interface Props {
  isTestnet: boolean;
}

export function SolanaLaunchPanel({ isTestnet }: Props) {
  const targets = isTestnet ? TESTNET_TARGETS : MAINNET_TARGETS;
  const { state, launch, reset, connected, publicKey } = useSolanaLaunch();

  const [tokenMint,      setTokenMint]      = useState("");
  const [burnAmount,     setBurnAmount]     = useState(100);
  const [evmRecipient,   setEvmRecipient]   = useState("");
  const [selectedChains, setSelectedChains] = useState<number[]>([]);

  const armedTargets      = targets.filter((t) => Boolean(t.receiverAddress));
  const tier              = getBurnTier(burnAmount);
  const maxChainsAllowed  = tier
    ? tier.chainsActivated === Infinity
      ? targets.length
      : tier.chainsActivated
    : 0;
  const hasRealProgramId  = TOKEN_BURN_BRIDGE_PROGRAM_ID !== "11111111111111111111111111111111";
  const bridgeIsArmed     = hasRealProgramId && armedTargets.length > 0;

  function toggleChain(chainId: number) {
    setSelectedChains((prev) => {
      if (prev.includes(chainId)) return prev.filter((c) => c !== chainId);
      if (prev.length >= maxChainsAllowed) return [...prev.slice(1), chainId];
      return [...prev, chainId];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await launch({
      tokenMint,
      burnAmount,
      targetChainIds: selectedChains,
      evmRecipient,
      isTestnet,
    });
  }

  if (state.step === "complete") {
    return (
      <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <h3 className="text-lg font-bold text-brand-300">Chains Activated!</h3>
            <p className="text-sm text-brand-400">
              Your Solana burn activated tokens on {selectedChains.length} EVM chain(s).
            </p>
          </div>
        </div>
        {state.txHash && (
          <div className="text-xs font-mono text-gray-400 break-all">
            Solana Tx: {state.txHash}
          </div>
        )}
        <ul className="space-y-1 text-sm">
          {state.evmResults.length > 0
            ? state.evmResults.map((r) => (
                <li key={r.chainName} className="flex items-center gap-2 text-gray-300">
                  <span className={r.txHash ? "text-green-400" : "text-red-400"}>
                    {r.txHash ? "✓" : "✗"}
                  </span>
                  {r.chainName}
                  {r.txHash && (
                    <span className="text-xs font-mono text-gray-500 truncate">
                      {r.txHash.slice(0, 10)}…
                    </span>
                  )}
                </li>
              ))
            : selectedChains.map((chainId) => {
                const t = targets.find((x) => x.wormholeChainId === chainId);
                return t ? (
                  <li key={chainId} className="flex items-center gap-2 text-gray-300">
                    <span className="text-green-400">✓</span> {t.name}
                  </li>
                ) : null;
              })}
        </ul>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl border border-dark-border bg-dark-muted px-6 py-2 text-sm font-medium text-gray-200 hover:bg-dark-card transition-colors"
        >
          Burn again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ─── Wallet connect ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
        <div>
          <p className="font-semibold text-purple-300 text-sm">Solana Wallet</p>
          {connected && publicKey ? (
            <p className="text-xs font-mono text-purple-400 break-all mt-0.5">
              {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
            </p>
          ) : (
            <p className="text-xs text-purple-400 mt-0.5">
              Phantom · Solflare · Coinbase Wallet
            </p>
          )}
        </div>
        <WalletMultiButton
          style={{
            background:   connected ? "rgba(163,230,53,0.1)"  : "rgba(124,58,237,0.2)",
            border:       `1px solid ${connected ? "rgba(163,230,53,0.35)" : "rgba(124,58,237,0.5)"}`,
            borderRadius: "0.75rem",
            color:        connected ? "#a3e635" : "#c4b5fd",
            fontSize:     "0.875rem",
            fontWeight:   600,
            padding:      "0.5rem 1.25rem",
            height:       "auto",
            whiteSpace:   "nowrap",
          }}
        />
      </div>

      {/* ─── Explainer ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-300">
        <p className="font-semibold text-base mb-1 text-blue-200">🌉 Solana-First Cross-Chain Launch</p>
        <p>
          Burn SPL tokens on Solana to <strong className="text-blue-200">activate</strong> ERC20 minting on EVM chains.
          Wormhole carries the proof, and today&apos;s UI uses the trusted-relayer path while the direct VAA receiver is being hardened.
          More you burn, more chains you unlock.
        </p>
      </div>

      {/* ─── Bridge readiness ─────────────────────────────────────────── */}
      <div className={`rounded-xl border p-4 text-sm ${
        bridgeIsArmed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
      }`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-base">
              {bridgeIsArmed ? "✅ Bridge route armed" : "⚠️ Bridge still needs setup"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-inherit/90">
              {!hasRealProgramId
                ? "The Solana program ID is still the placeholder value. Deploy the Anchor program and set NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID before using mainnet burns."
                : armedTargets.length === 0
                ? "No EVM receiver contracts are configured for the selected environment yet. Add the NEXT_PUBLIC_RECEIVER_* envs to enable chain activation."
                : "The route is configured, but EVM minting still uses the trusted-relayer beta path until full Wormhole receiveMessage() verification is enabled."}
            </p>
          </div>
          <div className="rounded-lg border border-current/20 bg-black/10 px-3 py-2 text-[11px] font-mono break-all">
            {TOKEN_BURN_BRIDGE_PROGRAM_ID.slice(0, 6)}…{TOKEN_BURN_BRIDGE_PROGRAM_ID.slice(-6)}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-current/15 bg-black/10 px-3 py-2">
            <span className="font-semibold">Live receivers:</span> {armedTargets.length}/{targets.length}
          </div>
          <div className="rounded-lg border border-current/15 bg-black/10 px-3 py-2">
            <span className="font-semibold">Mode:</span> {bridgeIsArmed ? "Trusted-relayer beta" : "Configuration pending"}
          </div>
        </div>
      </div>

      {/* ─── SPL token mint ────────────────────────────────────────────── */}
      <div>
        <label htmlFor="sl-token-mint" className="block text-sm font-medium text-gray-300 mb-1">
          SPL Token Mint Address
          <span className="ml-2 text-xs text-gray-500">(the token you want to burn)</span>
        </label>
        <input
          id="sl-token-mint"
          type="text"
          value={tokenMint}
          onChange={(e) => setTokenMint(e.target.value.trim())}
          placeholder="So1anaM1ntAddressXXXXXXXXXXXXXXXXXXXXXXXX"
          className="block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* ─── Burn tiers ────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Burn Tier
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BURN_TIERS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setBurnAmount(t.minBurn)}
              className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                tier?.label === t.label
                  ? "border-brand-500/60 bg-brand-500/15 text-brand-300"
                  : "border-dark-border bg-dark-muted text-gray-400 hover:border-brand-500/40 hover:text-gray-200"
              }`}
            >
              <div className="font-bold">{t.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Burn amount ───────────────────────────────────────────────── */}
      <div>
        <label htmlFor="sl-burn-amount" className="block text-sm font-medium text-gray-300 mb-1">
          Tokens to Burn
          {tier && (
            <span className="ml-2 text-xs text-gray-500">
              (activates {tier.chainsActivated === Infinity ? "all" : tier.chainsActivated} chain{tier.chainsActivated !== 1 ? "s" : ""})
            </span>
          )}
        </label>
        <input
          id="sl-burn-amount"
          type="number"
          value={burnAmount}
          onChange={(e) => setBurnAmount(Number(e.target.value))}
          min={100}
          step={100}
          className="block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2 text-sm text-gray-200 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {!tier && burnAmount > 0 && (
          <p className="mt-1 text-xs text-red-400">Minimum burn is 100 tokens</p>
        )}
      </div>

      {/* ─── Target EVM chains ─────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Target EVM Chains
          <span className="ml-2 text-xs font-normal text-gray-500">
            (select up to {maxChainsAllowed})
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {targets.map((t) => {
            const isSelected = selectedChains.includes(t.wormholeChainId);
            const isUnavailable = !t.receiverAddress;
            const isDisabled = isUnavailable || (!isSelected && selectedChains.length >= maxChainsAllowed);
            return (
              <button
                key={t.evmChainId}
                type="button"
                disabled={isDisabled}
                onClick={() => toggleChain(t.wormholeChainId)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? "border-orange-500/60 bg-orange-500/15 text-orange-300 font-medium"
                    : isDisabled
                    ? "border-dark-border bg-dark-muted/50 text-gray-600 cursor-not-allowed"
                    : "border-dark-border bg-dark-muted text-gray-400 hover:border-orange-500/40 hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isSelected && <span>🔥</span>}
                  {t.name}
                </span>
                {isUnavailable && (
                  <span className="rounded-full border border-dark-border px-2 py-0.5 text-[10px] text-gray-500">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── EVM Recipient ─────────────────────────────────────────────── */}
      <div>
        <label htmlFor="sl-evm-recipient" className="block text-sm font-medium text-gray-300 mb-1">
          EVM Recipient Address
          <span className="ml-2 text-xs text-gray-500">(receives minted tokens)</span>
        </label>
        <input
          id="sl-evm-recipient"
          type="text"
          value={evmRecipient}
          onChange={(e) => setEvmRecipient(e.target.value)}
          placeholder="0x..."
          className="block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* ─── Flow diagram ──────────────────────────────────────────────── */}
      {selectedChains.length > 0 && evmRecipient && tokenMint && (
        <div className="rounded-xl border border-dark-border bg-dark-muted/50 p-4 text-xs text-gray-400 space-y-1.5">
          <p className="font-semibold text-gray-300 text-sm">What will happen:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Wallet signs the Solana burn transaction</li>
            <li>Anchor program burns <strong className="text-gray-200">{burnAmount} SPL tokens</strong> from mint{" "}
              <span className="font-mono text-gray-300">{tokenMint.slice(0, 6)}…{tokenMint.slice(-4)}</span>
            </li>
            <li>Wormhole guardians sign the burn VAA (~13 s on mainnet)</li>
            <li>
              ERC20 tokens minted on:{" "}
              <strong className="text-gray-200">
                {selectedChains
                  .map((id) => targets.find((t) => t.wormholeChainId === id)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </strong>
            </li>
          </ol>
        </div>
      )}

      {/* ─── Status ────────────────────────────────────────────────────── */}
      {state.step !== "idle" && state.step !== "error" && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="animate-spin text-xl">⚙️</span>
          {state.step === "burning"          && "Burning tokens on Solana…"}
          {state.step === "waiting_for_vaa"  && "Waiting for Wormhole VAA (~13 seconds)…"}
          {state.step === "submitting_vaa"   && "Submitting proof to EVM chain(s)…"}
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error.message}
        </div>
      )}

      {/* ─── Submit ────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={
          !connected ||
          !tier ||
          !tokenMint ||
          selectedChains.length === 0 ||
          !evmRecipient.match(/^0x[0-9a-fA-F]{40}$/) ||
          (state.step !== "idle" && state.step !== "error")
        }
        className="w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {!connected ? "Connect Solana wallet to continue" : "🔥 Burn & Activate Chains"}
      </button>
    </form>
  );
}
