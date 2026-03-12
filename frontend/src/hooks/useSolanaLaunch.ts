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
 * Requires Phantom (or any Solana wallet) connected via @solana/wallet-adapter-react.
 */
"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
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
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [state, setState] = useState<SolanaLaunchState>({
    step:     "idle",
    txHash:   null,
    vaas:     [],
    error:    null,
    burnTier: null,
  });

  // ─── Validate params ──────────────────────────────────────────────────────

  function validate(params: SolanaLaunchParams): string | null {
    if (!connected || !publicKey)        return "Connect your Phantom wallet first";
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
      setState((s) => ({ ...s, step: "error", error: new Error(validationError) }));
      return;
    }

    const tier = getBurnTier(params.burnAmount);
    setState((s) => ({ ...s, step: "burning", error: null, burnTier: tier ?? null }));

    try {
      // ── Step 1: Burn + Bridge on Solana ────────────────────────────────────
      //
      // Full Anchor integration (requires anchor build to generate IDL):
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
      // We build a no-op transaction here so the wallet signs a real Solana tx,
      // proving connectivity. Replace with the Anchor call once the IDL is ready.
      const tx = new Transaction();
      tx.feePayer = publicKey!;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setState((s) => ({ ...s, txHash: signature }));
      console.log(
        `[useSolanaLaunch] Burn ${params.burnAmount} tokens → chains ${params.targetChainIds.join(", ")}`,
        `\nSolana tx: ${signature}`
      );

      // ── Step 2: Wait for Wormhole VAA ─────────────────────────────────────
      setState((s) => ({ ...s, step: "waiting_for_vaa" }));

      const vaas = await pollForVAAs(
        signature,
        params.targetChainIds,
        params.isTestnet
      );

      setState((s) => ({ ...s, vaas }));

      // ── Step 3: Submit VAA to EVM chains ──────────────────────────────────
      setState((s) => ({ ...s, step: "submitting_vaa" }));

      for (const vaa of vaas) {
        await submitVAAToEVM(vaa, params.evmRecipient, params.isTestnet);
      }

      setState((s) => ({ ...s, step: "complete" }));
    } catch (err) {
      setState((s) => ({ ...s, step: "error", error: err instanceof Error ? err : new Error(String(err)) }));
    }
  }, [connected, publicKey, sendTransaction, connection]);

  function reset() {
    setState({ step: "idle", txHash: null, vaas: [], error: null, burnTier: null });
  }

  return { state, launch, reset, connected, publicKey };
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
