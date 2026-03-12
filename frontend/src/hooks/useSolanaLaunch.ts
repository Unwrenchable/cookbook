/**
 * useSolanaLaunch.ts – Hook for the Solana-first cross-chain token launch flow.
 *
 * Steps:
 *  1. Create or reference an existing SPL token mint on Solana.
 *  2. Optionally mint an NFT (Metaplex) for the token's collection.
 *  3. Call the `burn_and_bridge` instruction on the TokenForge Anchor program.
 *  4. Monitor for the Wormhole VAA to be signed by guardians.
 *  5. Submit the VAA to BurnBridgeReceiver.sol on the selected EVM chain(s).
 *
 * @dev This hook requires `@solana/wallet-adapter-react` and `@coral-xyz/anchor`.
 *      The Anchor program interaction is scaffolded here; full SDK integration
 *      requires `anchor build` to generate the IDL and TypeScript bindings.
 */
"use client";

import { useState, useCallback } from "react";
import { BURN_TIERS, getBurnTier, CROSS_CHAIN_TARGETS, WORMHOLE_API } from "@/lib/crossChain";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolanaLaunchParams {
  /** Amount of tokens to burn (human-readable, not raw) */
  burnAmount: number;
  /** Wormhole chain IDs of target EVM chains (0 = all) */
  targetChainIds: number[];
  /** EVM address to receive minted tokens */
  evmRecipient: string;
  /** Use testnet (devnet / testnets) instead of mainnet */
  isTestnet: boolean;
}

export interface WormholeVAA {
  sequence:     string;
  emitterChain: number;
  emitterAddr:  string;
  vaaBytes:     string;   // hex-encoded
  txHash:       string;
}

export type SolanaLaunchStep =
  | "idle"
  | "burning"
  | "waiting_for_vaa"
  | "submitting_vaa"
  | "complete"
  | "error";

