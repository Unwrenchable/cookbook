// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IUtilityHybrid {
    function stake(uint256 amount) external;
    function vote(uint256 proposalId, bool support) external;
}

interface IERC20Approve {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Stakes and votes in one transaction. Used to prove same-block stake cannot vote.
contract StakeAndVote {
    function go(address token, uint256 amount, uint256 proposalId) external {
        IERC20Approve(token).transferFrom(msg.sender, address(this), amount);
        IERC20Approve(token).approve(token, amount);
        IUtilityHybrid(token).stake(amount);
        IUtilityHybrid(token).vote(proposalId, true);
    }
}
