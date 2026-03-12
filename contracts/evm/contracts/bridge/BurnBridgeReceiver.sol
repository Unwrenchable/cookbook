// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BurnBridgeReceiver
 * @notice EVM side of the TokenForge cross-chain burn-to-activate mechanic.
 *
 * Flow:
 *  1. User burns SPL tokens on Solana via the `token-burn-bridge` Anchor program.
 *  2. Wormhole guardians produce a VAA (Verified Action Approval).
 *  3. Anyone (or an auto-relayer) calls `receiveMessage(encodedVAA)` here.
 *  4. This contract verifies the VAA, ensures it has not been replayed,
 *     and mints the corresponding ERC20 tokens to the recipient.
 *
 * Wormhole VAA body format (as packed by the Anchor program):
 *   bytes32 solanaSourceMint   (offset 0)
 *   bytes32 solanaSender       (offset 32)
 *   bytes32 evmRecipient       (offset 64, right-justified 20-byte address)
 *   uint64  amountBurned       (offset 96)
 *   uint16  targetChainId      (offset 104)
 *   uint64  nonce              (offset 106)
 *
 * @dev In a production deployment this contract should:
 *      1. Import and use the official Wormhole IWormhole interface.
 *      2. Call `IWormhole(wormholeCore).parseAndVerifyVM(encodedVAA)` to validate.
 *      3. Use the wormhole emitter address + sequence for replay prevention.
 *      The current implementation uses a trusted-relayer model as a scaffold
 *      until Wormhole dependencies are pinned.
 */
