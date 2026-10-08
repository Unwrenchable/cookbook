# Security audit — GoonForge / cookbook

Date: 2026-10-08. No contracts were deployed.

## What this project is

GoonForge (`cookbook`) is a multi-chain meme-token launchpad. A Next.js app lets a wallet deploy one of nine ERC-20 flavors through a per-chain `TokenFactory`. The factory clone-deploys OpenZeppelin minimal proxies of:

- `StandardERC20`, `TaxableERC20`, `DeflationaryERC20`, `ReflectionERC20`
- `BondingCurveToken`, `PumpMigrateToken`
- `AIAgentToken`, `PolitiFiToken`, `UtilityHybridToken`

The same deploy ships an `LPLocker`. A Solana Anchor program, `token-burn-bridge`, is supposed to burn an SPL token and wake an ERC-20 on EVM through Wormhole. That path was a scaffold: the program emits an event, and `BurnBridgeReceiver.receiveMessage()` still reverts. The missing piece for even the trusted-relayer path was a mintable ERC-20. `BridgeMintableToken` is that token. `scripts/deployBridgeMintableToken.ts` deploys it; the owner must then call `setMinter` with the receiver. This change set does not run either script.

Stack: Solidity 0.8.28, Hardhat, OpenZeppelin 5, Anchor 0.30, Next.js 15, pnpm, Turborepo. CI (`.github/workflows/ci.yml`) already installs, lints, runs `pnpm test`, compiles, and runs the Hardhat preflight. That workflow now covers the new tests because they live in `contracts/evm/test`.

## Test coverage

| | Before | After |
|---|---|---|
| Hardhat tests | 40, all in `TokenFactory.test.ts` | **59 passing** |
| API limit tests | none | **5 passing** (`frontend/src/lib/apiLimits.test.ts`, `node --test`) |
| What they hit | Factory deploy, one happy path per flavor, flat and percentage launch fees, referrals, basic LP lock | Those, plus reflection payouts, staking solvency, curve round-trips and a 12-step reserve fuzz, pump graduation, PolitiFi resolution, the AI burn cap, fee-on-transfer locks, and the burn bridge |
| Bridge / mintable token | No tests. No mintable contract in the repo | `BridgeMintableToken` plus relay, replay, padding, wrong-chain, and wildcard tests |
| Solana | `contracts/solana/tests/token-burn-bridge.ts` existed but was not in CI | Same suite, plus inactive-chain, all-chains minimum, and zero-recipient cases. Not executed here (see below) |
| Static analysis | Solhint in CI | Solhint clean. Slither 0.11.6 against Hardhat: no high findings after the fixes |

`cargo check` for the Anchor program did not finish. The sandbox Cargo is 1.83.0, and a transitive crate (`block-buffer` 0.12.0) needs Cargo edition 2024 (Rust 1.85+). `solana-test-validator` / Anchor are not installed, so the TypeScript Anchor tests were updated but not run.

Line coverage was not collected. `hardhat coverage` with `viaIR` is a separate long job; the table above is the executed suite, not an lcov percentage.

## Findings

Severity is impact on users of these contracts if they were deployed as previously written.

