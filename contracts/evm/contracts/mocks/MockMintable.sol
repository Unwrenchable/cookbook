// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockMintable {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}