export interface SolanaLaunchState {
  step:        SolanaLaunchStep;
  txHash:      string | null;
  vaas:        WormholeVAA[];
  error:       Error | null;
  burnTier:    typeof BURN_TIERS[number] | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSolanaLaunch() {
  const [state, setState] = useState<SolanaLaunchState>({
    step:     "idle",
    txHash:   null,
    vaas:     [],
    error:    null,
    burnTier: null,
  });

  const setStep  = (step: SolanaLaunchStep) => setState((s) => ({ ...s, step }));
  const setError = (error: Error)           => setState((s) => ({ ...s, step: "error", error }));

  // ─── Validate params ──────────────────────────────────────────────────────

  function validate(params: SolanaLaunchParams): string | null {
    if (params.burnAmount <= 0)          return "Burn amount must be positive";
    if (!getBurnTier(params.burnAmount)) return "Burn amount too small (minimum 100 tokens)";
    if (!params.evmRecipient.match(/^0x[0-9a-fA-F]{40}$/)) return "Invalid EVM recipient address";
    if (params.targetChainIds.length === 0) return "Select at least one target EVM chain";
    return null;
  }

  // ─── Core launch flow ─────────────────────────────────────────────────────

  const launch = useCallback(async (params: SolanaLaunchParams): Promise<void> => {
    const validationError = validate(params);
    if (validationError) {
      setError(new Error(validationError));
      return;
    }

    const tier = getBurnTier(params.burnAmount);
    setState((s) => ({ ...s, step: "burning", error: null, burnTier: tier ?? null }));

    try {
      // ── Step 1: Burn + Bridge on Solana ────────────────────────────────────
      //
      // Full integration (requires @coral-xyz/anchor + wallet adapter):
      //
      //   const provider = new AnchorProvider(connection, wallet, {});
      //   const program  = new Program(IDL, PROGRAM_ID, provider);
      //   const tx = await program.methods
      //     .burnAndBridge(
      //       new BN(params.burnAmount * 1e9),
      //       params.targetChainIds[0] ?? 0,
      //       hexToBytes(params.evmRecipient),
      //       1  // consistency level: confirmed
      //     )
      //     .accounts({ ... })
      //     .rpc();
      //
      // For now, we emit a simulation event so the UI can be built and tested.
      const simulatedTxHash = `SIM_${Date.now().toString(16).toUpperCase()}`;
      setState((s) => ({ ...s, txHash: simulatedTxHash }));

      console.log(
        `[useSolanaLaunch] Burn ${params.burnAmount} tokens → chains ${params.targetChainIds.join(", ")}`,
        `\nTx: ${simulatedTxHash}`
      );

      // ── Step 2: Wait for Wormhole VAA ─────────────────────────────────────
      setStep("waiting_for_vaa");

      const vaas = await pollForVAAs(
        simulatedTxHash,
        params.targetChainIds,
        params.isTestnet
      );

      setState((s) => ({ ...s, vaas }));

      // ── Step 3: Submit VAA to EVM chains ──────────────────────────────────
      setStep("submitting_vaa");

      for (const vaa of vaas) {
        await submitVAAToEVM(vaa, params.evmRecipient, params.isTestnet);
      }

      setState((s) => ({ ...s, step: "complete" }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  function reset() {
    setState({ step: "idle", txHash: null, vaas: [], error: null, burnTier: null });
  }

  return { state, launch, reset };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Poll the Wormhole Scan API for the VAA(s) produced by a given Solana tx.
 *
 * In production, poll:
 *   GET /api/v1/vaas/{emitterChain}/{emitterAddress}/{sequence}
 *
 * Here we simulate a response after a short delay.
 */
async function pollForVAAs(
  txHash:         string,
  targetChainIds: number[],
  isTestnet:      boolean,
  maxRetries     = 30,
  delayMs        = 4_000
): Promise<WormholeVAA[]> {
  const apiBase = isTestnet ? WORMHOLE_API.testnet : WORMHOLE_API.mainnet;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const url = `${apiBase}/api/v1/vaas/1?txHash=${txHash}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.length > 0) {
          return data.data.map((v: any) => ({
            sequence:     String(v.sequence),
            emitterChain: v.emitterChain,
            emitterAddr:  v.emitterAddr,
            vaaBytes:     v.vaa,
            txHash,
          }));
        }
      }
    } catch {
      // network errors during polling are expected — keep retrying
    }

    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Simulation fallback (development)
  console.warn("[useSolanaLaunch] Wormhole VAA polling timed out — using simulated VAA");
  return targetChainIds.map((chainId) => ({
    sequence:     String(Date.now()),
    emitterChain: 1,
    emitterAddr:  "0000000000000000000000000000000000000000000000000000000000000001",
    vaaBytes:     "0x" + "ab".repeat(100),
    txHash,
  }));
}

/**
 * Submit a VAA to the BurnBridgeReceiver on the target EVM chain.
 *
 * Full integration (using viem):
 *   const publicClient  = createPublicClient({ chain, transport: http(rpcUrl) });
 *   const walletClient  = createWalletClient({ chain, transport: custom(window.ethereum) });
 *   await walletClient.writeContract({
 *     address: receiverAddress,
 *     abi:     BURN_BRIDGE_RECEIVER_ABI,
 *     functionName: "receiveRelayedMessage",
 *     args:    [vaa.vaaBytes, messageKey],
 *   });
 *
 * For now, we log the call for integration testing.
 */
async function submitVAAToEVM(
  vaa:          WormholeVAA,
  evmRecipient: string,
  isTestnet:    boolean
): Promise<void> {
  const target = CROSS_CHAIN_TARGETS.find((t) => t.wormholeChainId === vaa.emitterChain);
  if (!target) {
    console.warn(`[useSolanaLaunch] No EVM target for Wormhole chain ${vaa.emitterChain}`);
    return;
  }

  console.log(
    `[useSolanaLaunch] Submit VAA to ${target.name}`,
    `\nReceiver: ${target.receiverAddress}`,
    `\nSequence: ${vaa.sequence}`,
    `\nRecipient: ${evmRecipient}`
  );

  // TODO: viem writeContract call to BurnBridgeReceiver
  await new Promise((r) => setTimeout(r, 500)); // simulate network delay
}
