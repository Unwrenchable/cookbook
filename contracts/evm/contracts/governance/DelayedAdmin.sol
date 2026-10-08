// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @notice Queue, delay, execute, and cancel for admin calls.
 *         The delay can change only by queueing `setAdminDelay` through this contract.
 */
abstract contract DelayedAdmin {
    uint256 public constant MIN_ADMIN_DELAY = 1 hours;
    uint256 public constant MAX_ADMIN_DELAY = 30 days;

    /// @notice Default is set by the child constructor. Later changes go through the queue.
    uint256 public adminDelay;

    /// @notice eta timestamp for a queued op. Zero means the id is not queued.
    mapping(bytes32 => uint256) public adminEta;

    event AdminOpQueued(bytes32 indexed opId, bytes32 indexed tag, uint256 eta);
    event AdminOpExecuted(bytes32 indexed opId);
    event AdminOpCancelled(bytes32 indexed opId);
    event AdminDelayUpdated(uint256 newDelay);

    modifier onlyAdmin() virtual;

    function _initAdminDelay(uint256 delay) internal {
        require(delay >= MIN_ADMIN_DELAY && delay <= MAX_ADMIN_DELAY, "DelayedAdmin: delay");
        adminDelay = delay;
    }

    function _queue(bytes32 tag, bytes memory data) internal returns (bytes32 opId, uint256 eta) {
        eta = block.timestamp + adminDelay;
        opId = keccak256(abi.encode(tag, data, eta));
        require(adminEta[opId] == 0, "DelayedAdmin: already queued");
        adminEta[opId] = eta;
        emit AdminOpQueued(opId, tag, eta);
    }

    function _consume(bytes32 tag, bytes memory data, uint256 eta) internal returns (bytes32 opId) {
        opId = keccak256(abi.encode(tag, data, eta));
        uint256 ready = adminEta[opId];
        require(ready != 0, "DelayedAdmin: not queued");
        require(block.timestamp >= ready, "DelayedAdmin: too early");
        delete adminEta[opId];
        emit AdminOpExecuted(opId);
    }

    function queueSetAdminDelay(uint256 newDelay) external onlyAdmin returns (bytes32 opId, uint256 eta) {
        require(newDelay >= MIN_ADMIN_DELAY && newDelay <= MAX_ADMIN_DELAY, "DelayedAdmin: delay");
        return _queue(keccak256("setAdminDelay"), abi.encode(newDelay));
    }

    function executeSetAdminDelay(uint256 newDelay, uint256 eta) external {
        require(newDelay >= MIN_ADMIN_DELAY && newDelay <= MAX_ADMIN_DELAY, "DelayedAdmin: delay");
        _consume(keccak256("setAdminDelay"), abi.encode(newDelay), eta);
        adminDelay = newDelay;
        emit AdminDelayUpdated(newDelay);
    }

    function cancelAdminOp(bytes32 opId) external onlyAdmin {
        require(adminEta[opId] != 0, "DelayedAdmin: not queued");
        delete adminEta[opId];
        emit AdminOpCancelled(opId);
    }
}