| ID | Severity | Where | Issue | Status |
|---|---|---|---|---|
| F1 | High | `BurnBridgeReceiver` | Replay key is `keccak256(payload)`, but any length `>= 114` was accepted. Extra trailing bytes change the hash and not the parsed fields, so one burn could mint forever. | **Fixed.** Length must be exactly 114. Test rejects a one-byte suffix. |
| F2 | High | `BurnBridgeReceiver` | `targetChainId == 0` was accepted on every chain. One Solana burn would mint on every receiver. | **Fixed.** Wildcard minting is off until the owner calls `setAcceptWildcardTarget(true)`. |
| F3 | High | `BurnBridgeReceiver` | Production mint path is a trusted relayer, not a Wormhole VAA. `receiveMessage` still reverts. A trusted relayer can submit any payload. | **Not fixed.** Doing this properly is the Wormhole integration, not a small patch. Do not point this at a valuable token. |
| F4 | High | Missing contract | Docs and `deployBurnBridgeReceiver.ts` require an ERC-20 with `mint`, granted to the receiver. No such contract existed (`MINTER_ROLE` was mentioned and never defined). | **Fixed.** `BridgeMintableToken` has a single minter. |
| F5 | High | `ReflectionERC20` | Every transfer synced reflection debt to the new balance and dropped unclaimed rewards. The reflection tax was burned and nobody could claim it. | **Fixed.** Checkpoints store claimable rewards before the balance change, then distribute on post-transfer balances. Test: claimed amount matches the burn within a few wei. |
| F6 | High | `UtilityHybridToken` | `fundRewardPool` / `stake` / `unstake` / `claimRewards` went through the burn tax. The pool was credited for tokens the contract never received, so reward claims could spend other users' staked principal. Unstake also burned principal. | **Fixed.** Transfers to or from the token contract are not burned. Test checks balance equals `totalStaked + rewardPool`. |
| F7 | High | `UtilityHybridToken` | Unstake enforced the wallet cap and then set `isExcludedFromCap` from the remaining stake, wiping an owner exclusion and trapping any stake above the cap (easy once burns shrink supply). | **Fixed.** The recipient is exempt for the unstake transfer. The pre-stake flag is restored only when the stake hits zero. |
| F8 | Medium | `UtilityHybridToken` | Votes counted wallet balance plus stake in the same transaction. A flash loan could pass any proposal. Reward math could also overflow and brick `unstake`. | **Fixed.** Weight is stake that existed before the proposal. Rewards use `Math.mulDiv`. Proposals last 1–30 days. |
| F9 | High | `BondingCurveToken` | `setCurveParams` worked after buys. The owner could reprice the curve and sell into ETH deposited by other users. `getBuyCost` also overflowed inside the buy search. Plain ETH transfers sat outside `ethReserve` and were stuck. | **Fixed.** Parameters lock once supply or reserve is non-zero. Quotes that overflow are treated as too expensive. Bare ETH reverts. Fuzz test: contract balance equals `ethReserve` across random buys and sells. |
| F10 | High | `PumpMigrateToken` | `virtualEthReserve` (0.03 ETH in wei) was added to token supply. The first raw token cost on the order of tens of ETH, so the curve did not work. The fee was taken on the whole `msg.value`, including ETH that was refunded. | **Fixed.** Offset is `virtualTokenReserve = 1_000_000` token units. Fee is charged on the ETH the curve keeps. |
| F11 | High | `PumpMigrateToken` | Graduation pauses trading for 24h and only the owner could resume. There is still no `addLiquidityToDex`. If the owner never resumed, every buyer's ETH stayed in the contract. The owner could also move `graduationThreshold` after trading started. | **Partly fixed.** Anyone can unpause after 24h. Only the owner may set the pair. Threshold changes require `ethReserve == 0`. **Not built:** moving the reserve into a DEX and burning the LP. That is the real pump.fun / four.meme behavior and needs a router, slippage limits, and a locker integration. |
| F12 | Medium | `PolitiFiToken` | `lockCutoff` added the same holder every time it was listed, so the owner could inflate a side and distort or zero-out prizes. Prize claims were taxed again. `resolve` ignored `resolutionTime` because of `\|\| msg.sender == owner()`. Loser burn was documented and never implemented, and holders could transfer out of a position after the snapshot. | **Fixed.** Snapshots are deduped. User transfers freeze from cutoff until resolution. Prize payouts are not taxed. `resolve` requires the timestamp. `applyLoserBurn` burns `loserBurnBps` of the loser's balance, and that address cannot transfer until it runs. |
| F13 | Medium | `token-burn-bridge` | `is_active` was stored and never checked. `target_chain_id = 0` only required the 100-token minimum, not the 1,000-token all-chains tier. The zero EVM address was accepted. The "3 chains" tier is not an instruction: the call takes one chain id. | **Fixed** for inactive receivers, the all-chains minimum, and the zero recipient. The 500-token tier still activates one chain. Tests were added; they were not run in this environment. |
| F14 | High | Repo secrets | `contracts/solana/target/deploy/token_burn_bridge-keypair.json` and the local validator keypairs under `.anchor/test-ledger/` were committed, along with ledger rocksdb files. Anyone with the program keypair can deploy or upgrade that program id. | **Removed from the index** and gitignored (`.anchor/`, `test-ledger/`, `target/`). They remain in git history. **Rotate the program id before any deploy.** This PR does not generate a replacement key. Full scan notes are below. |
| F15 | Medium | `LPLocker` | The lock stored the requested amount, not the tokens received. A fee-on-transfer token let a later unlock pull another user's deposit. | **Fixed.** The lock stores the balance delta. Extend and transfer were added. |
| F16 | Medium | `TaxableERC20` | Owner could retarget the DEX pair and raise tax after launch. That is the usual honeypot. Caps at 25% were the only limit. | **Mitigated.** `lockTax()` freezes tax, pair flags, and the marketing wallet. It is opt-in. Calls before the lock still work, which is existing behavior. |
| F17 | Low | `TokenFactory` | `decimals` up to 255 could overflow `10 ** decimals`. Names and symbols were unbounded. Setting the fee recipient to the factory mixed fees with referral liabilities. | **Fixed.** Decimals ≤ 18, name ≤ 64, symbol ≤ 16, recipient cannot be the factory. |
| F18 | Low | `AIAgentToken` | `treasuryBalance` was not updated after burns or redistributions. | **Fixed.** |
| F19 | Medium | Upload, describe, and RPC proxies | SVG logos were accepted. `getProgramAccounts` and `requestAirdrop` were forwardable. Errors echoed Pinata, OpenAI, and rejected method names. No rate limit or batch cap. | **Fixed.** SVG rejected. Those methods removed. Bodies capped at 32KB, batches at 8. 120 RPC calls/min and 20 uploads or descriptions/min per instance. Failures return a fixed string. RPC URLs are a fixed map, not a caller-supplied host. |
| F20 | Low | Branch protection | `protect-main.yml` required a status check named `type-check`. The CI job is `quality`. | **Fixed** in the workflow file. It only takes effect the next time that workflow runs on `main`. |
| F21 | Low | `LPLocker` tests | Unlock times used `Date.now()`, so they failed once another test moved Hardhat's clock. | **Fixed.** Tests use the latest block timestamp. |
| F22 | Info | Slither | `stakes[msg.sender].amount == 0` is how the first stake remembers the cap-exclusion flag. `lpTokensLocked` is never written. | **Left.** The equality is intentional. `lpTokensLocked` is the unimplemented graduation lock (see F11). |
| F23 | Info | Dependencies | `pnpm audit` on main reported 4 criticals: Next.js below 15.5.24, `protobufjs` below 7.5.5, and `shell-quote` below 1.11.0. A later pass still had 66 high. | **Mostly fixed.** See "Dependency audit" below. After the second override pass: 0 critical, 11 high, 14 moderate, 6 low. |
| F24 | Medium | `TokenFactory` | Nothing could stop new launches if a template turned out to be unsafe. | **Fixed.** `setLaunchesPaused` is owner-only and blocks `createToken` and `createTokenWithReferral`. Existing clones are not paused or upgraded. |
| F25 | High | `useSolanaLaunch` | If the Wormhole poll timed out, the client built a simulated payload and submitted `receiveRelayedMessage`, including on a mainnet target. | **Fixed.** Timeout throws and sends nothing. The wallet chain id must match the target before `writeContract`. |
| F26 | Medium | `SwapWidget` | A swap could be sent with `amountOutMin` of 0 when the quote had not loaded. | **Fixed.** No router, or a missing quote, sets an error and returns. Otherwise the minimum is 99% of the quoted output, with a 5-minute deadline. The recipient is the connected wallet. |

