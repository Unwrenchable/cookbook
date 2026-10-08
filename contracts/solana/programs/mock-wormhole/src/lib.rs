//! Test double for Wormhole core `post_message` (instruction byte 1).
//! Loaded at the devnet core address by the local validator. It does not
//! check guardian sets. Production builds of token-burn-bridge still refuse
//! every program id except the official mainnet and devnet cores.

use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

fn process_instruction(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.first() == Some(&1) {
        Ok(())
    } else {
        Err(ProgramError::InvalidInstructionData)
    }
}
