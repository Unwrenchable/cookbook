//! # TokenForge – Token Burn Bridge (Solana Side)
//!
//! This Anchor program is the Solana half of the cross-chain burn-to-activate mechanic:
//!
//! 1. User holds SPL tokens on Solana.
//! 2. Wallets call `burn_and_post` with a target EVM chain and recipient.
//! 3. The program burns the SPL tokens and CPIs Wormhole core `post_message`.
//!    There is no event-only burn. A call that does not post a VAA does not burn.
//! 4. Wormhole guardians sign the VAA (Verified Action Approval).
//! 5. The VAA is submitted to `BurnBridgeReceiver.sol` on the target EVM chain.
//! 6. The EVM contract mints the corresponding ERC20 tokens to the recipient.
//!
//! ## Burn tiers (activate more chains for bigger burns)
//!
//! | Burn Amount | Chains Activated |
//! |------------|-----------------|
//! | ≥ 100 tokens | 1 EVM chain |
//! | ≥ 500 tokens | 3 EVM chains |
//! | ≥ 1 000 tokens | All configured chains |
//!
//! ## Notes
//! - Wormhole integration uses the `post_message` CPI pattern (same as FIZZ CAPS Wormhole bridge).
//! - This program does NOT include Wormhole dependencies at compile time to keep the
//!   program ID / IDL stable during development. The Wormhole CPI is called via raw
//!   `invoke_signed` with the Wormhole program ID as a known constant.
//! - For production, pin to the audited Wormhole Anchor CPI crate.

#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

/// Wormhole core bridge program ids. The CPI refuses any other program.
pub const WORMHOLE_CORE_MAINNET: Pubkey = pubkey!("worm2ZoG2kUd4vFXhvJh93UUH596ayRfgQ2MgjNMTth");
pub const WORMHOLE_CORE_DEVNET: Pubkey = pubkey!("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5");

/// Program ID placeholder — replace with the output of `anchor build` / `solana-keygen new`.
/// Run: `solana-keygen new --outfile target/deploy/token_burn_bridge-keypair.json`
/// then: `anchor build` and copy the program ID from the output.
declare_id!("2sAka7jCkP71LbKk1MpELxFpjSHjScQk1aStrDt4Pnnf");

// ─── Constants ────────────────────────────────────────────────────────────────

/// Seed for the bridge config PDA
const BRIDGE_CONFIG_SEEDS: &[u8] = b"bridge-config";

/// Seed for per-user nonce tracking (replay prevention)
const USER_NONCE_SEEDS: &[u8] = b"user-nonce";

/// Minimum burn to activate one EVM chain (in raw token units with 9 decimals)
pub const MIN_BURN_ONE_CHAIN:   u64 = 100  * 1_000_000_000;
/// Minimum burn to activate three EVM chains
pub const MIN_BURN_THREE_CHAINS: u64 = 500  * 1_000_000_000;
/// Minimum burn to activate all configured chains
pub const MIN_BURN_ALL_CHAINS:  u64 = 1_000 * 1_000_000_000;

// ─── Supported EVM chains (Wormhole chain IDs) ────────────────────────────────

pub const WORMHOLE_CHAIN_ETHEREUM:  u16 = 2;
pub const WORMHOLE_CHAIN_BSC:       u16 = 4;
pub const WORMHOLE_CHAIN_POLYGON:   u16 = 5;
pub const WORMHOLE_CHAIN_ARBITRUM:  u16 = 23;
pub const WORMHOLE_CHAIN_BASE:      u16 = 30;
pub const WORMHOLE_CHAIN_AVALANCHE: u16 = 6;

// ─── Program ──────────────────────────────────────────────────────────────────

#[program]
pub mod token_burn_bridge {
    use super::*;

    // ─── Initialize bridge config ─────────────────────────────────────────────