## Dependency audit

Counts are `pnpm audit` metadata.

| | Critical | High | Moderate | Low |
|---|---|---|---|---|
| `main` before this PR | 4 | (not re-counted here) | | |
| After the first bumps (Next 15.5.27, shell-quote, postcss, js-yaml, brace-expansion, protobufjs) | 0 | 66 | 91 | 9 |
| After this follow-up | 0 | 11 | 14 | 6 |

Same-line overrides added in this follow-up, where a patched release exists and the jump stays inside the installed major: `axios` 1.20.0, `hono` 4.13.13, `form-data` 4.0.6, `browserslist` 4.29.3, `fast-uri` 3.1.8, `socket.io-parser` 4.2.7, `source-map-js` 1.2.2, `immutable` 4.3.9, `ip-address` 10.7.3, `sharp` 0.35.5, `ws` 8.22.0 (8.x only) and `ws` 7.5.13 (the 7.5.10 copy), `@fastify/busboy` 3.2.2, `adm-zip` 0.6.1, `follow-redirects` 1.16.1, `bn.js` 4.12.3 (the 4.11.6 copy only), `pbkdf2` 3.1.7, `ua-parser-js` 2.0.10, `uuid` 11.1.1 (the 11.1.0 copy only). Hardhat tests (59) and `tsc --noEmit` passed after the lockfile update.

