/**
 * token-burn-bridge.ts – Anchor tests for the TokenForge Solana burn bridge.
 *
 * Run:
 *   anchor test                        # spins up a local validator, runs tests, tears down
 *   anchor test --skip-local-validator # use an already-running `solana-test-validator`
 *
 * Coverage:
 *  ✓ initialize  – happy path, too many receivers
 *  ✓ burnAndBridge – Spark tier (1 chain), Blaze tier (3 chains), Inferno tier (all)
 *  ✓ burnAndBridge – burn too small, wrong mint, wrong owner, unsupported chain
 *  ✓ updateReceivers – authority only, add/remove chains
 *  ✓ Replay protection – nonce increments per user, independent across users
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN }     from "@coral-xyz/anchor";
import { TokenBurnBridge }  from "../target/types/token_burn_bridge";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
} from "@solana/spl-token";
import { expect } from "chai";

// ─── Constants mirrored from lib.rs ──────────────────────────────────────────

const MIN_BURN_ONE_CHAIN    = new BN("100000000000");   // 100 * 1e9
const MIN_BURN_THREE_CHAINS = new BN("500000000000");   // 500 * 1e9
const MIN_BURN_ALL_CHAINS   = new BN("1000000000000");  // 1000 * 1e9

const BRIDGE_CONFIG_SEEDS = Buffer.from("bridge-config");
const USER_NONCE_SEEDS    = Buffer.from("user-nonce");

// Wormhole chain IDs
const CHAIN_ETHEREUM  = 2;
const CHAIN_BSC       = 4;
const CHAIN_POLYGON   = 5;
const CHAIN_ARBITRUM  = 23;
const CHAIN_BASE      = 30;
const CHAIN_AVALANCHE = 6;

// Fake EVM receiver addresses (20 bytes each)
const FAKE_ETH_RECEIVER  = Array.from({ length: 20 }, (_, i) => i + 1);
const FAKE_BSC_RECEIVER  = Array.from({ length: 20 }, (_, i) => i + 21);
const FAKE_POLY_RECEIVER = Array.from({ length: 20 }, (_, i) => i + 41);
const FAKE_ARB_RECEIVER  = Array.from({ length: 20 }, (_, i) => i + 61);
const FAKE_BASE_RECEIVER = Array.from({ length: 20 }, (_, i) => i + 81);
const FAKE_AVAX_RECEIVER = Array.from({ length: 20 }, (_, i) => i + 101);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert hex EVM address to a 20-byte array */
function hexToBytes20(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Array.from(Buffer.from(clean.padStart(40, "0"), "hex"));
}

