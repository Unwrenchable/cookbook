/**
 * tokenFactoryAbi.ts – Minimal ABI for the TokenFactory contract.
 * Generated from contracts/evm/artifacts/contracts/factories/TokenFactory.sol/TokenFactory.json
 * Update this file whenever the contract ABI changes.
 */
export const TOKEN_FACTORY_ABI = [
  // createToken
  {
    inputs: [
      {
        components: [
          { internalType: "string",  name: "name",            type: "string"  },
          { internalType: "string",  name: "symbol",          type: "string"  },
          { internalType: "uint256", name: "totalSupply",     type: "uint256" },
          { internalType: "uint8",   name: "decimals",        type: "uint8"   },
          { internalType: "uint16",  name: "buyTaxBps",       type: "uint16"  },
          { internalType: "uint16",  name: "sellTaxBps",      type: "uint16"  },
          { internalType: "uint16",  name: "burnBps",         type: "uint16"  },
          { internalType: "uint16",  name: "reflectionBps",   type: "uint16"  },
          { internalType: "address", name: "marketingWallet", type: "address" },
          { internalType: "uint16",  name: "liquidityBps",    type: "uint16"  },
          { internalType: "address", name: "owner",           type: "address" },
          {
            internalType: "enum TokenFactory.TokenFlavor",
            name: "flavor",
            type: "uint8",
          },
        ],
        internalType: "struct TokenFactory.TokenParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "createToken",
    outputs: [{ internalType: "address", name: "tokenAddress", type: "address" }],
    stateMutability: "payable",
    type: "function",
  },
  // getTokensByOwner
  {
    inputs: [{ internalType: "address", name: "_owner", type: "address" }],
    name: "getTokensByOwner",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  // getAllTokens
  {
    inputs: [],
    name: "getAllTokens",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  // totalTokensDeployed
  {
    inputs: [],
    name: "totalTokensDeployed",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // launchFee
  {
    inputs: [],
    name: "launchFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "tokenAddress", type: "address" },
      { indexed: true,  internalType: "address", name: "tokenOwner",   type: "address" },
      { indexed: false, internalType: "uint8",   name: "flavor",       type: "uint8"   },
      { indexed: false, internalType: "string",  name: "name",         type: "string"  },
      { indexed: false, internalType: "string",  name: "symbol",       type: "string"  },
      { indexed: false, internalType: "uint256", name: "totalSupply",  type: "uint256" },
    ],
    name: "TokenCreated",
    type: "event",
  },
] as const;
