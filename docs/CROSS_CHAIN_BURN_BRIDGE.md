# Cross-Chain Burn-to-Activate Bridge

## Overview

TokenForge's killer feature: **launch a token on Solana first, then burn SPL tokens to activate ERC20 minting on any EVM chain.**

This creates a unique multi-chain token economics model where:
- Solana is the **origin chain** (cheapest, fastest mint)
- Burns are the **cross-chain activation cost** (creates scarcity + activates reach)
- Wormhole is the **trustless relay** (no custodian)

> ⚠️ **Production Readiness Status**
>
> The Solana Anchor program emits a `BurnMessageEmitted` event but does **not yet CPI into the Wormhole `post_message` instruction**. On the EVM side, `BurnBridgeReceiver.receiveMessage()` currently **reverts** — it is a scaffold pending full Wormhole VAA integration.
>
> For development and integration testing, use `BurnBridgeReceiver.receiveRelayedMessage()` together with a trusted off-chain relayer that decodes the Anchor event and submits the payload + replay key.
>
> To complete the production bridge, two tasks remain:
> 1. Add the Wormhole `post_message` CPI call to the Anchor program's `burn_and_bridge` instruction.
> 2. Uncomment and test the `IWormhole.parseAndVerifyVM()` code path in `BurnBridgeReceiver.receiveMessage()`.

---

## The Flow (step by step)

```
User (Phantom Wallet + MetaMask)
    │
    ├─ 1. Hold SPL tokens on Solana
    │       (e.g. FIZZ, or any SPL mint you configure)
    │
    ├─ 2. Open TokenForge → "Solana → All Chains" tab
    │
    ├─ 3. Choose burn tier:
    │       100 tokens  → activate 1 EVM chain
    │       500 tokens  → activate 3 EVM chains
    │       1,000 tokens→ activate ALL chains
    │
    ├─ 4. Select target EVM chains + enter EVM recipient address
    │
    ├─ 5. Click "Burn & Activate"
    │       → Phantom signs the Solana tx
    │       → Anchor program burns SPL tokens
    │       → Wormhole Core Bridge emits a VAA
    │
    ├─ 6. Wormhole guardians sign the VAA (~13 s mainnet)
    │
    └─ 7. Auto-relayer (or user) submits VAA to BurnBridgeReceiver.sol
               → Verifies VAA (emitter chain, emitter address, sequence)
               → Replay protection (sequence tracking)
               → Mints ERC20 tokens to EVM recipient
               → Emits TokensActivated event
```

---

## Contracts

### Solana: `contracts/solana/programs/token-burn-bridge/src/lib.rs`

**Anchor program** with instructions:
- `initialize(evm_receivers)` — deployer sets up which EVM chains are supported
- `burn_and_bridge(amount, target_chain_id, evm_recipient, consistency_level)` — core instruction
- `update_receivers(evm_receivers)` — admin can add/remove EVM chains

**Payload format** (ABI-compatible with EVM receiver):
```
bytes32  solanaSourceMint    (32 bytes)
bytes32  solanaSender        (32 bytes)
bytes32  evmRecipient        (20-byte address, 12 zero bytes prefix)
uint64   amountBurned        (8 bytes, big-endian)
uint16   targetChainId       (2 bytes, big-endian)
uint64   nonce               (8 bytes, big-endian)
```

### EVM: `contracts/evm/contracts/bridge/BurnBridgeReceiver.sol`

**Solidity contract** per EVM chain with:
- `receiveMessage(encodedVAA)` — full Wormhole VAA path (production)
- `receiveRelayedMessage(payload)` — trusted-relayer path (development); replay key is derived on-chain via `keccak256(payload)`
- `_processPayload(payload)` — decodes payload, mints ERC20

**Security features:**
- VAA verification via `IWormhole(wormholeCore).parseAndVerifyVM()`
- Replay protection via `processedMessages[messageKey]` mapping
- Emitter validation (only the configured Solana program can send)
- Reentrancy guard

---

## Deployment Checklist

### Solana (devnet first)

```bash
cd contracts/solana
anchor build
anchor deploy --provider.cluster devnet

# Record the program ID from output, update Anchor.toml + NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID
```

### EVM (per chain)

```bash
cd contracts/evm
# Deploy BurnBridgeReceiver for each chain:
npx hardhat run scripts/deployBridge.ts --network sepolia
# Fill NEXT_PUBLIC_RECEIVER_SEPOLIA in frontend/.env.local
```

### Initialize the Anchor program

```typescript
// Run once after deploying:
await program.methods
  .initialize([
    { chainId: 2,  receiverAddress: Buffer.from(ethAddress.slice(2), 'hex'), isActive: true },
    { chainId: 56, receiverAddress: Buffer.from(bscAddress.slice(2), 'hex'), isActive: true },
    // ... more chains
  ])
  .accounts({ config, tokenMint, authority, systemProgram })
  .rpc();
```

---

## Adding a New EVM Chain

1. Deploy `BurnBridgeReceiver.sol` on the new chain
2. Call `program.methods.updateReceivers(...)` on Solana with the new chain's Wormhole ID + receiver address
3. Add entry to `CROSS_CHAIN_TARGETS` in `frontend/src/lib/crossChain.ts`
4. Set `NEXT_PUBLIC_RECEIVER_<CHAIN>` in `frontend/.env.local`

That's it. No contract redeployment needed anywhere else.

---

## Wormhole Integration Notes

| Environment | Wormhole Core (Solana) | Guardian Set |
|-------------|------------------------|--------------|
| Mainnet     | `worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth` | 19 guardians |
| Devnet      | `3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5` | 1 guardian   |

**VAA polling:** Use the Wormhole Scan API:
```
GET https://api.wormholescan.io/api/v1/vaas/1/{emitterAddress}/{sequence}
```

**Auto-relayer:** The Wormhole team runs a free automatic relayer for standard token transfers. For custom payloads like ours, you need either:
1. A custom relayer (see `scripts/relayer.ts` – to be added)
2. The user submits the VAA manually via the TokenForge UI

---

## Inspiration

This mechanic is inspired by the **ATOMIC FIZZ CAPS** project (`Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`):
- FIZZ/CAPS SPL token on Solana
- Wormhole bridge to 35+ chains
- Burn-to-claim mechanics for the geo-game loot system

TokenForge generalizes this into a **self-serve launchpad** anyone can use.
