/**
 * burnBridgeReceiverAbi.ts – ABI for BurnBridgeReceiver.sol.
 *
 * Used by the frontend to submit Wormhole VAAs (or relayed messages) to the
 * BurnBridgeReceiver contract on each target EVM chain via viem.
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
  {
    name: "receiveRelayedMessage",
    type: "function",
    stateMutability: "nonpayable",
    // messageKey is now derived on-chain from keccak256(payload) — not a parameter
    inputs: [
      { name: "payload", type: "bytes" },
    ],
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
    name: "isTrustedRelayer",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "relayer", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "address" }],
  },

  // ─── Admin ───────────────────────────────────────────────────────────────────
  {
    name: "setTrustedRelayer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "relayer", type: "address" },
      { name: "trusted", type: "bool"    },
    ],
    outputs: [],
  },
  {
    name: "setMintableToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    name: "setMintRatio",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "ratio", type: "uint256" }],
    outputs: [],
  },
  {
    name: "setWormholeCore",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "core", type: "address" }],
    outputs: [],
  },
  {
    name: "setTrustedSolanaEmitter",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "emitter", type: "bytes32" }],
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
    name: "RelayerUpdated",
    type: "event",
    inputs: [
      { name: "relayer", type: "address", indexed: false },
      { name: "trusted", type: "bool",    indexed: false },
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
    inputs: [{ name: "emitter", type: "bytes32", indexed: false }],
  },
] as const;
