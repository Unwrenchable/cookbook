# Chain support bar

Checked 2026-10-08. No new mainnet was added. The chains already in the app stay. Younger or thinner chains stay out, including ones that already have a verified Uniswap V2 router.

## Bar

A chain is eligible for the graduation registry only when every line below is true:

1. Mainnet genesis on or before 2023-10-08 (at least three years old on the day of this check).
2. DefiLlama chain TVL of at least $400 million. The floor sits next to OP Mainnet, the smallest chain already in the app, at about $482 million.
3. DefiLlama 30-day DEX volume of at least $1 billion. Every chain already in the app is at or above $1.53 billion.
4. No open chain-level exploit.
5. A mature canonical V2 router: the router has code, `factory()` matches the documented factory, and `WETH()` or `WAVAX()` matches the documented wrapped native. `addLiquidityETH` (or Trader Joe's `addLiquidityAVAX`) is present.

Sources for the figures: [api.llama.fi/v2/chains](https://api.llama.fi/v2/chains) and [api.llama.fi/overview/dexs/&lt;slug&gt;](https://api.llama.fi/overview/dexs) on 2026-10-08. Ages are the public mainnet launch dates. Router checks are the same RPC procedure recorded in `SECURITY_AUDIT.md`.

Testnets of chains that already cleared this bar are not new chains. Polygon Amoy, Arbitrum Sepolia, Base Sepolia, and OP Sepolia get a pinned copy of Uniswap's published V2 bytecode because those testnets have no publisher router. That pin cannot be returned for any other chain id. See `docs/TESTNET_DEX.md`.

## Already supported

These seven mainnets were already in the registry. They clear the bar. They were not newly added in this change.

| Chain | Genesis | TVL | 30-day DEX volume | Venue |
|---|---|---:|---:|---|
| Ethereum | 2015-07-30 | $52.11B | $44.01B | Uniswap V2 |
| BNB Smart Chain | 2020-09-01 | $5.64B | $32.32B | PancakeSwap V2 |
| Base | 2023-08-09 | $6.24B | $30.33B | Uniswap V2 |
| Arbitrum One | 2021-08-31 | $1.40B | $5.73B | Uniswap V2 |
| Polygon PoS | 2020-05-30 | $684M | $7.21B | QuickSwap V2 |
| Avalanche C-Chain | 2020-09-21 | $629M | $4.04B | Trader Joe V1 |
| OP Mainnet | 2021-12-16 | $482M | $1.53B | Uniswap V2 |

DefiLlama lists OP Mainnet under the name "OP Mainnet". The name "Optimism" reports $0 TVL and is the wrong row. DEX slugs used: `ethereum`, `bsc`, `base`, `arbitrum`, `polygon`, `avalanche`, `optimism`.

## Rejected

None of these were added. A verified V2 router is not enough when age or volume misses the bar.

| Chain | Genesis | TVL | 30-day DEX volume | Why it stays out |
|---|---|---:|---:|---|
| Gnosis | 2018-10-08 | $97.3M | $128M | Age passes. TVL and volume are far under the floor. Honeyswap V2 was not added. |
| Cronos | 2021-11-08 | $155M | $85.2M | Age passes. TVL and volume are thin. VVS Finance V2 was not added. |
| Celo | 2020-04-22 | $17.9M | $59.7M | Age passes. TVL and volume are thin. Ubeswap router `0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121` returns `factory()` but the 9,622-byte bytecode has no `WETH()` and no `addLiquidityETH`. |
| zkSync Era | 2023-03-24 | $15.1M | $13.4M | Age passes. Volume does not. No canonical V2 router, and the toolchain is zksolc. |
| Linea | 2023-07-11 | $25.1M | $11.9M | Under three years is close, but TVL and volume miss by a wide margin. No official V2 router. |
| Mantle | 2023-07-17 | $110M | $96.8M | Under three years. TVL and volume miss. Merchant Moe is Liquidity Book, not `addLiquidityETH`. |
| Scroll | 2023-10-17 | $8.4M | $11.5M | Genesis is after the cutoff. TVL and volume miss. No V2 router. |
| Blast | 2024-02-29 | $22.4M | $4.5M | Too new and thinly traded. Uniswap V2 does verify (`router 0xBB66Eb1c5e875933D44DAe661dbD80e5D9B03035`, `factory 0x5C346464d33F90bABaf70dB6388507CC889C1070`, WETH `0x4300000000000000000000000000000000000004`) and still fails the bar. |
| World Chain | 2024-10-17 | $42.7M | $15.0M | Too new and thinly traded. Uniswap V2 verifies (`router 0x541aB7c31A119441eF3575F6973277DE0eF460bd`, factory `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`, WETH `0x4200…0006`) and still fails the bar. |
| Sonic | 2024-12-18 | $17.3M | $47.1M | Too new and thinly traded. SpookySwap V2 verifies (`router 0xa6AD18C2aC47803E193F75c3677b14BF19B94883`) and still fails the bar. Fantom's remaining book is $6.8M TVL and $0.34M 30-day DEX volume, and the 2023 Multichain exploit is unresolved as a chain history. |
| Unichain | 2025-02-11 | $27.9M | $336M | Too new. Volume is under $1B. Official Uniswap V2 verifies (`factory 0x1f98400000000000000000000000000000000002`, `router 0x284f11109359a7e1306c3e447ef14d38400063ff`, WETH `0x4200…0006`) and still fails the bar. Unichain Sepolia was not pinned. |
| Berachain | 2025-02-06 | $38.7M | $24.6M | Too new and thinly traded. No V2 `addLiquidityETH` router. |
| Hyperliquid L1 | 2024 | $1.10B | $9.83B | Volume would clear a volume-only reading. The chain id is null. It is an order book, not an EVM chain, so there is no V2 router to graduate into. |
| HyperEVM | 2025-02-18 | (see L1) | (see L1) | Chain id 999. Uniswap V2 verifies (`router 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`, `WETH()` returns WHYPE `0x5555555555555555555555555555555555555555`). The chain launched in 2025. The L1 order-book volume is not HyperEVM DEX volume. The testnet router on chain id 998 has no code. |

DEX slugs: `gnosis`, `cronos`, `celo`, `zksync`, `linea`, `mantle`, `scroll`, `blast`, `worldchain`, `sonic`, `fantom`, `unichain`, `berachain`, `hyperliquid`. Hyperliquid's DefiLlama chain row has `chainId: null`.

Also left out, for the same age or liquidity reasons, and not re-checked into the registry: Zora, Monad, X Layer, MegaETH, Tempo, and Robinhood Chain. Uniswap's v2 deployments page lists some of them. Listing on that page does not clear this bar.

## What can graduate

After the deploy script has put code at the pinned router, a pump buy can graduate on:

- Ethereum, BNB Smart Chain, Polygon PoS, Arbitrum One, Base, OP Mainnet, Avalanche C-Chain
- Sepolia (Uniswap's own V2) and BNB Smart Chain testnet (PancakeSwap V2)
- Polygon Amoy, Arbitrum Sepolia, Base Sepolia, OP Sepolia, once `pnpm deploy:<network>` has deployed the pinned bytecode
- Avalanche Fuji is in the Solidity registry (Trader Joe V1) and is not in the app chain list

Until that deploy transaction is mined, Amoy and the three Sepolia L2 testnets revert the graduating buy and refund the buyer. Polygon Mumbai is shut down. Hardhat chain id 31337 has no router. Every rejected chain id above returns the zero venue and the buy refunds.
