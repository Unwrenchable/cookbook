# GOONFORGE Deployment Walkthrough

This guide takes you from a fresh clone to a fully live GOONFORGE deployment on any supported EVM chain.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & Install](#2-clone--install)
3. [Set Up Contract Environment Variables](#3-set-up-contract-environment-variables)
4. [Compile & Test Contracts](#4-compile--test-contracts)
5. [Deploy to Testnet](#5-deploy-to-testnet)
6. [Verify Contracts on Etherscan](#6-verify-contracts-on-etherscan)
7. [Set Up Frontend Environment Variables](#7-set-up-frontend-environment-variables)
8. [Run the Frontend](#8-run-the-frontend)
9. [Deploy to Mainnet](#9-deploy-to-mainnet)
10. [Adding a New Chain](#10-adding-a-new-chain)
11. [(Optional) Solana Cross-Chain Bridge](#11-optional-solana-cross-chain-bridge)

---

## 1. Prerequisites

Before starting, make sure you have the following installed:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Git | any | https://git-scm.com |

You will also need accounts / API keys at:

- **[Alchemy](https://alchemy.com)** — RPC access for all EVM chains
- **[WalletConnect Cloud](https://cloud.walletconnect.com)** — project ID for RainbowKit
- **[Etherscan](https://etherscan.io/apis)** / BscScan / PolygonScan / Arbiscan / Basescan — for contract verification (one key per block explorer)
- A **deployer wallet** with testnet and/or mainnet funds (ETH, BNB, MATIC, etc.)

---

## 2. Clone & Install

```bash
git clone https://github.com/Unwrenchable/cookbook.git
cd cookbook

# Install all workspace dependencies in one shot
pnpm install
```

---

## 3. Set Up Contract Environment Variables

```bash
cd contracts/evm
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Your deployer wallet private key — NEVER commit this!
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Alchemy API key (used for RPC on all chains)
ALCHEMY_API_KEY=your_alchemy_api_key

# Block explorer API keys (used for contract verification)
ETHERSCAN_API_KEY=your_etherscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
BASESCAN_API_KEY=your_basescan_api_key

# Set to true to print a gas cost report after tests
REPORT_GAS=false
```

> **Security tip:** Make sure `.env` is in your `.gitignore` (it already is in this repo). Never share or commit your private key.

---

## 4. Compile & Test Contracts

```bash
# From contracts/evm/
pnpm compile   # compiles all Solidity contracts
pnpm test      # runs the full Hardhat test suite
```

Expected output:

```
  TokenFactory
    ✔ deploys with correct implementations
    ✔ creates a StandardERC20 token
    ✔ creates a TaxableERC20 token
    ... (all tests passing)

  X passing (Xs)
```

If any test fails, check that your Solidity version matches `0.8.28` and that dependencies are installed cleanly.

---

## 5. Deploy to Testnet

Start with a testnet. Sepolia (Ethereum) is the recommended starting point — it's free and fast to get testnet ETH from a [Sepolia faucet](https://sepoliafaucet.com/).

```bash
# From contracts/evm/

# Ethereum Sepolia
pnpm deploy:sepolia

# BNB Smart Chain Testnet
pnpm deploy:bscTestnet

# Polygon Mumbai
pnpm deploy:polygonMumbai

# Arbitrum Sepolia
pnpm deploy:arbitrumSepolia

# Base Sepolia
pnpm deploy:baseSepolia
```

Each command runs `scripts/deploy.ts`, which:

1. Deploys all **9 template implementations** (StandardERC20, TaxableERC20, DeflationaryERC20, ReflectionERC20, BondingCurveToken, AIAgentToken, PolitiFiToken, UtilityHybridToken, PumpMigrateToken)
2. Deploys the **TokenFactory** pointing to all templates
3. Deploys the **LPLocker**
4. Prints a JSON deployment summary

**Save the output.** It looks like this:

```json
{
  "network": "sepolia",
  "deployer": "0xYourAddress",
  "tokenFactory": "0xFactoryAddress",
  "lpLocker": "0xLockerAddress",
  "implementations": {
    "standard":      "0x...",
    "taxable":       "0x...",
    "deflationary":  "0x...",
    "reflection":    "0x...",
    "bondingCurve":  "0x...",
    "aiAgent":       "0x...",
    "politiFi":      "0x...",
    "utilityHybrid": "0x...",
    "pumpMigrate":   "0x..."
  }
}
```

You only need `tokenFactory` and `lpLocker` addresses for the frontend.

---

## 6. Verify Contracts on Etherscan

After deploying, verify each contract so users can read the source on the block explorer. Run once per contract address:

```bash
# From contracts/evm/
# Replace 0xADDRESS with the actual address from the deploy output

# Verify TokenFactory (pass constructor args in the same order as deploy.ts)
npx hardhat verify --network sepolia 0xTOKEN_FACTORY_ADDRESS \
  0xSTANDARD_IMPL \
  0xTAXABLE_IMPL \
  0xDEFLATIONARY_IMPL \
  0xREFLECTION_IMPL \
  0xBONDING_CURVE_IMPL \
  0xAI_AGENT_IMPL \
  0xPOLITIFI_IMPL \
  0xUTILITY_HYBRID_IMPL \
  0xPUMP_MIGRATE_IMPL \
  1000000000000000 \   # launch fee in wei (= 0.001 ETH, matches deploy.ts default)
  0xFEE_RECIPIENT_ADDRESS

# Verify LPLocker (no constructor args)
npx hardhat verify --network sepolia 0xLP_LOCKER_ADDRESS

# Verify template implementations (no constructor args)
npx hardhat verify --network sepolia 0xSTANDARD_IMPL
npx hardhat verify --network sepolia 0xTAXABLE_IMPL
# ... repeat for each implementation
```

Replace `sepolia` with the target network name from `hardhat.config.ts` (e.g. `bscTestnet`, `polygonMumbai`, `arbitrumSepolia`, `baseSepolia`).

---

## 7. Set Up Frontend Environment Variables

```bash
cd ../../frontend
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```env
# WalletConnect project ID (required for RainbowKit)
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Alchemy API key (used for all chain RPCs in the frontend)
NEXT_PUBLIC_ALCHEMY_KEY=your_alchemy_api_key

# ── EVM TokenFactory addresses ───────────────────────────────────────────────
# Paste the tokenFactory address from each chain's deploy output
NEXT_PUBLIC_FACTORY_SEPOLIA=0x...
NEXT_PUBLIC_FACTORY_BSC_TESTNET=0x...
NEXT_PUBLIC_FACTORY_POLYGON_MUMBAI=0x...
NEXT_PUBLIC_FACTORY_ARB_SEPOLIA=0x...
NEXT_PUBLIC_FACTORY_BASE_SEPOLIA=0x...
NEXT_PUBLIC_FACTORY_MAINNET=0x...
NEXT_PUBLIC_FACTORY_BSC=0x...
NEXT_PUBLIC_FACTORY_POLYGON=0x...
NEXT_PUBLIC_FACTORY_ARBITRUM=0x...
NEXT_PUBLIC_FACTORY_BASE=0x...
NEXT_PUBLIC_FACTORY_AVALANCHE=0x...

# ── LPLocker addresses ────────────────────────────────────────────────────────
NEXT_PUBLIC_LOCKER_SEPOLIA=0x...
NEXT_PUBLIC_LOCKER_BSC_TESTNET=0x...
# ... (one per chain)

# ── Optional: AI description generator (falls back to templates if empty) ─────
OPENAI_API_KEY=sk-...

# ── Optional: IPFS / Pinata (shows a mock hash if empty) ─────────────────────
PINATA_JWT=...
```

> Leave any chain's factory address blank if you have not deployed there yet. The UI will mark that chain as "not deployed" automatically.

---

## 8. Run the Frontend

```bash
# From frontend/
pnpm dev
# → Open http://localhost:3000
```

To do a production build check before deploying:

```bash
pnpm build
pnpm start
```

The app is a standard Next.js 15 project and can be deployed to **Vercel** (recommended), Netlify, or any Node.js host:

```bash
# Vercel (one-time setup)
npm install -g vercel
vercel --prod
```

Set the same environment variables from `.env.local` in your Vercel project's **Settings → Environment Variables** dashboard.

---

## 9. Deploy to Mainnet

Once you've verified everything works on testnet, deploy to mainnet chains:

```bash
# From contracts/evm/

pnpm deploy:mainnet        # Ethereum Mainnet
pnpm deploy:bsc            # BNB Smart Chain
pnpm deploy:polygon        # Polygon PoS
pnpm deploy:arbitrum       # Arbitrum One
pnpm deploy:base           # Base
pnpm deploy:avalanche      # Avalanche C-Chain
```

> **Mainnet checklist before deploying:**
> - [ ] All tests pass (`pnpm test`)
> - [ ] Deployer wallet has enough native token for gas on each chain
> - [ ] `feeRecipient` in `scripts/deploy.ts` is set to your treasury wallet (not the deployer key)
> - [ ] You've done a dry-run on testnet with the same parameters
> - [ ] `.env` is not committed to git

After each mainnet deploy:
1. Copy the `tokenFactory` and `lpLocker` addresses into `frontend/.env.local` (and your Vercel env vars)
2. Verify contracts on the respective block explorer (same `npx hardhat verify` command, with the mainnet network name)
3. Re-deploy the frontend so the new addresses take effect

---

## 10. Adding a New Chain

Adding a chain takes under 10 minutes:

**Step 1 — Add the network to Hardhat config**

In `contracts/evm/hardhat.config.ts`, add a new entry under `networks`:

```typescript
newchain: {
  url: `https://newchain-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  accounts: [PRIVATE_KEY],
  chainId: 12345,
},
```

**Step 2 — Add a deploy script alias**

In `contracts/evm/package.json`, add to the `scripts` block:

```json
"deploy:newchain": "hardhat run scripts/deploy.ts --network newchain"
```

**Step 3 — Deploy**

```bash
pnpm deploy:newchain
```

**Step 4 — Add the chain to the frontend**

In `frontend/src/lib/chains.ts`, add a new entry to `SUPPORTED_CHAINS`:

```typescript
{
  id: 12345,
  name: "NewChain Mainnet",
  shortName: "newchain",
  nativeCurrency: { name: "TOKEN", symbol: "TOKEN", decimals: 18 },
  rpcUrl: `https://newchain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  blockExplorer: "https://explorer.newchain.io",
  isTestnet: false,
  factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_NEWCHAIN as `0x${string}`) ?? "",
},
```

**Step 5 — Set the env var**

```env
# In frontend/.env.local and your Vercel env vars
NEXT_PUBLIC_FACTORY_NEWCHAIN=0x...
```

Done — the UI detects the new chain immediately on next build.

---

## 11. (Optional) Solana Cross-Chain Bridge

If you want to enable the **burn-to-activate** cross-chain mechanic (burn SPL tokens on Solana → mint ERC20 on EVM), follow the guide in [`docs/CROSS_CHAIN_BURN_BRIDGE.md`](./CROSS_CHAIN_BURN_BRIDGE.md).

The short version:

```bash
# 1. Build & deploy the Anchor program
cd contracts/solana
anchor build
anchor deploy --provider.cluster devnet

# 2. Deploy BurnBridgeReceiver on each EVM chain
cd ../evm
npx hardhat run scripts/deployBridge.ts --network sepolia

# 3. Set env vars
#    NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID=<from anchor deploy>
#    NEXT_PUBLIC_RECEIVER_SEPOLIA=<from deployBridge output>
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Error: insufficient funds` | Top up the deployer wallet on the target chain |
| `Error: network not found` | Check the network name matches `hardhat.config.ts` exactly |
| `ProviderError: invalid API key` | Verify your `ALCHEMY_API_KEY` in `.env` |
| Verification fails with `already verified` | Safe to ignore — contract is already verified |
| Verification fails with `bytecode mismatch` | Recompile with `pnpm compile` then retry verification |
| Frontend shows "Factory not deployed" | Fill in `NEXT_PUBLIC_FACTORY_<CHAIN>` in `.env.local` and restart the dev server |
| `next build` fails | Run `pnpm install` in the `frontend/` folder and retry |

---

*Questions? Open an issue or drop into the [GOONFORGE community](https://goonforge.xyz).*
