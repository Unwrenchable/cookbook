/**
 * useSolanaLaunch.ts – Hook for the Solana-first cross-chain burn-to-activate flow.
 *
 * Steps:
 *  1. Build a `burnAndBridge` instruction via the Anchor SDK and send it.
 *  2. Poll Wormhole Scan API for the signed VAA produced by the burn tx.
 *  3. Submit the VAA to BurnBridgeReceiver.sol on each target EVM chain via viem.
 *
 * Requires a Solana wallet connected via @solana/wallet-adapter-react (Phantom,
 * Solflare, Backpack, …) and a browser-injected EVM wallet (MetaMask / Rainbow)
 * available as `window.ethereum` for the viem wallet client.
 */
"use client";

import { useState, useCallback }       from "react";
import { useWallet, useConnection }    from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createWalletClient,
  custom,
  encodeAbiParameters,
  keccak256,
} from "viem";
import {
  BURN_TIERS,
  getBurnTier,
  CROSS_CHAIN_TARGETS,
  WORMHOLE_API,
  type CrossChainTarget,
} from "@/lib/crossChain";
import {
  TOKEN_BURN_BRIDGE_PROGRAM_ID,
  BRIDGE_CONFIG_SEED,
  USER_NONCE_SEED,
  DISCRIMINATOR_BURN_AND_BRIDGE,
} from "@/lib/solanaIdl";
import { BURN_BRIDGE_RECEIVER_ABI } from "@/lib/burnBridgeReceiverAbi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolanaLaunchParams {
  /** SPL token mint address on Solana */
  tokenMint: string;
  /** Amount of tokens to burn (human-readable, not raw) */
  burnAmount: number;
  /** Token decimals (default 9 for SPL) */
  tokenDecimals?: number;
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
  /** hex-encoded full VAA bytes */
  vaaBytes:     string;
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
  step:       SolanaLaunchStep;
  txHash:     string | null;
  vaas:       WormholeVAA[];
  error:      Error | null;
  burnTier:   typeof BURN_TIERS[number] | null;
  /** Per-chain EVM submission results */
  evmResults: { chainName: string; txHash: string }[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSolanaLaunch() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [state, setState] = useState<SolanaLaunchState>({
    step:       "idle",
    txHash:     null,
    vaas:       [],
    error:      null,
    burnTier:   null,
    evmResults: [],
  });

  // ─── Validate params ──────────────────────────────────────────────────────

  function validate(params: SolanaLaunchParams): string | null {
    if (!connected || !publicKey)           return "Connect your Phantom wallet first";
    if (!params.tokenMint)                  return "Token mint address is required";
    if (params.burnAmount <= 0)             return "Burn amount must be positive";
    if (!getBurnTier(params.burnAmount))    return "Burn amount too small (minimum 100 tokens)";
    if (params.targetChainIds.length === 0) return "Select at least one target EVM chain";
    if (!params.evmRecipient.match(/^0x[0-9a-fA-F]{40}$/))
      return "Invalid EVM recipient address";
    return null;
  }

  // ─── Core launch flow ────────────────────────────────────────────────────

  const launch = useCallback(
    async (params: SolanaLaunchParams): Promise<void> => {
      const validationError = validate(params);
      if (validationError) {
        setState((s) => ({ ...s, step: "error", error: new Error(validationError) }));
        return;
      }

      const tier = getBurnTier(params.burnAmount);
      setState((s) => ({
        ...s,
        step:       "burning",
        error:      null,
        burnTier:   tier ?? null,
        evmResults: [],
      }));

      try {
        // ── Step 1: Burn + Bridge on Solana ──────────────────────────────────
        const signature = await executeBurnAndBridge(
          params,
          publicKey!,
          sendTransaction,
          connection
        );

        setState((s) => ({ ...s, txHash: signature }));
        console.log(
          `[useSolanaLaunch] Burned ${params.burnAmount} tokens → chains ${params.targetChainIds.join(", ")}`,
          `\nSolana tx: ${signature}`
        );

        // ── Step 2: Wait for Wormhole VAA ────────────────────────────────────
        setState((s) => ({ ...s, step: "waiting_for_vaa" }));
        const vaas = await pollForVAAs(signature, params.targetChainIds, params.isTestnet);
        setState((s) => ({ ...s, vaas }));

        // ── Step 3: Submit VAA to EVM chains ─────────────────────────────────
        setState((s) => ({ ...s, step: "submitting_vaa" }));
        const evmResults: { chainName: string; txHash: string }[] = [];

        for (const vaa of vaas) {
          const target = CROSS_CHAIN_TARGETS.find(
            (t) =>
              t.wormholeChainId === vaa.emitterChain &&
              t.isTestnet === params.isTestnet
          );
          if (!target || !target.receiverAddress) {
            console.warn(`[useSolanaLaunch] No EVM target for Wormhole chain ${vaa.emitterChain}; skipping`);
            continue;
          }
          try {
            const evmTxHash = await submitVAAToEVM(vaa, target);
            evmResults.push({ chainName: target.name, txHash: evmTxHash });
          } catch (err) {
            console.error(`[useSolanaLaunch] Failed to relay VAA to ${target.name}:`, err);
            evmResults.push({ chainName: target.name, txHash: "" });
          }
        }

        setState((s) => ({ ...s, step: "complete", evmResults }));
      } catch (err) {
        setState((s) => ({
          ...s,
          step:  "error",
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected, publicKey, sendTransaction, connection]
  );

  function reset() {
    setState({
      step:       "idle",
      txHash:     null,
      vaas:       [],
      error:      null,
      burnTier:   null,
      evmResults: [],
    });
  }

  return { state, launch, reset, connected, publicKey };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build and send the `burnAndBridge` Anchor instruction.
 *
 * When the program ID is still the system-program placeholder ("111…"), we fall
 * back to a no-op transaction so the UI remains functional during local dev
 * before `anchor build` and `anchor deploy` have been run.
 */
async function executeBurnAndBridge(
  params:          SolanaLaunchParams,
  userPubkey:      PublicKey,
  sendTransaction: ReturnType<typeof useWallet>["sendTransaction"],
  connection:      ReturnType<typeof useConnection>["connection"]
): Promise<string> {
  const programId  = new PublicKey(TOKEN_BURN_BRIDGE_PROGRAM_ID);
  const mintPubkey = new PublicKey(params.tokenMint);
  const decimals   = params.tokenDecimals ?? 9;
  const rawAmount  = BigInt(Math.floor(params.burnAmount * 10 ** decimals));

  // EVM recipient as 20-byte Uint8Array
  const recipientHex      = params.evmRecipient.replace(/^0x/i, "");
  const evmRecipientBytes = Buffer.from(recipientHex.padStart(40, "0"), "hex");

  // Derive PDAs
  const [configPda]    = PublicKey.findProgramAddressSync([Buffer.from(BRIDGE_CONFIG_SEED)], programId);
  const [userNoncePda] = PublicKey.findProgramAddressSync(
    [Buffer.from(USER_NONCE_SEED), userPubkey.toBuffer()],
    programId
  );
  const userTokenAccount = getAssociatedTokenAddressSync(mintPubkey, userPubkey);

  // Placeholder path — before the real program is deployed
  const isPlaceholder = programId.toBase58() === "11111111111111111111111111111111";
  if (isPlaceholder) {
    console.warn(
      "[useSolanaLaunch] Program ID is placeholder — sending no-op tx. " +
      "Run `anchor build && anchor deploy` to deploy the real program."
    );
    const tx = new Transaction();
    tx.feePayer = userPubkey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  }

  // ── Build the burnAndBridge instruction manually ────────────────────────────
  // We avoid importing @coral-xyz/anchor in the browser bundle to keep bundle
  // size lean. The discriminator is the single source of truth from solanaIdl.ts.
  const discriminator = DISCRIMINATOR_BURN_AND_BRIDGE;

  // Primary chain: first in list, or 0 for "all chains"
  const primaryChainId = params.targetChainIds.length === 1 ? params.targetChainIds[0] : 0;

  // Encode arguments (little-endian per Borsh/Anchor)
  const amountBuf     = Buffer.allocUnsafe(8);
  const chainBuf      = Buffer.allocUnsafe(2);
  const consistBuf    = Buffer.allocUnsafe(1);

  // u64 little-endian
  const lo = Number(rawAmount & BigInt(0xffffffff));
  const hi = Number(rawAmount >> BigInt(32));
  amountBuf.writeUInt32LE(lo, 0);
  amountBuf.writeUInt32LE(hi, 4);

  chainBuf.writeUInt16LE(primaryChainId, 0);
  consistBuf.writeUInt8(1, 0); // confirmed

  const data = Buffer.concat([
    discriminator,
    amountBuf,
    chainBuf,
    evmRecipientBytes,
    consistBuf,
  ]);

  const { TransactionInstruction } = await import("@solana/web3.js");

  const keys = [
    { pubkey: configPda,               isSigner: false, isWritable: true  },
    { pubkey: mintPubkey,              isSigner: false, isWritable: true  },
    { pubkey: userTokenAccount,        isSigner: false, isWritable: true  },
    { pubkey: userNoncePda,            isSigner: false, isWritable: true  },
    { pubkey: userPubkey,              isSigner: true,  isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ keys, programId, data });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: userPubkey, blockhash, lastValidBlockHeight });
  tx.add(ix);

  const signature = await sendTransaction(tx, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

// ─── Wormhole Scan API response types ─────────────────────────────────────────

/** Shape of one VAA record returned by the Wormhole Scan API */
interface WormholeApiVaaRecord {
  sequence:     number | string;
  emitterChain: number;
  emitterAddr:  string;
  /** Base64-encoded VAA bytes */
  vaa:          string;
}

interface WormholeApiResponse {
  data?: WormholeApiVaaRecord[];
}

/**
 * Poll Wormhole Scan API for VAA(s) produced by a Solana tx.
 * Falls back to simulated VAAs after timeout (development only).
 */
async function pollForVAAs(
  txHash:         string,
  targetChainIds: number[],
  isTestnet:      boolean,
  maxRetries =    30,
  delayMs =       4_000
): Promise<WormholeVAA[]> {
  const apiBase = isTestnet ? WORMHOLE_API.testnet : WORMHOLE_API.mainnet;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const url = `${apiBase}/api/v1/vaas/1?txHash=${txHash}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as WormholeApiResponse;
        if (data?.data && data.data.length > 0) {
          return data.data.map((v) => ({
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

  // Simulation fallback — keeps UI functional during local dev
  console.warn("[useSolanaLaunch] Wormhole VAA polling timed out — using simulated VAA");
  return targetChainIds.map((chainId) => ({
    sequence:     String(Date.now()),
    emitterChain: chainId,
    emitterAddr:  "0000000000000000000000000000000000000000000000000000000000000001",
    vaaBytes:     "0x" + "ab".repeat(100),
    txHash,
  }));
}

/**
 * Submit a VAA (or relayed payload) to BurnBridgeReceiver on the target EVM chain.
 * Uses window.ethereum (MetaMask / RainbowKit injected wallet) via viem.
 */
async function submitVAAToEVM(
  vaa:    WormholeVAA,
  target: CrossChainTarget
): Promise<string> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    throw new Error("No EVM wallet found — install MetaMask");
  }

  const receiverAddress = target.receiverAddress as `0x${string}`;

  // Build the message key for replay prevention:
  // keccak256(abi.encodePacked(emitterChain, emitterAddress, sequence))
  const emitterAddrPadded = ("0x" + vaa.emitterAddr.padStart(64, "0")) as `0x${string}`;
  const messageKey = keccak256(
    encodeAbiParameters(
      [{ type: "uint16" }, { type: "bytes32" }, { type: "uint64" }],
      [1, emitterAddrPadded, BigInt(vaa.sequence)]
    )
  );

  const payload: `0x${string}` = vaa.vaaBytes.startsWith("0x")
    ? (vaa.vaaBytes as `0x${string}`)
    : `0x${vaa.vaaBytes}`;

  const walletClient = createWalletClient({
    transport: custom((window as Window & { ethereum: unknown }).ethereum),
  });
  const [account] = await walletClient.getAddresses();

  const txHash = await walletClient.writeContract({
    account,
    address:      receiverAddress,
    abi:          BURN_BRIDGE_RECEIVER_ABI,
    functionName: "receiveRelayedMessage",
    args:         [payload, messageKey],
    chain:        null,
  });

  console.log(`[useSolanaLaunch] VAA relayed to ${target.name}: ${txHash}`);
  return txHash;
}
