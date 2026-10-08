// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Tries to reenter TokenFactory when it receives the launch fee.
contract ReentrantFeeSink {
    address public factory;
    uint256 public attempts;

    function setFactory(address factory_) external {
        factory = factory_;
    }

    uint256 public reenterSucceeded;

    receive() external payable {
        attempts += 1;
        if (attempts == 1 && factory != address(0)) {
            (bool ok, ) = factory.call(abi.encodeWithSignature("claimReferralEarnings()"));
            if (ok) reenterSucceeded = 1;
        }
    }
}