Left on purpose:

| Package | Installed | Why it stays |
|---|---|---|
| `bigint-buffer` 1.1.5 | `@solana/buffer-layout-utils` | No patched release (`patched_versions` `<0.0.0`). |
| `braces` 3.0.3 | `chokidar`, `micromatch` | No patched release. Glob DoS, not on a request path in this app. |
| `http-cache-semantics` 4.2.0 | `cacheable-request` | No patched release. |
| `image-size` 1.2.1 | `metro` (wallet-adapter toolchain) | Fix is 2.0.3, a new major. Not called by a launch or swap route. |
| `tmp` 0.0.33 | `solc` 0.8.26 | Fix is `>=0.2.6` and the API changed. Compile-time only. |
| `toml` 3.0.0 | Anchor 0.32 and `@stellar/stellar-sdk` | Fix is `>=4.2.0`. A major bump can break Anchor's config parser. |
| `undici` 5.29.0 | `hardhat` and `hardhat-verify` | Fix is `>=6.24.0` (some advisories `>=6.28.1`). Dev tooling, not the Next server. |
| `decode-uri-component` 0.2.2 | `query-string` | Fix is `>=0.5.0`. |
| `sprintf-js` 1.0.3 | `argparse` | No patched release. |
| `stream-json` 1.9.1 | `jayson` (Solana RPC client) | Fix is 3.5 / 3.6. |
| `uuid` 8.3.2 and 9.0.1 | Hardhat, MetaMask SDK, Solflare, Keystone | The advisory wants `>=11.1.1`. uuid 11 is ESM-only, so those copies stay. The `rpc-websockets` copy is now 11.1.1. |

## Secret scan

Scanned all 97 commits with gitleaks 8.30.1 (`detect --log-opts=--all`, secrets redacted) and a separate pass over every blob for 64-byte Solana keypair JSON, `sk-` tokens, JWTs, AWS key ids, and assigned `PRIVATE_KEY` / API key lines. Values are not repeated here.

| What | File | Commit | Notes |
|---|---|---|---|
| Solana program keypair (64-byte JSON array) | `contracts/solana/target/deploy/token_burn_bridge-keypair.json` | `cccb3644dfcfeed5907d3c45c09c512dfc01808f` (2026-04-12, "6hrs") | Real deploy key for program id `2sAka7jCkP71LbKk1MpELxFpjSHjScQk1aStrDt4Pnnf`. Still on `main` until this PR. **Rotate the program id before devnet or mainnet.** Do not commit a replacement key. |
| Localnet faucet keypair | `contracts/solana/.anchor/test-ledger/faucet-keypair.json` | same commit | Throwaway validator material. Do not reuse. |
| Stake account keypair | `contracts/solana/.anchor/test-ledger/stake-account-keypair.json` | same commit | Same. |
| Validator keypair | `contracts/solana/.anchor/test-ledger/validator-keypair.json` | same commit | Same. |
| Vote account keypair | `contracts/solana/.anchor/test-ledger/vote-account-keypair.json` | same commit | Same. |
| Placeholder deployer key | `contracts/evm/.env.example` and `contracts/evm/hardhat.config.ts` | Introduced `60a74ed19c617b923c0348d9f0bdec2876e23904` (2026-03-12). Removed from both files in `a8844dd502cb5fe556349934166b45ac41700470` (2026-04-12). | The value is private-key integer 1. The same bytes were the simulated Wormhole emitter in `useSolanaLaunch.ts` until this follow-up deleted that fallback. Verdict and on-chain balances are in the table below. |
| gitleaks `generic-api-key` | `contracts/solana/Anchor.toml` lines 6 and 9 | `cccb3644dfcfeed5907d3c45c09c512dfc01808f` | False positive. Those lines are the public program address. Match length 8, entropy about 4.6. |