    /// Called once by the deployer to configure the bridge.
    pub fn initialize(
        ctx: Context<Initialize>,
        evm_receiver_addresses: Vec<EvmChainReceiver>,
    ) -> Result<()> {
        require!(
            evm_receiver_addresses.len() <= 10,
            BridgeError::TooManyReceivers
        );
        let config = &mut ctx.accounts.config;
        config.authority             = ctx.accounts.authority.key();
        config.token_mint            = ctx.accounts.token_mint.key();
        config.evm_receivers         = evm_receiver_addresses;
        config.total_burned          = 0;
        config.total_messages_sent   = 0;
        config.bump                  = ctx.bumps.config;

        msg!("TokenForge BurnBridge initialized. Mint: {}", config.token_mint);
        Ok(())
    }

    // ─── Burn and post ────────────────────────────────────────────────────────
    // `burn_and_bridge` was removed. It burned tokens and only emitted an event,
    // so a user could lose tokens with nothing to claim on EVM. The old
    // discriminator is not an instruction in this program.

    /// Burns SPL tokens and posts the 114-byte payload to Wormhole core `post_message`.
    /// The emitter is this program's `["emitter"]` PDA.
    ///
    /// `amount`            – raw token units to burn (includes decimals)
    /// `target_chain_id`   – Wormhole chain ID of the target EVM chain (0 = all)
    /// `evm_recipient`     – 20-byte EVM address of the token recipient
    /// `consistency_level` – below 32 posts Confirmed; 32 or above posts Finalized
    pub fn burn_and_post(
        ctx: Context<BurnAndPost>,
        amount: u64,
        target_chain_id: u16,
        evm_recipient: [u8; 20],
        consistency_level: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.user_token_account.amount >= amount,
            BridgeError::InsufficientBalance
        );
        require!(evm_recipient != [0u8; 20], BridgeError::ZeroRecipient);

        let wormhole_id = ctx.accounts.wormhole_program.key();
        require!(
            wormhole_id == WORMHOLE_CORE_MAINNET || wormhole_id == WORMHOLE_CORE_DEVNET,
            BridgeError::BadWormholeProgram
        );

        let (emitter, emitter_bump) = Pubkey::find_program_address(&[b"emitter"], ctx.program_id);
        require!(ctx.accounts.wormhole_emitter.key() == emitter, BridgeError::BadEmitter);

        let (bridge, _) = Pubkey::find_program_address(&[b"Bridge"], &wormhole_id);
        let (fee_collector, _) = Pubkey::find_program_address(&[b"fee_collector"], &wormhole_id);
        let (sequence, _) =
            Pubkey::find_program_address(&[b"Sequence", emitter.as_ref()], &wormhole_id);
        require!(ctx.accounts.wormhole_bridge.key() == bridge, BridgeError::BadWormholeAccount);
        require!(
            ctx.accounts.wormhole_fee_collector.key() == fee_collector,
            BridgeError::BadWormholeAccount
        );
        require!(ctx.accounts.wormhole_sequence.key() == sequence, BridgeError::BadWormholeAccount);
        require!(
            ctx.accounts.clock.key() == anchor_lang::solana_program::sysvar::clock::ID,
            BridgeError::BadWormholeAccount
        );
        require!(
            ctx.accounts.rent.key() == anchor_lang::solana_program::sysvar::rent::ID,
            BridgeError::BadWormholeAccount
        );

        let config = &ctx.accounts.config;
        if target_chain_id == 0 {
            require!(amount >= MIN_BURN_ALL_CHAINS, BridgeError::BurnTooSmall);
            require!(
                config.evm_receivers.iter().any(|r| r.is_active),
                BridgeError::UnsupportedChain
            );
        } else {
            require!(amount >= MIN_BURN_ONE_CHAIN, BridgeError::BurnTooSmall);
            require!(
                config
                    .evm_receivers
                    .iter()
                    .any(|r| r.chain_id == target_chain_id && r.is_active),
                BridgeError::UnsupportedChain
            );
        }

