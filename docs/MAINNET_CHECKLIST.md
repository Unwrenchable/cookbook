# Mainnet deploy checklist

`pnpm deploy:mainnet` and the other `deploy:*` mainnet scripts refuse to broadcast until every line below is done. The script checks the flags. The rest is on you. Nothing in this repo broadcasts by itself.

Run from `contracts/evm` after `pnpm install` and `pnpm compile`.

## Before the command

- [ ] Program id rotated. Do not deploy `2sAka7jCkP71LbKk1MpELxFpjSHjScQk1aStrDt4Pnnf`. `SOLANA_EMITTER` is the new program's `["emitter"]` PDA as a 32-byte hex string, not the program id. Wormhole `post_message` writes that PDA into the VAA. From the repo root, `pnpm emitter <programIdBase58>` or `pnpm emitter -- --keypair <path>` prints the public id and `SOLANA_EMITTER` and never prints a secret key. The script rejects the zero hash, the leaked program id (`0x1bb5c0ccb7371c3e2901ba69bec61460bce93dd8c97da9bf72aa419e1de26dac`), and that program's emitter PDA.
- [ ] `FEE_RECIPIENT` is the treasury multisig. It must be nonzero and it must not be the deployer address. Testnets may omit it and then the deployer receives fees. Mainnet may not.
- [ ] `LAUNCH_FEE` is the flat minimum in ether, default `0.001`. The factory cap is 1 ether. The constructor also sets a 24-hour admin delay. There is no setter that skips it.
- [ ] `PRIVATE_KEY` is a funded deployer, in `contracts/evm/.env`, and that file is not committed.
- [ ] RPC is the network you mean. Optional overrides: `MAINNET_RPC_URL`, `BSC_RPC_URL`, `POLYGON_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `AVALANCHE_RPC_URL`, `OPTIMISM_RPC_URL`. Empty uses the public fallback in `hardhat.config.ts`.
- [ ] Wormhole emitter allowlist. The receiver records `SOLANA_EMITTER` (the emitter PDA) on Wormhole chain id 1 (Solana) at construction. Further emitters go through the 24-hour queue. Cores and Wormhole chain ids are in `scripts/networkCatalog.ts` (Ethereum 2, BSC 4, Polygon 5, Avalanche 6, Arbitrum 23, Optimism 24, Base 30). Confirm the core address on [Wormhole's contract list](https://wormhole.com/docs/products/reference/contract-addresses/) before you broadcast.
- [ ] You have read `docs/CHAIN_SUPPORT.md`. These commands do not add a chain. They deploy onto a chain already in the registry.
- [ ] Gas token is in the deployer (ETH, BNB, POL, or AVAX). A full deploy is nine implementations, the token factory, the LP locker, the bridged token, and the receiver.

## Command

Both variables must match. `CONFIRM_NETWORK` is the Hardhat network name.

```bash
cd contracts/evm
CONFIRM_MAINNET=yes-deploy-mainnet CONFIRM_NETWORK=base \
  FEE_RECIPIENT=0xYourMultisig \
  SOLANA_EMITTER=0xYourEmitterPda \
  pnpm deploy:base
```

The same shape works for `mainnet`, `bsc`, `polygon`, `arbitrum`, `avalanche`, and `optimism`.

Add `VERIFY=1` to submit our contracts to the explorer after deploy. That flag does not verify the Uniswap bytecode, because we do not deploy that bytecode on mainnet.

## After the command

The script writes `contracts/evm/deployments/<network>.json` and `deployments/<network>.env`. Those files are gitignored. Paste the three lines into `frontend/.env.local` and into the host's env:

- `NEXT_PUBLIC_FACTORY_*`
- `NEXT_PUBLIC_LOCKER_*`
- `NEXT_PUBLIC_RECEIVER_*`

`setMinter` on `BridgeMintableToken` is called in the same script, to the new receiver. The factory owner is the deployer. Transfer ownership to the multisig only after you have queued any intended admin changes, because the delay starts from the current owner.

## Testnet command

Testnets do not use the confirm flags. They still reject a leaked program id, that program's emitter PDA, or a zero `SOLANA_EMITTER`.

```bash
cd contracts/evm
SOLANA_EMITTER=0xYourEmitterPda pnpm deploy:polygonAmoy
```

Networks: `sepolia`, `bscTestnet`, `polygonAmoy`, `arbitrumSepolia`, `baseSepolia`, `optimismSepolia`. Amoy and the three L2 Sepolia networks deploy the pinned V2 bytecode first. See `docs/TESTNET_DEX.md`.

`pnpm deploy:polygonMumbai` throws. Mumbai is shut down.

## What this script will not do

It will not deploy from Hardhat's chain id 31337. A local proof is `pnpm dry-run:forks`, which forks each catalog RPC on 127.0.0.1 and refuses any other host.
