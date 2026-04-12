/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/token_burn_bridge.json`.
 */
export type TokenBurnBridge = {
  "address": "2sAka7jCkP71LbKk1MpELxFpjSHjScQk1aStrDt4Pnnf",
  "metadata": {
    "name": "tokenBurnBridge",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "TokenForge cross-chain burn-to-activate bridge (Solana side)"
  },
  "instructions": [
    {
      "name": "burnAndBridge",
      "docs": [
        "Burns SPL tokens and emits a Wormhole cross-chain message to activate",
        "ERC20 minting on one or more EVM chains.",
        "",
        "`amount`            – raw token units to burn (includes decimals)",
        "`target_chain_id`   – Wormhole chain ID of the target EVM chain (0 = all)",
        "`evm_recipient`     – 20-byte EVM address of the token recipient",
        "`consistency_level` – Wormhole finality (1 = confirmed, 32 = finalized)"
      ],
      "discriminator": [
        187,
        9,
        252,
        183,
        112,
        230,
        84,
        14
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "userNonce",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  45,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "targetChainId",
          "type": "u16"
        },
        {
          "name": "evmRecipient",
          "type": {
            "array": [
              "u8",
              20
            ]
          }
        },
        {
          "name": "consistencyLevel",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Called once by the deployer to configure the bridge."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "evmReceiverAddresses",
          "type": {
            "vec": {
              "defined": {
                "name": "evmChainReceiver"
              }
            }
          }
        }
      ]
    },
    {
      "name": "updateReceivers",
      "docs": [
        "Update the list of EVM chain receivers (only authority)."
      ],
      "discriminator": [
        93,
        113,
        76,
        123,
        168,
        158,
        158,
        229
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "evmReceivers",
          "type": {
            "vec": {
              "defined": {
                "name": "evmChainReceiver"
              }
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bridgeConfig",
      "discriminator": [
        40,
        206,
        51,
        233,
        246,
        40,
        178,
        85
      ]
    },
    {
      "name": "userNonce",
      "discriminator": [
        235,
        133,
        1,
        243,
        18,
        135,
        88,
        224
      ]
    }
  ],
  "events": [
    {
      "name": "burnMessageEmitted",
      "discriminator": [
        31,
        132,
        141,
        109,
        6,
        47,
        154,
        84
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "burnTooSmall",
      "msg": "Burn amount too small. Minimum is 100 tokens to activate 1 chain."
    },
    {
      "code": 6001,
      "name": "insufficientBalance",
      "msg": "Insufficient token balance."
    },
    {
      "code": 6002,
      "name": "unsupportedChain",
      "msg": "Target chain not supported. Add it via update_receivers."
    },
    {
      "code": 6003,
      "name": "wrongMint",
      "msg": "Token mint does not match bridge config."
    },
    {
      "code": 6004,
      "name": "wrongOwner",
      "msg": "Token account owner does not match signer."
    },
    {
      "code": 6005,
      "name": "unauthorized",
      "msg": "Unauthorized: only the bridge authority can call this."
    },
    {
      "code": 6006,
      "name": "tooManyReceivers",
      "msg": "Too many EVM receivers. Maximum is 10."
    }
  ],
  "types": [
    {
      "name": "bridgeConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "evmReceivers",
            "type": {
              "vec": {
                "defined": {
                  "name": "evmChainReceiver"
                }
              }
            }
          },
          {
            "name": "totalBurned",
            "type": "u64"
          },
          {
            "name": "totalMessagesSent",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "burnMessageEmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sequence",
            "type": "u64"
          },
          {
            "name": "solanaMint",
            "type": "pubkey"
          },
          {
            "name": "solanaSender",
            "type": "pubkey"
          },
          {
            "name": "evmRecipient",
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "amountBurned",
            "type": "u64"
          },
          {
            "name": "targetChainId",
            "type": "u16"
          },
          {
            "name": "payloadHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "consistencyLevel",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "evmChainReceiver",
      "docs": [
        "Maps a Wormhole chain ID to the deployed BurnBridgeReceiver address on that chain"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chainId",
            "type": "u16"
          },
          {
            "name": "receiverAddress",
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "userNonce",
      "docs": [
        "Per-user nonce counter for Wormhole replay protection"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