        let user_nonce = &mut ctx.accounts.user_nonce;
        let nonce = user_nonce.nonce;
        user_nonce.nonce += 1;

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let mut payload: Vec<u8> = Vec::with_capacity(114);
        payload.extend_from_slice(&ctx.accounts.token_mint.key().to_bytes());
        payload.extend_from_slice(&ctx.accounts.user.key().to_bytes());
        payload.extend_from_slice(&evm_recipient);
        payload.extend_from_slice(&[0u8; 12]);
        payload.extend_from_slice(&amount.to_be_bytes());
        payload.extend_from_slice(&target_chain_id.to_be_bytes());
        payload.extend_from_slice(&nonce.to_be_bytes());
        require!(payload.len() == 114, BridgeError::BadPayload);

        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: wormhole_id,
            accounts: vec![
                AccountMeta::new(ctx.accounts.wormhole_bridge.key(), false),
                AccountMeta::new(ctx.accounts.wormhole_message.key(), true),
                AccountMeta::new_readonly(emitter, true),
                AccountMeta::new(ctx.accounts.wormhole_sequence.key(), false),
                AccountMeta::new(ctx.accounts.user.key(), true),
                AccountMeta::new(ctx.accounts.wormhole_fee_collector.key(), false),
                AccountMeta::new_readonly(ctx.accounts.clock.key(), false),
                AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            ],
            data: wormhole_post_message_data(nonce as u32, &payload, consistency_level),
        };
        let bump_seed = [emitter_bump];
        let signer_seeds: &[&[u8]] = &[b"emitter", &bump_seed];
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.wormhole_bridge.to_account_info(),
                ctx.accounts.wormhole_message.to_account_info(),
                ctx.accounts.wormhole_emitter.to_account_info(),
                ctx.accounts.wormhole_sequence.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.wormhole_fee_collector.to_account_info(),
                ctx.accounts.clock.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;

        emit!(BurnMessageEmitted {
            sequence: nonce,
            solana_mint: ctx.accounts.token_mint.key(),
            solana_sender: ctx.accounts.user.key(),
            evm_recipient,
            amount_burned: amount,
            target_chain_id,
            payload_hash: anchor_lang::solana_program::keccak::hash(&payload).0,
            consistency_level,
        });

        let config = &mut ctx.accounts.config;
        config.total_burned = config.total_burned.saturating_add(amount);
        config.total_messages_sent = config.total_messages_sent.saturating_add(1);
        Ok(())
    }

    // ─── Admin: update EVM receivers ─────────────────────────────────────────

    /// Update the list of EVM chain receivers (only authority).
    pub fn update_receivers(
        ctx: Context<UpdateReceivers>,
        evm_receivers: Vec<EvmChainReceiver>,
    ) -> Result<()> {
        require!(evm_receivers.len() <= 10, BridgeError::TooManyReceivers);
        ctx.accounts.config.evm_receivers = evm_receivers;
        msg!("EVM receivers updated");
        Ok(())
    }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer  = authority,
        space  = BridgeConfig::LEN,
        seeds  = [BRIDGE_CONFIG_SEEDS],
        bump
    )]
    pub config: Account<'info, BridgeConfig>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnAndPost<'info> {
    #[account(mut, seeds = [BRIDGE_CONFIG_SEEDS], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,
    #[account(mut, constraint = token_mint.key() == config.token_mint @ BridgeError::WrongMint)]
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ BridgeError::WrongOwner,
        constraint = user_token_account.mint == token_mint.key() @ BridgeError::WrongMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = UserNonce::LEN,
        seeds = [USER_NONCE_SEEDS, user.key().as_ref()],
        bump
    )]
    pub user_nonce: Account<'info, UserNonce>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    /// CHECK: must be Wormhole core mainnet or devnet.
    pub wormhole_program: UncheckedAccount<'info>,
    /// CHECK: Wormhole ["Bridge"] PDA.
    #[account(mut)]
    pub wormhole_bridge: UncheckedAccount<'info>,
    #[account(mut)]
    pub wormhole_message: Signer<'info>,
    /// CHECK: ["emitter"] PDA of this program.
    pub wormhole_emitter: UncheckedAccount<'info>,
    /// CHECK: Wormhole ["Sequence", emitter] PDA.
    #[account(mut)]
    pub wormhole_sequence: UncheckedAccount<'info>,
    /// CHECK: Wormhole ["fee_collector"] PDA.
    #[account(mut)]
    pub wormhole_fee_collector: UncheckedAccount<'info>,
    /// CHECK: Clock sysvar.
    pub clock: UncheckedAccount<'info>,
    /// CHECK: Rent sysvar.
    pub rent: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct UpdateReceivers<'info> {
    #[account(
        mut,
        seeds  = [BRIDGE_CONFIG_SEEDS],
        bump   = config.bump,
        constraint = config.authority == authority.key() @ BridgeError::Unauthorized
    )]
    pub config: Account<'info, BridgeConfig>,

    pub authority: Signer<'info>,
}

