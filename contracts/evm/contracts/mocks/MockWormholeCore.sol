// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../bridge/IWormhole.sol";

/**
 * @notice Test double for the Wormhole core. It does not check guardian signatures itself.
 *         Tests set `valid` to simulate the core's signature result.
 */
contract MockWormholeCore is IWormhole {
    bool public valid = true;
    uint16 public emitterChainId = 1;
    bytes32 public emitterAddress;
    uint64 public sequence = 1;
    bytes public payload;
    string public invalidReason = "invalid signature";

    function configure(
        bool valid_,
        uint16 emitterChainId_,
        bytes32 emitterAddress_,
        uint64 sequence_,
        bytes calldata payload_
    ) external {
        valid = valid_;
        emitterChainId = emitterChainId_;
        emitterAddress = emitterAddress_;
        sequence = sequence_;
        payload = payload_;
    }

    function parseAndVerifyVM(bytes calldata encodedVM)
        external
        view
        returns (VM memory vm, bool ok, string memory reason)
    {
        vm.version = 1;
        vm.timestamp = 1;
        vm.nonce = 1;
        vm.emitterChainId = emitterChainId;
        vm.emitterAddress = emitterAddress;
        vm.sequence = sequence;
        vm.consistencyLevel = 1;
        bytes memory body = payload;
        if (body.length == 0) body = encodedVM;
        vm.payload = body;
        vm.guardianSetIndex = 0;
        vm.hash = keccak256(encodedVM);
        ok = valid;
        reason = valid ? "" : invalidReason;
    }
}
