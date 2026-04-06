/**
 * lpLockerAbi.ts – Minimal ABI for the LPLocker contract.
 * Generated from contracts/evm/contracts/lockers/LPLocker.sol
 */
export const LP_LOCKER_ABI = [
  // lock
  {
    inputs: [
      { internalType: "address", name: "lpToken",  type: "address" },
      { internalType: "uint256", name: "amount",   type: "uint256" },
      { internalType: "uint256", name: "unlockAt", type: "uint256" },
    ],
    name: "lock",
    outputs: [{ internalType: "uint256", name: "lockId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // unlock
  {
    inputs: [{ internalType: "uint256", name: "lockId", type: "uint256" }],
    name: "unlock",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getLocksByOwner
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "getLocksByOwner",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  // getLock
  {
    inputs: [{ internalType: "uint256", name: "lockId", type: "uint256" }],
    name: "getLock",
    outputs: [
      {
        components: [
          { internalType: "address", name: "lpToken",   type: "address" },
          { internalType: "uint256", name: "amount",    type: "uint256" },
          { internalType: "uint256", name: "unlockAt",  type: "uint256" },
          { internalType: "address", name: "owner",     type: "address" },
          { internalType: "bool",    name: "withdrawn", type: "bool"    },
        ],
        internalType: "struct LPLocker.LockInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // totalLocks
  {
    inputs: [],
    name: "totalLocks",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "lockId",  type: "uint256" },
      { indexed: true,  internalType: "address", name: "owner",   type: "address" },
      { indexed: true,  internalType: "address", name: "lpToken", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount",  type: "uint256" },
      { indexed: false, internalType: "uint256", name: "unlockAt",type: "uint256" },
    ],
    name: "Locked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "lockId", type: "uint256" },
      { indexed: true,  internalType: "address", name: "owner",  type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Unlocked",
    type: "event",
  },
] as const;

// Placeholder locker addresses — replace with deployed addresses.
// Structure mirrors chains.ts SUPPORTED_CHAINS chainIds.
//
// Note: uses `|| "0x"` (not `??`) so both undefined AND empty-string env vars
// fall back to the sentinel "0x" value. LPLockerPanel guards against "0x" to
// show the "not deployed on this chain" message.
export const LP_LOCKER_ADDRESSES: Record<number, `0x${string}`> = {
  // Testnets
  11155111: ((process.env.NEXT_PUBLIC_LOCKER_SEPOLIA      || "0x") as `0x${string}`),
  97:       ((process.env.NEXT_PUBLIC_LOCKER_BSC_TESTNET  || "0x") as `0x${string}`),
  80002:    ((process.env.NEXT_PUBLIC_LOCKER_POLYGON_AMOY || "0x") as `0x${string}`),
  421614:   ((process.env.NEXT_PUBLIC_LOCKER_ARB_SEPOLIA  || "0x") as `0x${string}`),
  84532:    ((process.env.NEXT_PUBLIC_LOCKER_BASE_SEPOLIA || "0x") as `0x${string}`),
  11155420: ((process.env.NEXT_PUBLIC_LOCKER_OP_SEPOLIA   || "0x") as `0x${string}`),
  // Mainnets
  1:        ((process.env.NEXT_PUBLIC_LOCKER_MAINNET      || "0x") as `0x${string}`),
  56:       ((process.env.NEXT_PUBLIC_LOCKER_BSC          || "0x") as `0x${string}`),
  137:      ((process.env.NEXT_PUBLIC_LOCKER_POLYGON      || "0x") as `0x${string}`),
  42161:    ((process.env.NEXT_PUBLIC_LOCKER_ARBITRUM     || "0x") as `0x${string}`),
  8453:     ((process.env.NEXT_PUBLIC_LOCKER_BASE         || "0x") as `0x${string}`),
  43114:    ((process.env.NEXT_PUBLIC_LOCKER_AVALANCHE    || "0x") as `0x${string}`),
  10:       ((process.env.NEXT_PUBLIC_LOCKER_OPTIMISM     || "0x") as `0x${string}`),
};

// ERC20 approve ABI (just what we need for LP token approval)
export const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount",  type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner",   type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
