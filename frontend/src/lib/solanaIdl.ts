/**
 * solanaIdl.ts – Re-exports the token_burn_bridge Anchor IDL for use in the frontend.
 *
 * The canonical IDL JSON is committed to contracts/solana/idl/token_burn_bridge.json.
 * This module re-exports the relevant constants so no JSON file loading is required at
 * runtime (avoids bundler configuration for .json imports).
 *
 * Usage:
 *   import { TOKEN_BURN_BRIDGE_PROGRAM_ID, BRIDGE_CONFIG_SEED } from "@/lib/solanaIdl";
 */

/**
 * Program ID placeholder — replaced after `anchor build` outputs the real program ID.
 * Set NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID in .env.local after deploying.
 */
export const TOKEN_BURN_BRIDGE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID ??
  "11111111111111111111111111111111";

// ─── Anchor PDA seeds (must match lib.rs constants) ───────────────────────────

export const BRIDGE_CONFIG_SEED = "bridge-config";
export const USER_NONCE_SEED    = "user-nonce";

// ─── Burn tier constants (must match lib.rs constants) ────────────────────────

/** 100 tokens with 9 decimals */
export const MIN_BURN_ONE_CHAIN    = BigInt("100000000000");
/** 500 tokens with 9 decimals */
export const MIN_BURN_THREE_CHAINS = BigInt("500000000000");
/** 1 000 tokens with 9 decimals */
export const MIN_BURN_ALL_CHAINS   = BigInt("1000000000000");

// ─── Instruction discriminators (sha256("global:<instruction_name>")[0..8]) ──
// These are computed by the Anchor framework and embedded in each instruction call.
// Run `anchor build` to regenerate; these are stable for the given instruction names.

/** discriminator for `burn_and_bridge` */
export const DISCRIMINATOR_BURN_AND_BRIDGE = Buffer.from([
  0x0f, 0xb9, 0xba, 0x5a, 0x74, 0x2e, 0x47, 0x26,
]);
