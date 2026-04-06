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
  // `||` instead of `??` so an empty-string env var also falls back to the
  // System program placeholder (safe no-op address used until `anchor deploy`
  // provides a real program ID).
  process.env.NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID ||
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

/** discriminator for `burn_and_bridge` — SHA256("global:burn_and_bridge")[0..8] */
export const DISCRIMINATOR_BURN_AND_BRIDGE = Buffer.from([
  0xbb, 0x09, 0xfc, 0xb7, 0x70, 0xe6, 0x54, 0x0e,
]);
