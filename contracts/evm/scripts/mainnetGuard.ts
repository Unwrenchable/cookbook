import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";

/** Public program id that was committed and later removed. Do not deploy it. */
export const LEAKED_SOLANA_PROGRAM_ID = "2sAka7jCkP71LbKk1MpELxFpjSHjScQk1aStrDt4Pnnf";

/**
 * Leaked program id as 32-byte hex. This is not a Wormhole emitter.
 * `post_message` records the ["emitter"] PDA, so a receiver allowlisted with
 * these bytes rejects every VAA that program can sign.
 */
export const LEAKED_SOLANA_EMITTER =
  "0x1bb5c0ccb7371c3e2901ba69bec61460bce93dd8c97da9bf72aa419e1de26dac";

export const MAINNET_CONFIRM = "yes-deploy-mainnet";

/** bytes32 hex of a Solana pubkey. */
export function pubkeyToHex(pubkey: PublicKey): string {
  return "0x" + Buffer.from(pubkey.toBytes()).toString("hex");
}

/** Wormhole emitter PDA for token-burn-bridge: seeds ["emitter"], owner programId. */
export function emitterPda(programIdBase58: string): PublicKey {
  const programId = new PublicKey(programIdBase58);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("emitter")], programId);
  return pda;
}

export function emitterPdaHex(programIdBase58: string): string {
  return pubkeyToHex(emitterPda(programIdBase58));
}

/** Emitter PDA of the leaked program. A real VAA from that key would carry this address. */
export const LEAKED_SOLANA_EMITTER_PDA = emitterPdaHex(LEAKED_SOLANA_PROGRAM_ID);

export function normalizeEmitter(raw: string | undefined): string {
  if (!raw) return ethers.ZeroHash;
  return ethers.zeroPadValue(raw, 32).toLowerCase();
}

export function assertBroadcastAllowed(opts: {
  networkName: string;
  isMainnet: boolean;
  emitter: string;
  feeRecipient: string;
  deployer: string;
}): void {
  const emitter = opts.emitter.toLowerCase();
  if (emitter === LEAKED_SOLANA_EMITTER) {
    throw new Error(
      "SOLANA_EMITTER is the leaked token-burn-bridge program id. Rotate the program and set SOLANA_EMITTER to the new program's emitter PDA (pnpm emitter <programId>)."
    );
  }
  if (emitter === LEAKED_SOLANA_EMITTER_PDA) {
    throw new Error(
      "SOLANA_EMITTER is the emitter PDA of the leaked token-burn-bridge program. Rotate the program and set SOLANA_EMITTER to the new program's emitter PDA."
    );
  }
  if (emitter === ethers.ZeroHash) {
    throw new Error(
      "Set SOLANA_EMITTER to the emitter PDA of the rotated token-burn-bridge program, as a 32-byte hex string. Run: pnpm emitter <programIdBase58>."
    );
  }
  if (!opts.isMainnet) return;
  if (process.env.CONFIRM_MAINNET !== MAINNET_CONFIRM || process.env.CONFIRM_NETWORK !== opts.networkName) {
    throw new Error(
      `Refusing to broadcast to ${opts.networkName}. ` +
        `Set CONFIRM_MAINNET=${MAINNET_CONFIRM} and CONFIRM_NETWORK=${opts.networkName}. ` +
        "Read docs/MAINNET_CHECKLIST.md first."
    );
  }
  if (!opts.feeRecipient || opts.feeRecipient === ethers.ZeroAddress) {
    throw new Error("Set FEE_RECIPIENT to the treasury multisig before a mainnet deploy.");
  }
  if (opts.feeRecipient.toLowerCase() === opts.deployer.toLowerCase()) {
    throw new Error("FEE_RECIPIENT must be a multisig, not the deployer key.");
  }
}