No committed OpenAI, Pinata, JWT, or AWS credentials showed up. `.agentx/agents.json` contains 12-character `sk-` strings inside task and risk labels. Those are not API keys.

`frontend/.env.local.txt` was never in git. It is ignored now. If that working-tree file holds a real private key or API tokens, rotate them anyway. They were sitting next to the repo without an ignore rule.

History still contains the Solana keypairs. This PR does not rewrite history.

## Exposure verdict

Checked 2026-10-08. The GitHub repo [Unwrenchable/cookbook](https://github.com/Unwrenchable/cookbook) is **public**. No secret values are written below. Addresses are public keys only.

Solana `getAccountInfo` and `getSignaturesForAddress` (limit 1) were queried on `https://api.mainnet-beta.solana.com` and `https://api.devnet.solana.com`. EVM `eth_getBalance` and `eth_getTransactionCount` were queried on public RPCs (drpc, 1rpc, and Binance dataseed). The program keypair's public half was derived locally from the historical JSON and matches `declare_id` in `contracts/solana/programs/token-burn-bridge/src/lib.rs` line 35.

| Item | File, line, commit | Class | Evidence | Action |
|---|---|---|---|---|
| Solana program keypair | `contracts/solana/target/deploy/token_burn_bridge-keypair.json` (single JSON line) in `cccb3644dfcfeed5907d3c45c09c512dfc01808f`. Dropped from the index in `62fc0d7`. | **REAL-EXPOSED** | 64-byte keypair. Public key `2sAka7jCkP71LbKk1MpELxFpjSHjScQk1aStrDt4Pnnf`. Account absent on mainnet-beta and devnet, 0 signatures, so there is no live upgrade authority. The secret is in a public history, so anyone can deploy or upgrade that program id later. | **rotate now** |
| Test-ledger faucet keypair | `contracts/solana/.anchor/test-ledger/faucet-keypair.json`, same commit | **REAL-EXPOSED** | Public key `21xWpEi9oQtRqkcEZgwze7DcLAGDUctGTtZ6paRTwL47`. Absent, 0 signatures, both clusters. | **no action** |
| Test-ledger stake keypair | `.../stake-account-keypair.json`, same commit | **REAL-EXPOSED** | Public key `GF7KU1kfGM6qy8G7Zc7wQUpMwP6vWCn9DpMxhN6wrt3K`. Absent, 0 signatures, both clusters. | **no action** |
| Test-ledger validator keypair | `.../validator-keypair.json`, same commit | **REAL-EXPOSED** | Public key `HwjJ4b27rGdZgbFjjaHbzbpftNv5pUTb7n7guxCuGMUS`. Absent, 0 signatures, both clusters. | **no action** |
| Test-ledger vote keypair | `.../vote-account-keypair.json`, same commit | **REAL-EXPOSED** | Public key `G1WAmtnxYm7n5K9pC1uZNk1Wi1opmZiTrjiA14aFZ8xH`. Absent, 0 signatures, both clusters. | **no action** |
| Private-key integer 1, Hardhat fallback, simulated Wormhole emitter | `contracts/evm/.env.example` line 5 and `contracts/evm/hardhat.config.ts` line 7 in `60a74ed19c617b923c0348d9f0bdec2876e23904`. Removed from both in `a8844dd502cb5fe556349934166b45ac41700470`. Emitter bytes were `frontend/src/hooks/useSolanaLaunch.ts` line 435 at `db69794` (deleted in this follow-up). | **MOCK/PUBLIC** | The value is the 32-byte integer 1, not a generated project key. Derived address `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`. Balance 0 on Ethereum (4869 txs), Sepolia (997), Polygon (3583), Amoy (111), Arbitrum (1577), Base (2741), Base Sepolia (95), Optimism (22326), Optimism Sepolia (23), BSC (12132), BSC testnet (759), Avalanche (63). Arbitrum Sepolia holds 388831848000 wei (about 3.9e-7 ETH) across 210 txs. That dust and history belong to the well-known weak key. | **no action** |
| Current env examples | `contracts/evm/.env.example` lines 5–16 and 25; `frontend/.env.example` (Alchemy, Solana RPC, OpenAI, Pinata, and every `NEXT_PUBLIC_*`) | **MOCK/PUBLIC** | `PRIVATE_KEY` is the placeholder text `0xYOUR_PRIVATE_KEY`. Alchemy entries are placeholder text. Explorer keys, `OPENAI_API_KEY`, `PINATA_JWT`, and `SOLANA_RPC_URL` are empty. `SOLANA_EMITTER` is 32 zero bytes. | **no action** |
| gitleaks `generic-api-key` | `contracts/solana/Anchor.toml` lines 6 and 9 in `cccb3644dfcfeed5907d3c45c09c512dfc01808f` | **MOCK/PUBLIC** | The match is the public program id above. Match length 8, entropy about 4.6. | **no action** |
| Hardcoded RPC URLs and JWTs in source | `frontend/src/app/api/rpc/[chain]/route.ts` public fallbacks; Alchemy URL templates in that file and `hardhat.config.ts` | **MOCK/PUBLIC** | Fallbacks are public endpoints (`eth.llamarpc.com`, `rpc.sepolia.org`, `polygon-rpc.com`). Alchemy URLs interpolate a server env var. No JWT or API-key literal is committed. | **no action** |
| `NEXT_PUBLIC_*` | `frontend/src/lib/wagmiConfig.ts`, `chains.ts`, `lpLockerAbi.ts`, `crossChain.ts`, `networkContext.tsx` | **MOCK/PUBLIC** | Contract addresses, a testnet flag, the program id, and a WalletConnect project id. WalletConnect ids are public by design. None are private keys or server tokens. Next inlines only `NEXT_PUBLIC_*`. | **no action** |
| `SOLANA_RPC_URL` read from a client component | `frontend/src/components/SolanaProviders.tsx` before this follow-up (`"use client"`) | **REAL-NOT-EXPOSED** | The value was never committed (`frontend/.env.example` line 52 is empty). The old component read `process.env.SOLANA_RPC_URL` during SSR, which would embed a private URL in HTML if a host had set it. This follow-up uses `clusterApiUrl` unless a caller passes `rpcEndpoint`. The API route still reads the env on the server only. | **no action** (rotate that RPC URL only if a hosted build was produced while the old client read was in place) |
| Local `frontend/.env.local.txt` | Not in any commit | **REAL-NOT-EXPOSED** | Absent from this clone and from git history. Now ignored. | **rotate now** if that file on your machine holds a real deployer key or API tokens; otherwise **no action** |
| `.agentx/agents.json` `sk-` strings | task and risk labels | **MOCK/PUBLIC** | 12-character labels, not API keys. | **no action** |

Browser check: `PINATA_JWT`, `OPENAI_API_KEY`, `ALCHEMY_KEY`, and `SOLANA_RPC_URL` are read only inside `frontend/src/app/api/**` route handlers. No client component imports those routes. The simulated emitter bytes (public integer-1 material) used to ship in the client bundle; that fallback is gone, so a timeout no longer signs a fake bridge message.

Test-ledger keys are real key material that was published, and they control nothing on the chains this project targets. Do not reuse them. Do not treat integer 1 as a GoonForge treasury key.

## Dependabot PRs this change supersedes

Taken only where a newer patched release exists. None of those PRs were closed or merged from here.

| PR | What it asked for | This PR |
|---|---|---|
| [#58](https://github.com/Unwrenchable/cookbook/pull/58) | `next` 15.5.18 → 15.5.24 | **Supersedes.** Resolved `next` 15.5.27, the latest 15.5.x. 15.5.24 fixed the critical RCEs. 15.5.27 is the 30 Sep 2026 Maintenance LTS release (image-optimizer SSRF and SSG/ISR cache poisoning). Not Next 16. |
| [#50](https://github.com/Unwrenchable/cookbook/pull/50) | `shell-quote` 1.8.4 → 1.10.0 | **Supersedes, past the PR.** 1.10.0 does not fix GHSA-pqg4-j6r4-53mv (patched in 1.11.0). Resolved 1.12.0. |
| [#53](https://github.com/Unwrenchable/cookbook/pull/53) | `postcss` 8.5.8 → 8.5.23 | **Supersedes.** Direct dependency is 8.5.29 (includes 8.5.23). Also moved Next's nested `postcss` 8.4.31 up to 8.5.29, which 8.5.23 alone would have left vulnerable. |
| [#57](https://github.com/Unwrenchable/cookbook/pull/57) | `js-yaml` 3.14.2 → 3.15.2 | **Supersedes.** Root lock now resolves 3.15.2. |
| [#55](https://github.com/Unwrenchable/cookbook/pull/55) | `js-yaml` 4.1.1 → 4.3.1 in `contracts/solana/package-lock.json` | **Supersedes, past the PR.** 4.3.1 is still in `>=4.0.0 <4.3.2` (empty-merge CPU advisory). Both the Solana lock and the root lock resolve 4.3.2. |
| [#56](https://github.com/Unwrenchable/cookbook/pull/56) | `brace-expansion` 2.0.3 → 2.1.4 in `contracts/solana/package-lock.json` | **Supersedes, past the PR.** 2.1.4 is still below 2.1.5, 2.1.6, and 2.1.7 (stack and CPU DoS). Solana lock is 2.1.7. Root lock 1.1.13, 2.1.0, 2.1.1, and 5.0.5 moved to 1.1.21, 2.1.7, and 5.0.12. |
| [#48](https://github.com/Unwrenchable/cookbook/pull/48) | `cmov` 0.5.3 → 0.5.4 in `contracts/solana/Cargo.lock` | **Included, not executed.** Same version and checksum as that PR. `cargo check` still cannot run here: Cargo 1.83.0 cannot parse `block-buffer` 0.12.0 (edition 2024). Anchor tests were not run. |

`protobufjs` 7.4.0 → 7.6.6 is not one of those PRs. It was the other critical from `pnpm audit` (fixed in 7.5.5). No Dependabot PR is left unaddressed from the list above.

## Competitive gaps

Compared with pump.fun, four.meme, PinkSale, and Clanker (Base / Uniswap v4), checked October 2026:

**Shipped in this PR (small):**

- Permanent tax lock, which those platforms get by not having a mutable tax at all.
- LP lock extend and transfer, which PinkLock-style lockers already have.
- A pump curve that is cheap enough to buy, and a graduation pause that cannot freeze ETH forever.
- The mintable token the bridge deploy script already assumed.

**Do these next, in order:**

1. **Finish graduation for real.** pump.fun and four.meme move the curve reserve into a DEX pool and burn the LP. `PumpMigrateToken` pauses, emits `Graduated`, and stops. Until `addLiquidityToDex` exists, "pump → CEX" is a bonding curve with a pause. This is the feature gap that matters most, and it is too large and too easy to get wrong to sneak into this patch.
2. **Stop calling the bridge trustless until VAA verification exists.** Wire Wormhole `post_message` on Solana and `parseAndVerifyVM` on the receiver, with the emitter check that `receiveRelayedMessage` does not do. Until then, keep `BridgeMintableToken` on a test mint.
3. **Rotate the Solana program id** before devnet or mainnet. The program keypair is in commit `cccb3644dfcfeed5907d3c45c09c512dfc01808f` and stays in history after this PR. Generate the new key locally and do not commit it. Also rotate any API token or deployer key that lived in an untracked `frontend/.env.local.txt` or similar file.
4. **Launch on Solana directly.** The roadmap item is the actual market. pump.fun's advantage is distribution and a one-click SPL curve, not nine ERC-20 flavors.
5. **Default launches to immutable settings.** Competitors that allow tax (four.meme) still make the split explicit at creation. GoonForge should call `lockTax()` from the deploy UI and show whether it was locked. Owner-set DEX pairs are the honeypot.
6. **Creator fees and a market, not another flavor.** pump.fun publishes a curve fee (about 1.25% including a 0.30% creator fee) and a live order flow. A factory with a 0.5% launch fee and a swap deep-link does not give traders a reason to stay.
7. **Anti-sniper on the first blocks.** Clanker auctions or decays the first swaps (up to about two minutes). A public `createToken` plus an immediate buy is sandwichable. Slippage arguments on the curve help the buyer, not the block after creation.
8. **Discovery, vesting, and a locker explorer.** PinkSale's lock duration, vesting, and a page that shows who is locked are what buyers check. `LPLocker` has no index beyond on-chain events.

## User-safety hardening

API routes (`solana-rpc`, `rpc/[chain]`, `ipfs-upload`, `ai-describe`):

- Method allowlists stay. `requestAirdrop` is no longer forwarded. `getProgramAccounts` was already removed.
- Unknown chain ids never become a URL. Solana `network` is only `devnet` or `mainnet-beta`.
- Bodies over 32KB are rejected. RPC batches over 8 calls are rejected. The error does not repeat the rejected method.
- Pinata and OpenAI failures return "Image upload failed", "Metadata upload failed", "Description service unavailable", or "Upload failed" / "Description failed", not the upstream body.
- In-memory rate limits: 120/min for each RPC proxy, 20/min for upload and describe. Keyed by the first `x-forwarded-for` hop or `x-real-ip`. This map is per server instance. It is not a global limit on a multi-instance host.
- There is no `frontend/src/app/api/cross-chain/` route in this repo. That folder was left untouched.

Frontend transactions:

- Swap shows the connected wallet as recipient, a 1% slippage line, and refuses to send until a quote exists.
- Bridge submit checks the wallet chain id against `target.evmChainId` and does not fall back to a simulated VAA.
- Token names and metadata URIs render as React text or as links built by our upload route (`https://gateway.pinata.cloud/ipfs/...`). `dangerouslySetInnerHTML` is only the static JSON-LD in `layout.tsx`. SVG uploads stay rejected.

Contracts (existing behavior kept where a change would surprise holders):

- Factory launches can be paused. That does not seize or pause tokens already deployed. EIP-1167 clones embed the implementation address, so `setImplementation` affects future clones only. No timelock was added on that setter.
- `createToken`, `createTokenWithReferral`, `claimReferralEarnings`, LP lock/unlock, curve buy/sell, and `receiveRelayedMessage` are non-reentrant. Token reward claims use internal `_transfer` / `_mint`.
- `launchFeeBps` is at most 1000 (10%) and `referralShareBps` at most 5000, both with events. The flat `launchFee` in wei is still unbounded. Tax stays mutable until the owner calls `lockTax()`.
- No admin function transfers a user's token balance to the owner. Curve and pump reserves are not withdrawable except through sells (and, after 24h, anyone can resume pump trading).

## Behavior that changed on purpose

These are deployed only when someone ships the new bytecode. Existing clone addresses keep their old implementation.

- Reflection transfers pay holders instead of only burning.
- Staking, unstaking, reward funding, and reward claims move the full amount. Ordinary wallet transfers still burn.
- Governance weight is prior stake, not tokens held in the wallet.
- Bonding-curve parameters freeze after the first trade. Bare ETH to a curve reverts.
- The pump curve's virtual reserve is 1,000,000 token units, not 0.03 ETH of wei added to supply. The trading fee applies to consumed ETH. Anyone can resume trading after 24 hours.
- PolitiFi transfers freeze between cutoff and resolution. Losers must be burned before they can transfer. `resolve` waits for `resolutionTime`.
- Bridge messages of the wrong length, the wrong chain, or chain id 0 (unless opted in) do not mint.
- The factory rejects oversized names, symbols, and decimals.
- SVG uploads are rejected.
- The factory owner can pause new launches. Tokens already deployed keep working.
- A swap without a quote, or a bridge proof that has not arrived, does not send a transaction.

Happy-path factory tests from before this change still pass.
