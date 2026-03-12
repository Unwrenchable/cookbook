# GOONFORGE.XYZ

The degen launchpad that prints the next 100x.

Launch any meme, any chain, any flavor in under 60 seconds.  
Testnet toggle. Bonding curves. Tax/Reflection/AI tokens. Renounce + lock + liquidity add in one click.

Built by frens. For frens who actually goon the charts.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-GOONFORGE.XYZ-a3e635?style=flat)](https://goonforge.xyz)

---

## Vision

A dark, beautiful, production-ready degen launchpad supporting testnets and mainnets simultaneously, every token flavor from Standard ERC20 to bonding-curve memes, built-in LP locking, a swap widget, and Solana-first cross-chain burn activation.

---

## Features

### MVP (shipped)
- 🔗 **Wallet auto-detect** — MetaMask, WalletConnect, Coinbase Wallet, Phantom via RainbowKit (EIP-6963)
- 🌐 **Chain selector** with one-click **Testnet ↔ Mainnet toggle** (ETH, BSC, Polygon, Arbitrum, Base, Avalanche)
- 🎨 **9 token flavors:**
  1. **Standard ERC20** – plain transferable token
  2. **Taxable** – configurable buy/sell tax forwarded to a marketing wallet
  3. **Deflationary** – auto-burn on every transfer
  4. **Reflection** – redistribution to all holders
  5. **Bonding Curve** – pump.fun-style meme token (price increases with supply)
  6. **🤖 AI Agent** – on-chain AI agent wallet with daily burn cap + meme posting
  7. **🏛️ PolitiFi** – binary prediction market, prize pool for winners, burn for losers
  8. **⚙️ Utility Hybrid** – built-in staking, auto-burn, team wallet cap, governance
  9. **📈 Pump → CEX** – bonding curve that graduates to CEX when ETH threshold is hit
- 📝 Dynamic form with flavor-based fields
- 🚀 One-click deploy via **factory + clone pattern** (gas < $2 on most chains)
- 🔒 **Built-in LP Locker** — lock your LP tokens on-chain with a time lock
- 💱 **Swap Widget** — quick-launch swap links for each chain's primary DEX
- 🔥 **Solana-first cross-chain burn** — burn SPL tokens to activate EVM chains via Wormhole
- 🔮 **Vanity address generator** — mine custom addresses like `0xcaps...` or `0xfizz...`
- 📋 "My Tokens" dashboard — every token you've deployed on the current chain
- 🛡️ Factory is immutable; users never trust us with private keys

### v2 (shipped)
- ✅ 0.5% percentage-based launch fee (collected in native token, max of flat/pct)
- ✅ Referral system — 20% of fee to referrer, claimable on-chain
- ✅ IPFS logo + metadata upload via Pinata
- ✅ Auto-listing stubs for DexTools / CoinMarketCap / CoinGecko
- ✅ Basic audit report (Slither guidance + security checklist)
- ✅ Native on-chain DEX swap (Uniswap V2 router integration)
- ✅ AI token description generator (gpt-4o-mini, falls back to templates)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| EVM Contracts | Hardhat + Solidity 0.8.28 + OpenZeppelin 5.x |
| Contract pattern | Factory + Minimal Proxy (Clones) |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Wallet | wagmi v2 + viem + RainbowKit |
| Multi-chain RPCs | Alchemy |
| Monorepo | Turborepo + pnpm workspaces |

---

## Project Structure

```
tokenforge/
├── contracts/evm/
│   ├── contracts/
│   │   ├── factories/TokenFactory.sol      ← one factory per chain
│   │   └── templates/
│   │       ├── StandardERC20.sol
│   │       ├── TaxableERC20.sol
│   │       ├── DeflationaryERC20.sol
│   │       ├── ReflectionERC20.sol
│   │       └── BondingCurveToken.sol
│   ├── scripts/deploy.ts
│   ├── test/TokenFactory.test.ts
│   ├── hardhat.config.ts
│   └── .env.example
├── frontend/
│   └── src/
│       ├── app/                            ← Next.js App Router pages
│       ├── components/
│       │   ├── ChainSelector.tsx           ← testnet/mainnet toggle
│       │   ├── TokenForm.tsx               ← dynamic flavor form
│       │   ├── DeployResult.tsx            ← post-deploy success card
│       │   ├── TokenDashboard.tsx          ← "My Tokens" view
│       │   └── Providers.tsx               ← wagmi + RainbowKit setup
│       ├── hooks/useDeployToken.ts         ← deploy hook
│       └── lib/
│           ├── chains.ts                   ← supported networks config
│           ├── tokenFactoryAbi.ts          ← factory ABI
│           ├── wagmiConfig.ts
│           └── types.ts
├── shared/src/                             ← shared types
├── package.json                            ← pnpm workspaces root
└── turbo.json
```

---

## Deployment

For a full step-by-step deployment guide — including environment setup, testnet and mainnet contract deployment, contract verification, frontend configuration, and Vercel hosting — see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

### Quick start (local dev)

```bash
# 1. Clone & install
git clone https://github.com/Unwrenchable/cookbook.git
cd cookbook
npm install -g pnpm
pnpm install

# 2. Contracts – compile & test
cd contracts/evm
cp .env.example .env
pnpm compile
pnpm test

# 3. Frontend – dev server
cd ../../frontend
cp .env.example .env.local
# Edit .env.local: add your WalletConnect project ID and Alchemy key
pnpm dev
# Open http://localhost:3000
```

---

## Smart Contract Strategy

We use the **Factory + Clone (minimal proxy)** pattern:

1. `TokenFactory.sol` is deployed **once per chain**.
2. Users call `createToken(params)` → factory clones a minimal proxy of the chosen template.
3. Gas cost **< $2** on most L2s.
4. Users never need to trust the deployer.

### Adding a New Chain (< 10 minutes)

1. Add RPC + chainId to `frontend/src/lib/chains.ts`
2. Add network to `contracts/evm/hardhat.config.ts`
3. `pnpm deploy:<newchain>` from `contracts/evm/`
4. Set `NEXT_PUBLIC_FACTORY_<CHAIN>` in `frontend/.env.local`

Done — the UI auto-detects the new chain immediately.

---

## Environment Variables

### contracts/evm/.env.example
```env
PRIVATE_KEY=0x...          # deployer key (never commit!)
ALCHEMY_API_KEY=...
ETHERSCAN_API_KEY=...
BSCSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
```

### frontend/.env.example
```env
NEXT_PUBLIC_WC_PROJECT_ID=...       # WalletConnect project ID
NEXT_PUBLIC_ALCHEMY_KEY=...
NEXT_PUBLIC_FACTORY_SEPOLIA=0x...   # deployed factory addresses
NEXT_PUBLIC_FACTORY_MAINNET=0x...
# ... (one per chain)
```

---

## Security Notes

- All template contracts are verified on Etherscan / BscScan / etc. after deployment.
- The factory is **immutable** after deployment.
- No upgradeable proxies are used unless the user chooses the "upgradable" flavor (planned).
- Factory enforces: total fees ≤ 30%, owner ≠ zero address, supply > 0.

---

## Roadmap

- [x] MVP: 5 flavors, 11 chains, one-click deploy
- [ ] Bonding-curve launch (pump.fun style) – fully on-chain
- [ ] Solana SPL token support
- [ ] Cross-chain token bridge (LayerZero)
- [ ] Mobile app (React Native)
- [ ] AI token description generator
- [ ] IPFS metadata upload
- [ ] Basic audit report generator

---

## Contributing

Follow the folder structure above. PRs welcome!

---

*Built with ❤️ for degens who want to launch in 60 seconds.*

