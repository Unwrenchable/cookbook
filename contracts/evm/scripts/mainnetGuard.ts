import { ethers } from "ethers";

/** Public program id that was committed and later removed. Do not deploy it. */
export const LEAKED_SOLANA_EMITTER =
  "0x1bb5c0ccb7371c3e2901ba69bec61460bce93dd8c97da9bf72aa419e1de26dac";

export const MAINNET_CONFIRM = "yes-deploy-mainnet";

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
  if (opts.emitter === LEAKED_SOLANA_EMITTER) {
    throw new Error(
      "SOLANA_EMITTER is the leaked token-burn-bridge program id. Rotate the program id and set the new bytes32."
    );
  }
  if (opts.emitter === ethers.ZeroHash) {
    throw new Error(
      "Set SOLANA_EMITTER to the rotated token-burn-bridge program id as a 32-byte hex string."
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
