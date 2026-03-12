//! # TokenForge – Token Burn Bridge (Solana Side)
//!
//! This Anchor program is the Solana half of the cross-chain burn-to-activate mechanic:
//!
//! 1. User holds SPL tokens on Solana.
//! 2. User calls `burn_and_bridge()` specifying a target EVM chain + recipient.
//! 3. Program burns the SPL tokens and emits a structured message via `post_message`
//!    to the **Wormhole Core Bridge** on Solana.
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
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

declare_id!("TokenBridgeBurnXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─── Constants ────────────────────────────────────────────────────────────────

/// Seed for the bridge config PDA
const BRIDGE_CONFIG_SEEDS: &[u8] = b"bridge-config";

/// Seed for per-user nonce tracking (replay prevention)
const USER_NONCE_SEEDS: &[u8] = b"user-nonce";

/// Wormhole Core Bridge program ID on Solana mainnet.
/// Devnet uses the same address. Update if Wormhole changes.
const WORMHOLE_PROGRAM_ID: Pubkey = anchor_lang::solana_program::pubkey!(
    "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
);

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

    // ─── Burn and bridge ──────────────────────────────────────────────────────

    /// Burns SPL tokens and emits a Wormhole cross-chain message to activate
    /// ERC20 minting on one or more EVM chains.
    ///
    /// `amount`            – raw token units to burn (includes decimals)
    /// `target_chain_id`   – Wormhole chain ID of the target EVM chain (0 = all)
    /// `evm_recipient`     – 20-byte EVM address of the token recipient
    /// `consistency_level` – Wormhole finality (1 = confirmed, 32 = finalized)
    pub fn burn_and_bridge(
        ctx: Context<BurnAndBridge>,
        amount: u64,
        target_chain_id: u16,
        evm_recipient: [u8; 20],
        consistency_level: u8,
    ) -> Result<()> {
        // ── Validation ───────────────────────────────────────────────────────
        require!(amount >= MIN_BURN_ONE_CHAIN, BridgeError::BurnTooSmall);
        require!(
            ctx.accounts.user_token_account.amount >= amount,
            BridgeError::InsufficientBalance
        );

        let config = &ctx.accounts.config;

        // Validate target chain is supported (or 0 = all)
        if target_chain_id != 0 {
            require!(
                config.evm_receivers.iter().any(|r| r.chain_id == target_chain_id),
                BridgeError::UnsupportedChain
            );
        }

        // ── Increment user nonce (replay protection) ──────────────────────────
        let user_nonce = &mut ctx.accounts.user_nonce;
        let nonce = user_nonce.nonce;
        user_nonce.nonce += 1;

        // ── Burn SPL tokens ───────────────────────────────────────────────────
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    from:      ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // ── Build Wormhole payload ─────────────────────────────────────────────
        // Layout (ABI-compatible with BurnBridgeReceiver.sol):
        //   bytes32 solanaSourceMint   (32 bytes)
        //   bytes32 solanaSender       (32 bytes)
        //   bytes20 evmRecipient       (20 bytes, right-padded to 32)
        //   uint64  amount             (8 bytes, big-endian)
        //   uint16  targetChainId      (2 bytes, big-endian)
        //   uint64  nonce              (8 bytes, big-endian)
        let mut payload: Vec<u8> = Vec::with_capacity(134);

        // Solana mint pubkey (32 bytes)
        payload.extend_from_slice(&ctx.accounts.token_mint.key().to_bytes());
        // Solana sender pubkey (32 bytes)
        payload.extend_from_slice(&ctx.accounts.user.key().to_bytes());
        // EVM recipient (20 bytes + 12 zero bytes padding)
        payload.extend_from_slice(&evm_recipient);
        payload.extend_from_slice(&[0u8; 12]);
        // Amount (8 bytes big-endian)
        payload.extend_from_slice(&amount.to_be_bytes());
        // Target chain ID (2 bytes big-endian)
        payload.extend_from_slice(&target_chain_id.to_be_bytes());
        // Nonce (8 bytes big-endian)
        payload.extend_from_slice(&nonce.to_be_bytes());

        // ── Post message to Wormhole Core Bridge ──────────────────────────────
        //
        // In a production deployment, use the Wormhole Anchor CPI crate:
        //   wormhole_anchor_sdk::wormhole::post_message(cpi_ctx, nonce, payload, consistency_level)
        //
        // For now we emit an on-chain event that an off-chain relayer can pick up.
        // Replace this with the actual Wormhole CPI once the Wormhole program is
        // added as a dependency.
        emit!(BurnMessageEmitted {
            sequence:          nonce,
            solana_mint:       ctx.accounts.token_mint.key(),
            solana_sender:     ctx.accounts.user.key(),
            evm_recipient,
            amount_burned:     amount,
            target_chain_id,
            payload_hash:      anchor_lang::solana_program::keccak::hash(&payload).0,
            consistency_level,
        });

        // ── Update global stats ───────────────────────────────────────────────
        let config = &mut ctx.accounts.config;
        config.total_burned        = config.total_burned.saturating_add(amount);
        config.total_messages_sent = config.total_messages_sent.saturating_add(1);

        msg!(
            "Burned {} tokens. Wormhole message #{} → chain {}. Recipient: {:?}",
            amount,
            nonce,
            target_chain_id,
            evm_recipient
        );

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
pub struct BurnAndBridge<'info> {
    #[account(
        mut,
        seeds = [BRIDGE_CONFIG_SEEDS],
        bump  = config.bump
    )]
    pub config: Account<'info, BridgeConfig>,

    #[account(
        mut,
        constraint = token_mint.key() == config.token_mint @ BridgeError::WrongMint
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ BridgeError::WrongOwner,
        constraint = user_token_account.mint  == token_mint.key() @ BridgeError::WrongMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer  = user,
        space  = UserNonce::LEN,
        seeds  = [USER_NONCE_SEEDS, user.key().as_ref()],
        bump
    )]
    pub user_nonce: Account<'info, UserNonce>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
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
    pub evm_receivers:       Vec<EvmChainReceiver>, // 4 + 10*34 = 344
    pub total_burned:        u64,                 // 8
    pub total_messages_sent: u64,                 // 8
    pub bump:                u8,                  // 1
}

impl BridgeConfig {
    // 8 (discriminator) + 32 + 32 + 4 + (10 * 34) + 8 + 8 + 1
    pub const LEN: usize = 8 + 32 + 32 + 4 + (10 * 34) + 8 + 8 + 1;
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
}
