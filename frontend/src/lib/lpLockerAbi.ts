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
export const LP_LOCKER_ADDRESSES: Record<number, `0x${string}`> = {
  // Testnets
  11155111: (process.env.NEXT_PUBLIC_LOCKER_SEPOLIA     as `0x${string}`) ?? "0x",
  97:       (process.env.NEXT_PUBLIC_LOCKER_BSC_TESTNET as `0x${string}`) ?? "0x",
  421614:   (process.env.NEXT_PUBLIC_LOCKER_ARB_SEPOLIA as `0x${string}`) ?? "0x",
  84532:    (process.env.NEXT_PUBLIC_LOCKER_BASE_SEPOLIA as `0x${string}`) ?? "0x",
  // Mainnets
  1:        (process.env.NEXT_PUBLIC_LOCKER_MAINNET     as `0x${string}`) ?? "0x",
  56:       (process.env.NEXT_PUBLIC_LOCKER_BSC         as `0x${string}`) ?? "0x",
  137:      (process.env.NEXT_PUBLIC_LOCKER_POLYGON     as `0x${string}`) ?? "0x",
  42161:    (process.env.NEXT_PUBLIC_LOCKER_ARBITRUM    as `0x${string}`) ?? "0x",
  8453:     (process.env.NEXT_PUBLIC_LOCKER_BASE        as `0x${string}`) ?? "0x",
  43114:    (process.env.NEXT_PUBLIC_LOCKER_AVALANCHE   as `0x${string}`) ?? "0x",
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
