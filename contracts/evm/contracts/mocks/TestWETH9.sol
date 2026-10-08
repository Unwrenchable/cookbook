// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal WETH9 used only so tests can call the official V2 router.
contract TestWETH9 {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed src, address indexed dst, uint256 wad);

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function transfer(address dst, uint256 wad) external returns (bool) {
        require(balanceOf[msg.sender] >= wad, "TestWETH9: balance");
        balanceOf[msg.sender] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(msg.sender, dst, wad);
        return true;
    }
}
