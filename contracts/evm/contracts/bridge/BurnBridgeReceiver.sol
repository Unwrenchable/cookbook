// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── Interfaces (Moved outside the contract) ──────────────────────────────────

/**
 * @dev Minimal interface for the minted token. 
 * This must be outside the contract block to satisfy the Solidity parser.
 */
interface IMintable {
    function mint(address to, uint256 amount) external;
}

/**
 * @title BurnBridgeReceiver
 * @notice EVM side of the TokenForge cross-chain burn-to-activate mechanic.
 */
contract BurnBridgeReceiver is Ownable, ReentrancyGuard {

    // ─── State ────────────────────────────────────────────────────────────────

    /// Wormhole core bridge address on this chain
    address public wormholeCore;

    /// Wormhole chain ID of Solana (always 1)
    uint16  public constant SOLANA_CHAIN_ID = 1;

    /// Wormhole chain ID of this EVM chain
    uint16  public immutable thisChainId;

    /// The Solana program ID (emitter address) that is allowed to send messages.
    bytes32 public trustedSolanaEmitter;

    /// The ERC20 token that will be minted on successful bridge calls.
    address public mintableToken;

    /// Minting ratio: EVM tokens minted per 1 raw Solana token unit.
    uint256 public mintRatio;

    /// Replay prevention: tracks processed (emitter, sequence) pairs
    mapping(bytes32 => bool) public processedMessages;

    /// Trusted off-chain relayers
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

    function receiveMessage(bytes calldata encodedVAA) external nonReentrant {
        // Reverts explicitly until Wormhole dependencies are pinned and integrated.
        revert("BurnBridgeReceiver: Wormhole VAA verification not implemented; use receiveRelayedMessage");
        
        // This is to suppress the unused variable warning for the scaffold
        encodedVAA;
    }

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

    function _processPayload(bytes calldata payload) internal {
        require(payload.length >= 114, "BurnBridgeReceiver: payload too short");

        bytes32 solanaSourceMint;
        bytes32 solanaSender;
        address evmRecipient;
        uint64  amountBurned;
        uint16  targetChainId;
        uint64  nonce;

        // Using assembly to pull specific bytes from the payload
        assembly {
            let ptr := payload.offset
            solanaSourceMint := calldataload(ptr)
            solanaSender     := calldataload(add(ptr, 32))
            
            // Recipient is 32 bytes in payload, but EVM address is 20 bytes.
            // We load the 32 bytes and shift right to get the address.
            evmRecipient     := shr(96, calldataload(add(ptr, 64)))
            
            // amountBurned (8 bytes) starts at offset 96. 
            // We load the 32-byte word starting there and shift right 192 bits (24 bytes).
            amountBurned     := shr(192, calldataload(add(ptr, 96)))
            
            // targetChainId (2 bytes) starts at offset 104.
            // Shift right 240 bits (30 bytes).
            targetChainId    := shr(240, calldataload(add(ptr, 104)))
            
            // nonce (8 bytes) starts at offset 106.
            // Shift right 192 bits (24 bytes).
            nonce            := shr(192, calldataload(add(ptr, 106)))
        }

        require(evmRecipient != address(0), "BurnBridgeReceiver: zero recipient");
        require(targetChainId == thisChainId || targetChainId == 0, "BurnBridgeReceiver: wrong target chain");

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