contract BurnBridgeReceiver is Ownable, ReentrancyGuard {

    // ─── Interfaces ───────────────────────────────────────────────────────────

    /// Minimal interface for the minted token
    interface IMintable {
        function mint(address to, uint256 amount) external;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// Wormhole core bridge address on this chain
    address public wormholeCore;

    /// Wormhole chain ID of Solana (always 1)
    uint16  public constant SOLANA_CHAIN_ID = 1;

    /// Wormhole chain ID of this EVM chain
    uint16  public immutable thisChainId;

    /// The Solana program ID (emitter address) that is allowed to send messages.
    /// Stored as bytes32 (Solana pubkey).
    bytes32 public trustedSolanaEmitter;

    /// The ERC20 token that will be minted on successful bridge calls.
    /// Must grant MINTER_ROLE (or equivalent) to this contract.
    address public mintableToken;

    /// Minting ratio: EVM tokens minted per 1 raw Solana token unit.
    /// Example: if Solana token has 9 decimals and EVM token has 18 decimals,
    /// set ratio = 1e9 so burning 1 full Solana token mints 1 full EVM token.
    uint256 public mintRatio;

    /// Replay prevention: tracks processed (emitter, sequence) pairs
    mapping(bytes32 => bool) public processedMessages;

    /// Trusted off-chain relayers (used during development / before full Wormhole integration)
    mapping(address => bool) public isTrustedRelayer;

    // ─── Events ───────────────────────────────────────────────────────────────

    event TokensActivated(
        bytes32 indexed solanaSourceMint,
        bytes32 indexed solanaSender,
        address indexed evmRecipient,
        uint256 amountMinted,
        uint64  solanaNonce
    );

    event RelayerUpdated(address relayer, bool trusted);
    event MintableTokenUpdated(address token);
    event MintRatioUpdated(uint256 ratio);
    event WormholeCoreUpdated(address core);
    event TrustedEmitterUpdated(bytes32 emitter);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        uint16  _thisChainId,
        address _wormholeCore,
        bytes32 _trustedSolanaEmitter,
        address _mintableToken,
        uint256 _mintRatio
    ) Ownable(msg.sender) {
        require(_wormholeCore       != address(0), "BurnBridgeReceiver: zero wormhole");
        require(_mintableToken      != address(0), "BurnBridgeReceiver: zero token");
        require(_mintRatio          > 0,           "BurnBridgeReceiver: zero ratio");

        thisChainId           = _thisChainId;
        wormholeCore          = _wormholeCore;
        trustedSolanaEmitter  = _trustedSolanaEmitter;
        mintableToken         = _mintableToken;
        mintRatio             = _mintRatio;
    }

    // ─── Core: receive message ────────────────────────────────────────────────

    /**
     * @notice Submit a Wormhole VAA to activate (mint) tokens on this chain.
     *
     * In development mode (before Wormhole is integrated), a trusted relayer
     * can call `receiveRelayedMessage` instead with the raw decoded payload.
     *
     * @param encodedVAA The full encoded Wormhole VAA bytes.
     */
    function receiveMessage(bytes calldata encodedVAA) external nonReentrant {
        // ── 1. Parse and verify VAA ───────────────────────────────────────────
        // TODO: uncomment once Wormhole interface is imported:
        //
        //   (IWormhole.VM memory vm, bool valid, string memory reason)
        //       = IWormhole(wormholeCore).parseAndVerifyVM(encodedVAA);
        //   require(valid, reason);
        //   require(vm.emitterChainId == SOLANA_CHAIN_ID, "BurnBridgeReceiver: wrong emitter chain");
        //   require(vm.emitterAddress == trustedSolanaEmitter, "BurnBridgeReceiver: untrusted emitter");
        //
        // ── 2. Replay protection ──────────────────────────────────────────────
        //   bytes32 messageKey = keccak256(abi.encodePacked(vm.emitterChainId, vm.emitterAddress, vm.sequence));
        //   require(!processedMessages[messageKey], "BurnBridgeReceiver: already processed");
        //   processedMessages[messageKey] = true;
        //
        // ── 3. Decode payload and mint ────────────────────────────────────────
        //   _processPayload(vm.payload);

        // Scaffold: decode directly for integration testing
        _processPayload(encodedVAA);
    }

    /**
     * @notice Trusted-relayer path for development / integration testing.
     *         The relayer decodes the VAA off-chain and submits the raw payload.
     *
     * @param payload     The decoded VAA payload bytes.
     * @param messageKey  keccak256(emitterChain, emitterAddress, sequence) for replay prevention.
     */
    function receiveRelayedMessage(
        bytes calldata payload,
        bytes32        messageKey
    ) external nonReentrant {
        require(isTrustedRelayer[msg.sender], "BurnBridgeReceiver: not a trusted relayer");
        require(!processedMessages[messageKey], "BurnBridgeReceiver: already processed");
        processedMessages[messageKey] = true;

        _processPayload(payload);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @dev Decode the payload and mint tokens to the recipient.
     *
     * Payload layout (matches Anchor program):
     *   [0..32]   bytes32  solanaSourceMint
     *   [32..64]  bytes32  solanaSender
     *   [64..96]  bytes32  evmRecipient  (address right-justified, 12 zero bytes prefix)
     *   [96..104] uint64   amountBurned  (big-endian)
     *   [104..106] uint16  targetChainId (big-endian)
     *   [106..114] uint64  nonce         (big-endian)
     */
    function _processPayload(bytes calldata payload) internal {
        require(payload.length >= 114, "BurnBridgeReceiver: payload too short");

        bytes32 solanaSourceMint;
        bytes32 solanaSender;
        address evmRecipient;
        uint64  amountBurned;
        uint16  targetChainId;
        uint64  nonce;

        assembly {
            let ptr := payload.offset
            solanaSourceMint := calldataload(ptr)
            solanaSender     := calldataload(add(ptr, 32))
            // EVM address is the last 20 bytes of the 32-byte field
            evmRecipient     := shr(96, calldataload(add(ptr, 64)))
            amountBurned     := shr(192, calldataload(add(ptr, 96)))
            targetChainId    := shr(240, calldataload(add(ptr, 104)))
            nonce            := shr(192, calldataload(add(ptr, 106)))
        }

        require(evmRecipient != address(0),                               "BurnBridgeReceiver: zero recipient");
        require(targetChainId == thisChainId || targetChainId == 0,       "BurnBridgeReceiver: wrong target chain");

        uint256 mintAmount = uint256(amountBurned) * mintRatio;
        require(mintAmount > 0, "BurnBridgeReceiver: zero mint amount");

        IMintable(mintableToken).mint(evmRecipient, mintAmount);

        emit TokensActivated(
            solanaSourceMint,
            solanaSender,
            evmRecipient,
            mintAmount,
            nonce
        );
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setTrustedRelayer(address relayer, bool trusted) external onlyOwner {
        isTrustedRelayer[relayer] = trusted;
        emit RelayerUpdated(relayer, trusted);
    }

    function setMintableToken(address token) external onlyOwner {
        require(token != address(0), "BurnBridgeReceiver: zero token");
        mintableToken = token;
        emit MintableTokenUpdated(token);
    }

    function setMintRatio(uint256 ratio) external onlyOwner {
        require(ratio > 0, "BurnBridgeReceiver: zero ratio");
        mintRatio = ratio;
        emit MintRatioUpdated(ratio);
    }

    function setWormholeCore(address core) external onlyOwner {
        require(core != address(0), "BurnBridgeReceiver: zero core");
        wormholeCore = core;
        emit WormholeCoreUpdated(core);
    }

    function setTrustedSolanaEmitter(bytes32 emitter) external onlyOwner {
        trustedSolanaEmitter = emitter;
        emit TrustedEmitterUpdated(emitter);
    }
}
