/**
 * burnBridgeReceiverAbi.ts – ABI for BurnBridgeReceiver.sol.
 *
 * Used by the frontend to submit a guardian-signed Wormhole VAA to
 * BurnBridgeReceiver.receiveMessage on each target EVM chain via viem.
 */

export const BURN_BRIDGE_RECEIVER_ABI = [
  // ─── Core ────────────────────────────────────────────────────────────────────
  {
    name: "receiveMessage",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "encodedVAA", type: "bytes" }],
    outputs: [],
  },

  // ─── Views ───────────────────────────────────────────────────────────────────
  {
    name: "thisChainId",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    name: "wormholeCore",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "trustedSolanaEmitter",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "mintableToken",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "mintRatio",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "processedMessages",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "messageKey", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "trustedEmitters",
    type: "function",
    stateMutability: "view",
    inputs:  [
      { name: "chainId", type: "uint16" },
      { name: "emitter", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "adminDelay",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "address" }],
  },

  // ─── Admin (queued; execute after adminDelay) ────────────────────────────────
  {
    name: "queueSetTrustedEmitter",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "chainId", type: "uint16" },
      { name: "emitter", type: "bytes32" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [
      { name: "opId", type: "bytes32" },
      { name: "eta", type: "uint256" },
    ],
  },
  {
    name: "executeSetTrustedEmitter",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "chainId", type: "uint16" },
      { name: "emitter", type: "bytes32" },
      { name: "allowed", type: "bool" },
      { name: "eta", type: "uint256" },
    ],
    outputs: [],
  },

  // ─── Events ──────────────────────────────────────────────────────────────────
  {
    name: "TokensActivated",
    type: "event",
    inputs: [
      { name: "solanaSourceMint", type: "bytes32",  indexed: true  },
      { name: "solanaSender",     type: "bytes32",  indexed: true  },
      { name: "evmRecipient",     type: "address",  indexed: true  },
      { name: "amountMinted",     type: "uint256",  indexed: false },
      { name: "solanaNonce",      type: "uint64",   indexed: false },
    ],
  },
  {
    name: "MintableTokenUpdated",
    type: "event",
    inputs: [{ name: "token", type: "address", indexed: false }],
  },
  {
    name: "MintRatioUpdated",
    type: "event",
    inputs: [{ name: "ratio", type: "uint256", indexed: false }],
  },
  {
    name: "WormholeCoreUpdated",
    type: "event",
    inputs: [{ name: "core", type: "address", indexed: false }],
  },
  {
    name: "TrustedEmitterUpdated",
    type: "event",
    inputs: [
      { name: "chainId", type: "uint16", indexed: false },
      { name: "emitter", type: "bytes32", indexed: false },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
] as const;
