// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../governance/DelayedAdmin.sol";
import "./IWormhole.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/**
 * @title BurnBridgeReceiver
 * @notice Mints an ERC-20 after Wormhole core verifies a guardian-signed VAA.
 *         The emitter chain and address must be on the allowlist. Replay uses the
 *         VAA hash and the (emitter, sequence) pair. Payload length is exactly 114 bytes.
 */
contract BurnBridgeReceiver is Ownable, ReentrancyGuard, DelayedAdmin {
    address public wormholeCore;

    /// Wormhole chain ID of Solana.
    uint16 public constant SOLANA_CHAIN_ID = 1;

    uint16 public immutable thisChainId;

    /// Primary Solana emitter recorded at deploy. Further emitters go through the timelock.
    bytes32 public trustedSolanaEmitter;

    address public mintableToken;
    uint256 public mintRatio;

    /// VAA hash and sequence keys that have already minted.
    mapping(bytes32 => bool) public processedMessages;

    /// emitterChainId => emitterAddress => allowed.
    mapping(uint16 => mapping(bytes32 => bool)) public trustedEmitters;

    /// When false, targetChainId 0 cannot mint on this chain.
    bool public acceptWildcardTarget;

    event TokensActivated(
        bytes32 indexed solanaSourceMint,
        bytes32 indexed solanaSender,
        address indexed evmRecipient,
        uint256 amountMinted,
        uint64 solanaNonce
    );

    event MintableTokenUpdated(address token);
    event MintRatioUpdated(uint256 ratio);
    event WormholeCoreUpdated(address core);
    event TrustedEmitterUpdated(uint16 chainId, bytes32 emitter, bool allowed);
    event WildcardTargetUpdated(bool enabled);

    bytes32 private constant _TAG_TOKEN = keccak256("setMintableToken");
    bytes32 private constant _TAG_RATIO = keccak256("setMintRatio");
    bytes32 private constant _TAG_CORE = keccak256("setWormholeCore");
    bytes32 private constant _TAG_EMITTER = keccak256("setTrustedEmitter");
    bytes32 private constant _TAG_WILDCARD = keccak256("setAcceptWildcardTarget");

    modifier onlyAdmin() override {
        _checkOwner();
        _;
    }

    constructor(
        uint16 _thisChainId,
        address _wormholeCore,
        bytes32 _trustedSolanaEmitter,
        address _mintableToken,
        uint256 _mintRatio
    ) Ownable(msg.sender) {
        require(_wormholeCore != address(0), "BurnBridgeReceiver: zero wormhole");
        require(_mintableToken != address(0), "BurnBridgeReceiver: zero token");
        require(_mintRatio > 0, "BurnBridgeReceiver: zero ratio");

        _initAdminDelay(24 hours);
        thisChainId = _thisChainId;
        wormholeCore = _wormholeCore;
        trustedSolanaEmitter = _trustedSolanaEmitter;
        mintableToken = _mintableToken;
        mintRatio = _mintRatio;
        if (_trustedSolanaEmitter != bytes32(0)) {
            trustedEmitters[SOLANA_CHAIN_ID][_trustedSolanaEmitter] = true;
        }
    }

    /**
     * @notice Submit a guardian-signed VAA. Anyone may call this.
     *         Wormhole core checks the guardian signatures. This contract checks
     *         the emitter allowlist, the VAA hash, the sequence, and the payload.
     */
    function receiveMessage(bytes calldata encodedVAA) external nonReentrant {
        (IWormhole.VM memory vm, bool valid,) = IWormhole(wormholeCore).parseAndVerifyVM(encodedVAA);
        require(valid, "BurnBridgeReceiver: invalid VAA");
        require(vm.hash != bytes32(0), "BurnBridgeReceiver: empty VAA hash");
        require(
            trustedEmitters[vm.emitterChainId][vm.emitterAddress],
            "BurnBridgeReceiver: emitter not allowed"
        );

        require(!processedMessages[vm.hash], "BurnBridgeReceiver: already processed");
        bytes32 seqKey = keccak256(abi.encode(vm.emitterChainId, vm.emitterAddress, vm.sequence));
        require(!processedMessages[seqKey], "BurnBridgeReceiver: sequence used");
        processedMessages[vm.hash] = true;
        processedMessages[seqKey] = true;

        _processPayload(vm.payload);
    }

    function _processPayload(bytes memory payload) internal {
        require(payload.length == 114, "BurnBridgeReceiver: bad payload length");

        bytes32 solanaSourceMint;
        bytes32 solanaSender;
        address evmRecipient;
        uint64 amountBurned;
        uint16 targetChainId;
        uint64 nonce;

        assembly {
            let ptr := add(payload, 32)
            solanaSourceMint := mload(ptr)
            solanaSender := mload(add(ptr, 32))
            evmRecipient := shr(96, mload(add(ptr, 64)))
            amountBurned := shr(192, mload(add(ptr, 96)))
            targetChainId := shr(240, mload(add(ptr, 104)))
            nonce := shr(192, mload(add(ptr, 106)))
        }

        require(evmRecipient != address(0), "BurnBridgeReceiver: zero recipient");
        require(amountBurned > 0, "BurnBridgeReceiver: zero amount");
        if (targetChainId == 0) {
            require(acceptWildcardTarget, "BurnBridgeReceiver: wildcard target disabled");
        } else {
            require(targetChainId == thisChainId, "BurnBridgeReceiver: wrong target chain");
        }

        uint256 mintAmount = uint256(amountBurned) * mintRatio;
        require(mintAmount / uint256(amountBurned) == mintRatio, "BurnBridgeReceiver: amount overflow");

        IMintable(mintableToken).mint(evmRecipient, mintAmount);

        emit TokensActivated(solanaSourceMint, solanaSender, evmRecipient, mintAmount, nonce);
    }

    function queueSetMintableToken(address token) external onlyOwner returns (bytes32 opId, uint256 eta) {
        require(token != address(0), "BurnBridgeReceiver: zero token");
        return _queue(_TAG_TOKEN, abi.encode(token));
    }

    function executeSetMintableToken(address token, uint256 eta) external {
        _consume(_TAG_TOKEN, abi.encode(token), eta);
        mintableToken = token;
        emit MintableTokenUpdated(token);
    }

    function queueSetMintRatio(uint256 ratio) external onlyOwner returns (bytes32 opId, uint256 eta) {
        require(ratio > 0, "BurnBridgeReceiver: zero ratio");
        return _queue(_TAG_RATIO, abi.encode(ratio));
    }

    function executeSetMintRatio(uint256 ratio, uint256 eta) external {
        _consume(_TAG_RATIO, abi.encode(ratio), eta);
        mintRatio = ratio;
        emit MintRatioUpdated(ratio);
    }

    function queueSetWormholeCore(address core) external onlyOwner returns (bytes32 opId, uint256 eta) {
        require(core != address(0), "BurnBridgeReceiver: zero core");
        return _queue(_TAG_CORE, abi.encode(core));
    }

    function executeSetWormholeCore(address core, uint256 eta) external {
        _consume(_TAG_CORE, abi.encode(core), eta);
        wormholeCore = core;
        emit WormholeCoreUpdated(core);
    }

    function queueSetTrustedEmitter(uint16 chainId, bytes32 emitter, bool allowed)
        external
        onlyOwner
        returns (bytes32 opId, uint256 eta)
    {
        require(emitter != bytes32(0), "BurnBridgeReceiver: zero emitter");
        return _queue(_TAG_EMITTER, abi.encode(chainId, emitter, allowed));
    }

    function executeSetTrustedEmitter(uint16 chainId, bytes32 emitter, bool allowed, uint256 eta) external {
        _consume(_TAG_EMITTER, abi.encode(chainId, emitter, allowed), eta);
        trustedEmitters[chainId][emitter] = allowed;
        if (chainId == SOLANA_CHAIN_ID && allowed) {
            trustedSolanaEmitter = emitter;
        }
        emit TrustedEmitterUpdated(chainId, emitter, allowed);
    }

    function queueSetAcceptWildcardTarget(bool enabled) external onlyOwner returns (bytes32 opId, uint256 eta) {
        return _queue(_TAG_WILDCARD, abi.encode(enabled));
    }

    function executeSetAcceptWildcardTarget(bool enabled, uint256 eta) external {
        _consume(_TAG_WILDCARD, abi.encode(enabled), eta);
        acceptWildcardTarget = enabled;
        emit WildcardTargetUpdated(enabled);
    }
}
