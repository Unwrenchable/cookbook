# Testnet Uniswap V2 pin

Polygon Amoy (80002), Arbitrum Sepolia (421614), Base Sepolia (84532), and OP Sepolia (11155420) have no publisher V2 router that passes `factory()` and `WETH()`. Graduation on those four chain ids uses a CREATE2 deployment of Uniswap's published bytecode. No other chain id returns these addresses.

## Why the npm artifact

`UniswapV2Library.pairFor` bakes in the init-code hash

`0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f`

That is `keccak256` of the pair creation bytecode shipped in `@uniswap/v2-core` 1.0.1 (`build/UniswapV2Pair.json`). Recompiling the same sources with Hardhat changes the metadata and the hash, so `addLiquidityETH` would send the tokens to an empty address. The deploy script and the Hardhat test both read the npm build JSON. They do not compile `solc` 0.5.16.

Packages, as devDependencies of `@tokenforge/contracts-evm`:

- `@uniswap/v2-core` 1.0.1
- `@uniswap/v2-periphery` 1.1.0-beta.0 (`build/UniswapV2Router02.json`)
- `@uniswap/lib` 4.0.1-alpha (the router's dependency; already linked in the published bytecode)

The factory constructor argument is `feeToSetter = address(0)`, so the factory address is the same on every chain and nobody can turn on a protocol fee. The router constructor is `(factory, wrappedNative)`, so the router address changes with the wrapped native.

## Deployer and salts

Arachnid deterministic deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C`. Its 69-byte runtime is already on these four testnets. Calldata is `salt ++ initCode`.

- Factory salt: `keccak256("goonforge.testnet.uniswap-v2.factory.v1")`
- Router salt: `keccak256("goonforge.testnet.uniswap-v2.router.v1")`

| Chain | Router | Wrapped native |
|---|---|---|
| All four | factory `0x8Fa06e2B5726Fbf82cf2559F661f52FD2B78A1f6` | |
| Polygon Amoy | `0x3523EDd2bae2120CDa175358EeE3Ab5F592015De` | WPOL `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` |
| Arbitrum Sepolia | `0x24f058F5222e6b1b2845466C24372185EAb038e1` | WETH `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` |
| Base Sepolia and OP Sepolia | `0x532dE1440A5996CF8ed38e517d9f5e3c77c8b7D9` | WETH `0x4200000000000000000000000000000000000006` |

Base Sepolia and OP Sepolia share the OP-stack WETH predeploy, so they share the router address. Amoy uses the WPOL that accepts `deposit()` (`name` "Wrapped Polygon Ecosystem Token"). The older docs address `0x41Dc3C8eB8368bd9139Cec50434a0C294c8c1102` reverts on `deposit()` and is not used.

`scripts/deploy.ts` deploys the factory and the router before the token factory when the catalog row has `testnetDex: true`. If the code is already there, it does not deploy again. Until that code exists, `CanonicalDex.assertLive` reverts with `CanonicalDex: router has no code` and the graduating buy refunds.

Explorer verification of this bytecode will not match a Hardhat recompile. `VERIFY=1` verifies our contracts only. A "similar match" to Uniswap's verified V2 sources is the expected explorer result for the factory and the router.

`pnpm dry-run:forks` does not broadcast. Amoy, Arbitrum Sepolia, Base Sepolia, and OP Sepolia are proven on a local chain at that chain id, with the live wrapped-native bytecode loaded and the pinned router deployed through the Arachnid deployer. A fork of those RPCs can answer `eth_getCode` from upstream and hide a contract the local node just created.