// ─── State ────────────────────────────────────────────────────────────────────

#[account]
pub struct BridgeConfig {
    pub authority:           Pubkey,              // 32
    pub token_mint:          Pubkey,              // 32
    pub evm_receivers:       Vec<EvmChainReceiver>, // 4 + 10*23 = 234
    pub total_burned:        u64,                 // 8
    pub total_messages_sent: u64,                 // 8
    pub bump:                u8,                  // 1
}

impl BridgeConfig {
    // 8 (discriminator) + 32 + 32 + 4 + (10 * 23) + 8 + 8 + 1
    // EvmChainReceiver: 2 (chain_id u16) + 20 (receiver_address [u8;20]) + 1 (is_active bool) = 23
    pub const LEN: usize = 8 + 32 + 32 + 4 + (10 * 23) + 8 + 8 + 1;
}

/// Per-user nonce counter for Wormhole replay protection
#[account]
pub struct UserNonce {
    pub nonce: u64, // 8
}

impl UserNonce {
    pub const LEN: usize = 8 + 8;
}

/// Maps a Wormhole chain ID to the deployed BurnBridgeReceiver address on that chain
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EvmChainReceiver {
    pub chain_id:         u16,     // Wormhole chain ID
    pub receiver_address: [u8; 20], // EVM address (20 bytes)
    pub is_active:        bool,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct BurnMessageEmitted {
    pub sequence:          u64,
    pub solana_mint:       Pubkey,
    pub solana_sender:     Pubkey,
    pub evm_recipient:     [u8; 20],
    pub amount_burned:     u64,
    pub target_chain_id:   u16,
    pub payload_hash:      [u8; 32],
    pub consistency_level: u8,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum BridgeError {
    #[msg("Burn amount too small. Minimum is 100 tokens to activate 1 chain.")]
    BurnTooSmall,
    #[msg("Insufficient token balance.")]
    InsufficientBalance,
    #[msg("Target chain not supported. Add it via update_receivers.")]
    UnsupportedChain,
    #[msg("Token mint does not match bridge config.")]
    WrongMint,
    #[msg("Token account owner does not match signer.")]
    WrongOwner,
    #[msg("Unauthorized: only the bridge authority can call this.")]
    Unauthorized,
    #[msg("Too many EVM receivers. Maximum is 10.")]
    TooManyReceivers,
    #[msg("EVM recipient is the zero address.")]
    ZeroRecipient,
    #[msg("Wormhole program id is not mainnet or devnet core.")]
    BadWormholeProgram,
    #[msg("Emitter account is not this program's emitter PDA.")]
    BadEmitter,
    #[msg("Wormhole account address does not match the expected PDA.")]
    BadWormholeAccount,
    #[msg("Bridge payload must be exactly 114 bytes.")]
    BadPayload,
}

/// Borsh layout of Wormhole `PostMessage`: instruction byte 1, then nonce, payload, consistency enum.
/// Consistency enum is 0 for confirmed and 1 for finalized. The VAA later stores 1 or 32.
fn wormhole_post_message_data(nonce: u32, payload: &[u8], consistency_level: u8) -> Vec<u8> {
    let level: u8 = if consistency_level >= 32 { 1 } else { 0 };
    let mut data = Vec::with_capacity(1 + 4 + 4 + payload.len() + 1);
    data.push(1u8);
    data.extend_from_slice(&nonce.to_le_bytes());
    data.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    data.extend_from_slice(payload);
    data.push(level);
    data
}
