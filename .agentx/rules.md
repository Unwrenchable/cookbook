# GoonForge Agent Rules

## Hive Mind Protocol

Every agent operates as a node in the GoonForge hive. The rules:

1. **Route first** — before writing code, identify if another agent owns this domain
2. **Hand off cleanly** — when passing work, include: files changed, verification command, blockers
3. **No duplicate work** — if another agent already handled a layer, read their output first
4. **Build gate** — NOTHING merges unless `turbo run build` exits 0
5. **@GoonOverlord** is the final node — all agents report completion to them

### Routing Table (canonical)

| Signal | Primary Agent | Escalate to |
|--------|--------------|-------------|
| Vercel / Turbo / Next.js build failure | `@BuildFixGoon` | `@FrenFrontendGoon` |
| TypeScript type error in frontend | `@BuildFixGoon` | `@FrenFrontendGoon` |
| EVM Solidity contract | `@GoonSolidityMaster` | `@GoonOverlord` |
| Frontend UI / wagmi / React | `@FrenFrontendGoon` | `@GoonOverlord` |
| Tests / Slither / gas report | `@TrenchTester` | `@GoonOverlord` |
| Token copy / X thread / marketing | `@MemeLordAgent` | `@GoonOverlord` |
| Solana payment / pump.fun SDK | `@SolanaPaymentGoon` | `@GoonSolidityMaster` |
| Multi-agent task / roadmap | `@GoonOverlord` | — |

## Goon Squad (Domain Agents)

| Mention | Agent ID | When to call |
|---------|----------|-------------|
| `@GoonSolidityMaster` | `goon-solidity-master` | EVM contracts, Hardhat tests, factory/clone deployments |
| `@FrenFrontendGoon` | `fren-frontend-goon` | Next.js 15 App Router, wagmi v2, shadcn UI, dark neon theme |
| `@TrenchTester` | `trench-tester` | Test coverage, Slither audits, gas reports, edge cases |
| `@MemeLordAgent` | `meme-lord-agent` | Token copy, X launch threads, logo prompts, AI agent flavors |
| `@GoonOverlord` | `goon-overlord` | Full squad coordination, PR review, roadmap |
| `@BuildFixGoon` | `build-fix-goon` | CI failures, Vercel/Turbo build errors, TypeScript/module fixes |
| `@SolanaPaymentGoon` | `solana-payment-goon` | Solana payment flows, pump.fun SDK, on-chain invoice verification |

## Agency Pack (Generic Agents)

Use these for cross-cutting concerns:

| Mention | Agent ID | When to call |
|---------|----------|-------------|
| `@DevOps` | `devops-automator` | CI/CD, Docker, Render/Vercel deploys, infra automation |
| `@ArchitectUX` | `architectux` | Technical architecture decisions + UX foundations |
| `@RepoAuditor` | `repo-auditor` | Code quality scans, gap analysis, migration paths |
| `@EvidenceQA` | `evidenceqa` | Screenshot-based QA, evidence-only certification |
| `@RapidProto` | `rapid-prototyper` | Ultra-fast POCs and MVPs |
| `@PerfBench` | `performance-benchmarker` | Gas benchmarks, bundle size, load testing |
| `@ProductSprint` | `product-sprint-prioritizer` | Sprint planning, feature prioritization |
| `@GrowthHacker` | `marketing-growth-hacker` | User acquisition, viral loops, degen marketing |
| `@BackendArch` | `backend-architect` | API design, database architecture, microservices |
| `@UXResearcher` | `ux-researcher` | User research, usability testing |
| `@UIDesigner` | `ui-designer` | Visual design systems, component libraries |
| `@AIEngineer` | `engineering-ai-engineer` | AI/ML model integration, LLM APIs, agent pipelines |
| `@Whimsy` | `whimsy-injector` | Fun/playful copy and degen energy in UI |

## Cross-chain rules

1. Every contract change touching the bridge MUST have a matching change on BOTH Solana and EVM sides.
2. Never break the `crossChain.ts` constants — frontend depends on `wormholeChainId`.
3. Wormhole VAA replay protection is NOT optional.

## Solidity rules

1. Solidity 0.8.28 + OpenZeppelin 5.x only.
2. Factory + Clones (minimal proxy) pattern — no upgradeable proxies unless requested.
3. Fees ≤ 30%. Every owner-privileged function must have a renounce path.
4. Gas target < $2 on L2s.

## Testing rules

1. EVM: `npx hardhat test` must pass before any PR.
2. Solana: `anchor test` must pass before any PR.
3. Frontend: `npm run type-check` must pass. No `any` casts without a comment.

## Never

- Commit `.env` files or private keys.
- Modify `.github/agents/` files.
- Add upgradeable proxies without explicit user request.
- Skip VAA replay protection checks.
