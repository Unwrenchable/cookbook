# GOONFORGE Deployment Walkthrough

This guide takes you from a fresh clone to a fully live GOONFORGE deployment on Vercel (frontend) and any supported EVM chain (smart contracts).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & Install](#2-clone--install)
3. [Set Up Contract Environment Variables](#3-set-up-contract-environment-variables)
4. [Compile & Test Contracts](#4-compile--test-contracts)
5. [Deploy to Testnet](#5-deploy-to-testnet)
6. [Verify Contracts on Etherscan](#6-verify-contracts-on-etherscan)
7. [Set Up Frontend Environment Variables](#7-set-up-frontend-environment-variables)
8. [Deploy Frontend to Vercel](#8-deploy-frontend-to-vercel)
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

# Polygon Amoy (replaces the deprecated Mumbai testnet)
pnpm deploy:polygonAmoy

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

Replace `sepolia` with the target network name from `hardhat.config.ts` (e.g. `bscTestnet`, `polygonAmoy`, `arbitrumSepolia`, `baseSepolia`).

---

## 7. Set Up Frontend Environment Variables

```bash
cd ../../frontend
cp .env.example .env.local
```

Open `.env.local` and fill in your values. Every variable is documented in `frontend/.env.example` — the key ones are:

```env
# WalletConnect project ID (required for RainbowKit)
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Alchemy API key (used for all chain RPCs in the frontend)
NEXT_PUBLIC_ALCHEMY_KEY=your_alchemy_api_key

# ── EVM TokenFactory addresses ───────────────────────────────────────────────
# Paste the tokenFactory address from each chain's deploy output
NEXT_PUBLIC_FACTORY_SEPOLIA=0x...
NEXT_PUBLIC_FACTORY_BSC_TESTNET=0x...
NEXT_PUBLIC_FACTORY_POLYGON_AMOY=0x...
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
# ... (one per chain — see frontend/.env.example for full list)

# ── Optional: AI description generator (server-side) ─────────────────────────
OPENAI_API_KEY=sk-...

# ── Optional: IPFS / Pinata (server-side) ────────────────────────────────────
PINATA_JWT=...
```

> Leave any chain's factory address blank if you have not deployed there yet. The UI will mark that chain as "not deployed" automatically.

---

## 8. Deploy Frontend to Vercel

The frontend is designed for **Vercel-only** hosting. A `vercel.json` at the repo root configures the monorepo build, security headers, CDN caching, and smart build-ignore rules automatically.

> ⚠️ **Always run `vercel` from the repository root** (where `vercel.json` lives), **not** from your home directory or any other location.
> Setting the Vercel project's Root Directory to anything other than `.` (e.g. `~/frontend`, `~\frontend`, or `frontend`) will cause the error _"The provided path does not exist"_. See the [Troubleshooting](#troubleshooting-vercel-root-directory) section if you hit this.

### Option A — Vercel CLI (quickest for first-time setup)

```bash
# Install the CLI once
npm install -g vercel

# cd into the repo root first — vercel.json must be in the current directory
cd /path/to/cookbook

vercel

# Follow the prompts:
#   → Link to your Vercel account / team
#   → Set up and deploy? Yes
#   → Which scope? (choose your account)
#   → Link to existing project? No → new project name: goonforge
#   → Project root directory? . ← type a single dot (repo root)
#   → Override settings? No

# After the preview deploy succeeds, promote to production:
vercel --prod
```

### Option B — Vercel Dashboard (recommended for CI/CD)

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select `Unwrenchable/cookbook`.
2. In **Configure Project**:
   - **Framework preset**: Next.js (auto-detected)
   - **Root Directory**: `.` (**leave blank / repo root** — `vercel.json` points the build at `frontend/`. Do **not** enter `frontend`, `~/frontend`, or `~\frontend`.)
   - **Build Command**: `pnpm turbo run build --filter=@tokenforge/frontend` *(pre-filled from `vercel.json`)*
   - **Output Directory**: `frontend/.next` *(pre-filled from `vercel.json`)*
   - **Install Command**: `pnpm install` *(pre-filled from `vercel.json`)*
3. Click **Environment Variables** and add every key from `frontend/.env.example` (both `NEXT_PUBLIC_*` and server-only keys such as `OPENAI_API_KEY` and `PINATA_JWT`).
4. Click **Deploy**.

### Setting Environment Variables in Vercel

In the Vercel dashboard go to **Project → Settings → Environment Variables**:

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_WC_PROJECT_ID` | All | WalletConnect project ID |
| `NEXT_PUBLIC_ALCHEMY_KEY` | All | Alchemy API key |
| `NEXT_PUBLIC_FACTORY_*` | All | Factory address per chain |
| `NEXT_PUBLIC_LOCKER_*` | All | LPLocker address per chain |
| `NEXT_PUBLIC_RECEIVER_*` | All | BurnBridgeReceiver address per chain |
| `NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID` | All | Anchor program ID |
| `OPENAI_API_KEY` | Production, Preview | AI description generator |
| `PINATA_JWT` | Production, Preview | IPFS upload via Pinata |

> **Tip:** Set `NEXT_PUBLIC_*` variables in **all three** environments (Production, Preview, Development) so every branch preview and local `vercel dev` works correctly. Set server-only keys (`OPENAI_API_KEY`, `PINATA_JWT`) in Production + Preview only.

### Local development with Vercel environment

After initial deployment, you can pull down your Vercel env vars for local development:

```bash
# Pull env vars from Vercel to .env.local
vercel env pull frontend/.env.local
cd frontend && pnpm dev
```

### Continuous deployment

Every push to `main` triggers a production deployment automatically. Pull requests get preview URLs. No extra CI config is needed — Vercel handles it all.

The `ignoreCommand` in `vercel.json` skips rebuilds when only `contracts/` or `docs/` change, keeping your deployment log clean.

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
> - [ ] `feeRecipient` in `scripts/deploy.ts` is set to your **treasury / multisig wallet** (not the deployer key — the default value is the deployer address, which means fees accumulate in the same hot wallet used for deployment)
> - [ ] You've done a dry-run on testnet with the same parameters
> - [ ] `.env` is not committed to git

After each mainnet deploy:
1. Copy the `tokenFactory` and `lpLocker` addresses into your Vercel project's **Environment Variables** dashboard (and update `frontend/.env.local` for local dev).
2. Verify contracts on the respective block explorer (same `npx hardhat verify` command, with the mainnet network name).
3. Trigger a Vercel re-deploy so the new addresses take effect (push any change to `main`, or click **Redeploy** in the Vercel dashboard).

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
# In Vercel Environment Variables dashboard (and frontend/.env.local for local dev)
NEXT_PUBLIC_FACTORY_NEWCHAIN=0x...
```

Done — the UI detects the new chain immediately on next build.

---

## 11. (Optional) Solana Cross-Chain Bridge

If you want to enable the **burn-to-activate** cross-chain mechanic (burn SPL tokens on Solana → mint ERC20 on EVM), follow the guide in [`docs/CROSS_CHAIN_BURN_BRIDGE.md`](./CROSS_CHAIN_BURN_BRIDGE.md).

> ⚠️ **Scaffold status:** `BurnBridgeReceiver.receiveMessage()` currently reverts with a clear error message until the Wormhole VAA integration is complete. Development testing uses `receiveRelayedMessage()` with a trusted relayer. See the bridge guide for details.

The short version:

```bash
# 1. Build & deploy the Anchor program
cd contracts/solana
anchor build
anchor deploy --provider.cluster devnet

# 2. Set SOLANA_EMITTER in contracts/evm/.env (program ID as bytes32 hex)
# 3. Set MINTABLE_TOKEN (the ERC20 that will be minted after bridge calls)

# 4. Deploy BurnBridgeReceiver on each EVM chain (testnets first)
cd ../evm
pnpm deploy:bridge:sepolia
pnpm deploy:bridge:arbitrumSepolia
pnpm deploy:bridge:baseSepolia

# 5. Mainnet bridge deployment (after testnet verification)
pnpm deploy:bridge:mainnet
pnpm deploy:bridge:arbitrum
pnpm deploy:bridge:base
pnpm deploy:bridge:bsc
pnpm deploy:bridge:polygon
pnpm deploy:bridge:avalanche

# 6. Set env vars in Vercel Environment Variables dashboard
#    NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID=<from anchor deploy>
#    NEXT_PUBLIC_RECEIVER_SEPOLIA=<from deploy:bridge:sepolia output>
#    ... (one per chain)
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
| Frontend shows "Factory not deployed" | Fill in `NEXT_PUBLIC_FACTORY_<CHAIN>` in Vercel's Environment Variables and redeploy |
| Vercel build fails with "turbo not found" | Ensure `vercel.json` `installCommand` is `pnpm install`; Vercel auto-installs turbo from `devDependencies` |
| Vercel build ignores env var changes | In the dashboard go to **Deployments → Redeploy** (with "Use existing Build Cache" unchecked) |
| `vercel env pull` fails | Run `vercel login` first; ensure you linked the project with `vercel link` |
| OPENAI / PINATA not working on Vercel | These are server-only keys — add them **without** `NEXT_PUBLIC_` prefix in Vercel Environment Variables |
| `next build` fails locally | Run `pnpm install` from the repo root and retry |

### Troubleshooting: Vercel Root Directory

**Symptom:** `Error: The provided path "~\frontend" does not exist` (or any variant like `~/frontend`, `frontend`).

**Cause:** The Vercel project's **Root Directory** setting was configured with an invalid path. Vercel expects paths relative to the repository root with forward slashes, and the tilde (`~`) is not expanded — it is treated as a literal directory name that does not exist in the repo.

**Fix (Dashboard):**
1. Go to your Vercel project → **Settings → General → Root Directory**.
2. Clear the field so it is empty (defaults to `.`, the repository root).
3. Confirm the following fields match:
   - **Build Command**: `pnpm turbo run build --filter=@tokenforge/frontend`
   - **Output Directory**: `frontend/.next`
   - **Install Command**: `pnpm install`
4. Click **Save**, then trigger a new deployment.

**Fix (CLI):**
Always run `vercel` from the repository root (the directory containing `vercel.json`):
```bash
cd /path/to/cookbook   # repo root — NOT your home directory
vercel
# When prompted "Project root directory?" enter:  .
```

---

*Questions? Open an issue or drop into the [GOONFORGE community](https://goonforge.xyz).*