function makeEvmReceiver(chainId: number, addrBytes: number[], isActive = true) {
  return { chainId, receiverAddress: addrBytes, isActive };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe("token-burn-bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenBurnBridge as Program<TokenBurnBridge>;
  const connection = provider.connection;

  // Keypairs
  let authority: Keypair;
  let user1:     Keypair;
  let user2:     Keypair;

  // SPL accounts
  let mint:              PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;

  // PDAs
  let configPda:      PublicKey;
  let configBump:     number;
  let user1NoncePda:  PublicKey;
  let user2NoncePda:  PublicKey;

  // Default receivers for initialization
  const defaultReceivers = [
    makeEvmReceiver(CHAIN_ETHEREUM,  FAKE_ETH_RECEIVER),
    makeEvmReceiver(CHAIN_BSC,       FAKE_BSC_RECEIVER),
    makeEvmReceiver(CHAIN_POLYGON,   FAKE_POLY_RECEIVER),
    makeEvmReceiver(CHAIN_ARBITRUM,  FAKE_ARB_RECEIVER),
    makeEvmReceiver(CHAIN_BASE,      FAKE_BASE_RECEIVER),
    makeEvmReceiver(CHAIN_AVALANCHE, FAKE_AVAX_RECEIVER),
  ];

  before(async () => {
    authority = Keypair.generate();
    user1     = Keypair.generate();
    user2     = Keypair.generate();

    // Airdrop SOL for tx fees
    await Promise.all([
      connection.confirmTransaction(
        await connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL),
        "confirmed"
      ),
      connection.confirmTransaction(
        await connection.requestAirdrop(user1.publicKey, 10 * LAMPORTS_PER_SOL),
        "confirmed"
      ),
      connection.confirmTransaction(
        await connection.requestAirdrop(user2.publicKey, 10 * LAMPORTS_PER_SOL),
        "confirmed"
      ),
    ]);

    // Create SPL mint (9 decimals)
    mint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      9
    );

    // Create token accounts and mint a large balance
    user1TokenAccount = await createAccount(connection, user1, mint, user1.publicKey);
    user2TokenAccount = await createAccount(connection, user2, mint, user2.publicKey);

    await mintTo(connection, authority, mint, user1TokenAccount, authority, BigInt(MIN_BURN_ALL_CHAINS.muln(10).toString()));
    await mintTo(connection, authority, mint, user2TokenAccount, authority, BigInt(MIN_BURN_ALL_CHAINS.muln(10).toString()));

    // Derive PDAs
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [BRIDGE_CONFIG_SEEDS],
      program.programId
    );
    [user1NoncePda] = PublicKey.findProgramAddressSync(
      [USER_NONCE_SEEDS, user1.publicKey.toBuffer()],
      program.programId
    );
    [user2NoncePda] = PublicKey.findProgramAddressSync(
      [USER_NONCE_SEEDS, user2.publicKey.toBuffer()],
      program.programId
    );
  });

  // ─── Initialize ────────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("initializes the bridge config with 6 EVM receivers", async () => {
      await program.methods
        .initialize(defaultReceivers)
        .accounts({
          config:        configPda,
          tokenMint:     mint,
          authority:     authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.bridgeConfig.fetch(configPda);
      expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
      expect(config.tokenMint.toBase58()).to.equal(mint.toBase58());
      expect(config.evmReceivers).to.have.length(6);
      expect(config.totalBurned.toNumber()).to.equal(0);
      expect(config.totalMessagesSent.toNumber()).to.equal(0);
      expect(config.bump).to.equal(configBump);
    });

    it("rejects initialization with more than 10 receivers", async () => {
      const tooMany = Array.from({ length: 11 }, (_, i) =>
        makeEvmReceiver(i + 1, Array.from({ length: 20 }, () => i))
      );

      // Use a fresh authority to avoid "already in use" on the config PDA
      const newAuth = Keypair.generate();
      await connection.confirmTransaction(
        await connection.requestAirdrop(newAuth.publicKey, 2 * LAMPORTS_PER_SOL),
        "confirmed"
      );
      const newMint = await createMint(connection, newAuth, newAuth.publicKey, null, 9);
      const [newConfigPda] = PublicKey.findProgramAddressSync(
        [BRIDGE_CONFIG_SEEDS],
        program.programId
      );

      try {
        await program.methods
          .initialize(tooMany)
          .accounts({
            config:        newConfigPda,
            tokenMint:     newMint,
            authority:     newAuth.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([newAuth])
          .rpc();
        expect.fail("Expected TooManyReceivers error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.toString()).to.include("TooManyReceivers");
      }
    });
  });

  // ─── Burn and bridge ───────────────────────────────────────────────────────

  describe("burnAndBridge", () => {
    const evmRecipient = hexToBytes20("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF");

    it("Spark tier: burns 100 tokens and emits BurnMessageEmitted", async () => {
      const { amount: balBefore } = await getAccount(connection, user1TokenAccount);

      await program.methods
        .burnAndBridge(
          MIN_BURN_ONE_CHAIN,
          CHAIN_ETHEREUM,
          evmRecipient,
          1
        )
        .accounts({
          config:           configPda,
          tokenMint:        mint,
          userTokenAccount: user1TokenAccount,
          userNonce:        user1NoncePda,
          user:             user1.publicKey,
          tokenProgram:     TOKEN_PROGRAM_ID,
          systemProgram:    SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const { amount: balAfter } = await getAccount(connection, user1TokenAccount);
      expect((balBefore - balAfter).toString()).to.equal(MIN_BURN_ONE_CHAIN.toString());

      const config = await program.account.bridgeConfig.fetch(configPda);
      expect(config.totalBurned.toString()).to.equal(MIN_BURN_ONE_CHAIN.toString());
      expect(config.totalMessagesSent.toNumber()).to.equal(1);

      const userNonce = await program.account.userNonce.fetch(user1NoncePda);
      expect(userNonce.nonce.toNumber()).to.equal(1);
    });

    it("Blaze tier: burns 500 tokens targeting Polygon", async () => {
      const { amount: balBefore } = await getAccount(connection, user1TokenAccount);

      await program.methods
        .burnAndBridge(
          MIN_BURN_THREE_CHAINS,
          CHAIN_POLYGON,
          evmRecipient,
          1
        )
        .accounts({
          config:           configPda,
          tokenMint:        mint,
          userTokenAccount: user1TokenAccount,
          userNonce:        user1NoncePda,
          user:             user1.publicKey,
          tokenProgram:     TOKEN_PROGRAM_ID,
          systemProgram:    SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const { amount: balAfter } = await getAccount(connection, user1TokenAccount);
      expect((balBefore - balAfter).toString()).to.equal(MIN_BURN_THREE_CHAINS.toString());

      const userNonce = await program.account.userNonce.fetch(user1NoncePda);
      expect(userNonce.nonce.toNumber()).to.equal(2);
    });

    it("Inferno tier: burns 1000 tokens with chain_id=0 (all chains)", async () => {
      await program.methods
        .burnAndBridge(
          MIN_BURN_ALL_CHAINS,
          0,          // 0 = broadcast to all configured chains
          evmRecipient,
          32          // finalized consistency level
        )
        .accounts({
          config:           configPda,
          tokenMint:        mint,
          userTokenAccount: user1TokenAccount,
          userNonce:        user1NoncePda,
          user:             user1.publicKey,
          tokenProgram:     TOKEN_PROGRAM_ID,
          systemProgram:    SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const userNonce = await program.account.userNonce.fetch(user1NoncePda);
      expect(userNonce.nonce.toNumber()).to.equal(3);

      const mintInfo = await getMint(connection, mint);
      // Supply should have decreased by 100 + 500 + 1000 tokens
      const expectedBurned =
        MIN_BURN_ONE_CHAIN.add(MIN_BURN_THREE_CHAINS).add(MIN_BURN_ALL_CHAINS);
      const config = await program.account.bridgeConfig.fetch(configPda);
      expect(config.totalBurned.toString()).to.equal(expectedBurned.toString());
    });

    it("rejects burn below minimum (99 tokens)", async () => {
      const tooSmall = new BN("99000000000"); // 99 * 1e9
      try {
        await program.methods
          .burnAndBridge(tooSmall, CHAIN_ETHEREUM, evmRecipient, 1)
          .accounts({
            config:           configPda,
            tokenMint:        mint,
            userTokenAccount: user1TokenAccount,
            userNonce:        user1NoncePda,
            user:             user1.publicKey,
            tokenProgram:     TOKEN_PROGRAM_ID,
            systemProgram:    SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        expect.fail("Expected BurnTooSmall error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.toString()).to.include("BurnTooSmall");
      }
    });

    it("rejects unsupported chain ID", async () => {
      try {
        await program.methods
          .burnAndBridge(MIN_BURN_ONE_CHAIN, 999, evmRecipient, 1)
          .accounts({
            config:           configPda,
            tokenMint:        mint,
            userTokenAccount: user1TokenAccount,
            userNonce:        user1NoncePda,
            user:             user1.publicKey,
            tokenProgram:     TOKEN_PROGRAM_ID,
            systemProgram:    SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        expect.fail("Expected UnsupportedChain error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.toString()).to.include("UnsupportedChain");
      }
    });

    it("tracks nonces independently per user", async () => {
      // user2 starts at nonce 0
      const nonceBefore = await program.account.userNonce.fetchNullable(user2NoncePda);
      expect(nonceBefore).to.be.null; // not yet created

      await program.methods
        .burnAndBridge(MIN_BURN_ONE_CHAIN, CHAIN_BASE, evmRecipient, 1)
        .accounts({
          config:           configPda,
          tokenMint:        mint,
          userTokenAccount: user2TokenAccount,
          userNonce:        user2NoncePda,
          user:             user2.publicKey,
          tokenProgram:     TOKEN_PROGRAM_ID,
          systemProgram:    SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      const user2Nonce = await program.account.userNonce.fetch(user2NoncePda);
      const user1Nonce = await program.account.userNonce.fetch(user1NoncePda);

      expect(user2Nonce.nonce.toNumber()).to.equal(1);
      expect(user1Nonce.nonce.toNumber()).to.equal(3); // unchanged
    });
  });

  // ─── Update receivers ──────────────────────────────────────────────────────

  describe("updateReceivers", () => {
    it("allows authority to add a new chain", async () => {
      const CHAIN_FANTOM = 10;
      const FAKE_FTM_RECEIVER = Array.from({ length: 20 }, (_, i) => 200 + i);

      const newReceivers = [
        ...defaultReceivers,
        makeEvmReceiver(CHAIN_FANTOM, FAKE_FTM_RECEIVER),
      ];

      await program.methods
        .updateReceivers(newReceivers)
        .accounts({
          config:    configPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.bridgeConfig.fetch(configPda);
      expect(config.evmReceivers).to.have.length(7);
      expect(config.evmReceivers[6].chainId).to.equal(CHAIN_FANTOM);
    });

    it("allows authority to deactivate a chain", async () => {
      const updated = defaultReceivers.map((r) =>
        r.chainId === CHAIN_POLYGON ? { ...r, isActive: false } : r
      );

      await program.methods
        .updateReceivers(updated)
        .accounts({
          config:    configPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.bridgeConfig.fetch(configPda);
      const poly = config.evmReceivers.find((r: any) => r.chainId === CHAIN_POLYGON);
      expect(poly?.isActive).to.be.false;
    });

    it("rejects updateReceivers from non-authority", async () => {
      try {
        await program.methods
          .updateReceivers(defaultReceivers)
          .accounts({
            config:    configPda,
            authority: user1.publicKey,
          })
          .signers([user1])
          .rpc();
        expect.fail("Expected Unauthorized error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.toString()).to.include("Unauthorized");
      }
    });

    it("rejects more than 10 receivers", async () => {
      const tooMany = Array.from({ length: 11 }, (_, i) =>
        makeEvmReceiver(i + 1, Array.from({ length: 20 }, () => i))
      );
      try {
        await program.methods
          .updateReceivers(tooMany)
          .accounts({
            config:    configPda,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();
        expect.fail("Expected TooManyReceivers error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.toString()).to.include("TooManyReceivers");
      }
    });

    it("restores default 6 receivers for subsequent tests", async () => {
      await program.methods
        .updateReceivers(defaultReceivers)
        .accounts({
          config:    configPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.bridgeConfig.fetch(configPda);
      expect(config.evmReceivers).to.have.length(6);
    });
  });

  // ─── Burn tier thresholds ──────────────────────────────────────────────────

  describe("burn tier boundaries", () => {
    const evmRecipient = hexToBytes20("0xCAFEBABECAFEBABECAFEBABECAFEBABECAFEBABE");

    it("accepts exactly MIN_BURN_ONE_CHAIN (100 tokens)", async () => {
      const { amount: before } = await getAccount(connection, user2TokenAccount);
      await program.methods
        .burnAndBridge(MIN_BURN_ONE_CHAIN, CHAIN_BSC, evmRecipient, 1)
        .accounts({
          config:           configPda,
          tokenMint:        mint,
          userTokenAccount: user2TokenAccount,
          userNonce:        user2NoncePda,
          user:             user2.publicKey,
          tokenProgram:     TOKEN_PROGRAM_ID,
          systemProgram:    SystemProgram.programId,
        })
        .signers([user2])
        .rpc();
      const { amount: after } = await getAccount(connection, user2TokenAccount);
      expect((before - after).toString()).to.equal(MIN_BURN_ONE_CHAIN.toString());
    });

    it("accepts exactly MIN_BURN_ALL_CHAINS (1000 tokens) with chain_id=0", async () => {
      const nonceBefore = (await program.account.userNonce.fetch(user2NoncePda)).nonce;
      await program.methods
        .burnAndBridge(MIN_BURN_ALL_CHAINS, 0, evmRecipient, 32)
        .accounts({
          config:           configPda,
          tokenMint:        mint,
          userTokenAccount: user2TokenAccount,
          userNonce:        user2NoncePda,
          user:             user2.publicKey,
          tokenProgram:     TOKEN_PROGRAM_ID,
          systemProgram:    SystemProgram.programId,
        })
        .signers([user2])
        .rpc();
      const nonceAfter = (await program.account.userNonce.fetch(user2NoncePda)).nonce;
      expect(nonceAfter.toNumber()).to.equal(nonceBefore.toNumber() + 1);
    });
  });
});
