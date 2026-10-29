# Build, test, and lint commands

This repo is a pnpm workspace managed from the root with Turborepo.

```bash
pnpm install
pnpm compile
pnpm build
pnpm lint
pnpm test
```

Use package-level commands when you only need one surface. In particular, Solidity changes should use `contracts/evm` commands directly; `pnpm build` is not a substitute for `pnpm compile` there.

```bash
# Frontend (Next.js)
cd frontend
pnpm dev
pnpm build
pnpm lint
pnpm type-check

# EVM contracts (Hardhat)
cd contracts/evm
pnpm compile
pnpm test
pnpm lint

# Single Hardhat test file
pnpm test -- test/TokenFactory.test.ts

# Single Hardhat test case
pnpm test -- --grep "Deploys a standard token and mints total supply to token owner"

# Solana bridge (Anchor)
cd contracts/solana
pnpm build
pnpm test
pnpm test:localnet

# Single Solana test case
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/token-burn-bridge.ts --grep "initializes the bridge config"

# Shared package
cd shared
pnpm build
pnpm type-check
```

Current GitHub Actions coverage is narrower than the repo surface: `.github/workflows/ci.yml` only installs `frontend` dependencies with npm and runs `npm run type-check` in `frontend`.

# High-level architecture

This is a monorepo for GOONFORGE.XYZ with four main surfaces:

1. `frontend/`: Next.js 15 App Router UI for EVM token launches, the Solana burn-to-activate flow, LP locking, swap shortcuts, vanity generation, dashboard, and referrals.
2. `contracts/evm/`: Hardhat Solidity workspace. `scripts/deploy.ts` deploys all token template implementations, then a per-chain `TokenFactory`, then `LPLocker`.
3. `contracts/solana/`: Anchor program for the Solana burn bridge plus its tests and deployment/init scripts.
4. `shared/`: TypeScript package with shared types, although the frontend currently imports its local `src/lib/*` modules directly for the live launch flow.

The main frontend wiring starts in `frontend/src/app/layout.tsx`, which wraps the app in `Providers`. `Providers` nests `NetworkProvider` (global testnet/mainnet toggle), wagmi/RainbowKit/React Query, and `SolanaProviders`, so the same UI session can drive both EVM wallet flows and Solana wallet-adapter flows.

The main page in `frontend/src/app/page.tsx` is a tabbed launcher. The EVM launch path is:

`TokenForm` -> `useDeployToken` -> `TOKEN_FACTORY_ABI` on the currently selected chain from `frontend/src/lib/chains.ts`

`useDeployToken` reads the launch fee from the factory, calls `createToken` or `createTokenWithReferral`, then waits for the receipt with viem's `publicClient.waitForTransactionReceipt` and parses the `TokenCreated` event to recover the deployed address. `TokenDashboard` and `ReferralPanel` read back from that same factory contract.

The frontend keeps secrets server-side with Next API routes:

- `frontend/src/app/api/rpc/[chain]/route.ts` proxies EVM JSON-RPC to Alchemy using server-only `ALCHEMY_KEY`
- `frontend/src/app/api/solana-rpc/route.ts` proxies Solana RPC using server-only `SOLANA_RPC_URL`
- `frontend/src/app/api/ai-describe/route.ts` uses `OPENAI_API_KEY` or falls back to built-in copy
- `frontend/src/app/api/ipfs-upload/route.ts` uses `PINATA_JWT` or falls back to mock hashes

On the EVM side, `contracts/evm/contracts/factories/TokenFactory.sol` is the core contract. It clones one of 9 template implementations based on `TokenFlavor`, enforces launch-fee and parameter validation, tracks `tokensByOwner` / `allTokens`, and supports on-chain referrals with `createTokenWithReferral` plus `claimReferralEarnings`.

The Solana bridge flow spans multiple packages and has no server-side minting key. `contracts/solana/programs/token-burn-bridge` burns SPL tokens and posts a Wormhole message (`burn_and_post`, emitted from the program's `["emitter"]` PDA). `frontend/src/hooks/useSolanaLaunch.ts` sends the burn, polls Wormholescan for the signed VAA, and then the user's own wallet calls `BurnBridgeReceiver.receiveMessage(vaa)` (`contracts/evm/contracts/bridge/BurnBridgeReceiver.sol`) through `walletClient.writeContract` on each target EVM chain. The receiver verifies the VAA with Wormhole core `parseAndVerifyVM`, checks the emitter allowlist, and rejects replays by VAA hash and by `(chain, emitter, sequence)`. See `docs/CROSS_CHAIN_BURN_BRIDGE.md`.

# Key conventions

- `TokenFlavor` and the deployment parameter shape are mirrored across `contracts/evm/contracts/factories/TokenFactory.sol`, `frontend/src/lib/types.ts`, and `contracts/evm/test/TokenFactory.test.ts`. Keep them in sync when adding flavors or changing fields.
- Adding a new chain is always a cross-file change. Update `contracts/evm/hardhat.config.ts`, `frontend/src/lib/chains.ts`, `frontend/src/lib/wagmiConfig.ts`, `frontend/src/app/api/rpc/[chain]/route.ts` when the chain is Alchemy-backed, and the relevant `NEXT_PUBLIC_*` env entries in `frontend/.env.example`. For bridge support, also update `frontend/src/lib/crossChain.ts`.
- Empty env-backed contract addresses are a supported state, not an error. `factoryAddress` and `receiverAddress` intentionally default to `""`, and the UI surfaces "soon" badges or warnings instead of crashing when a chain is not deployed yet.
- Do not move RPC/API secrets into client code. The repo pattern is to keep provider keys server-only and route browser calls through Next API handlers.
- Preserve the receipt-waiting pattern in `useDeployToken`: it intentionally uses viem's public client directly instead of wagmi's receipt hook inside async callbacks.
- Preserve the target-chain rule in `useSolanaLaunch`: one selected chain is encoded as that chain's id; more than one encodes target chain 0, which receivers reject unless the timelocked wildcard op has executed. The UI should not pretend arbitrary multi-chain subsets are supported by the current Solana program.
- Preserve the current missing-program behavior in `useSolanaLaunch`: when `NEXT_PUBLIC_SOLANA_BURN_BRIDGE_PROGRAM_ID` is still the placeholder `11111111111111111111111111111111`, the hook now fails explicitly instead of sending a fake no-op transaction.
- `BurnBridgeReceiver.receiveMessage(vaa)`, submitted by the user's wallet, is the only mint path. There is no trusted relayer, no `receiveRelayedMessage()`, and no server-side minting key. Do not add an API route that holds a key and mints.
- Receiver admin changes (trusted emitter, Wormhole core, mint ratio, mintable token, wildcard target) go through the `DelayedAdmin` timelock: `queue*`, wait for the delay, then `execute*`. `SOLANA_EMITTER` is the burn-bridge `["emitter"]` PDA (`pnpm emitter <programId>`), not the program id.
- CI does not cover the full monorepo. If you change contracts or Solana code, do not assume GitHub Actions will catch regressions there.
