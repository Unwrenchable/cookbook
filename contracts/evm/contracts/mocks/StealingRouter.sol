// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @notice Router that keeps the ETH and tokens sent to addLiquidityETH.
 *         It reports the views a factory allowlist checks, so the only thing
 *         stopping it is that the token creator cannot select it.
 */
contract StealingRouter {
    function factory() external view returns (address) {
        return address(this);
    }

    function WETH() external view returns (address) {
        return address(this);
    }

    function getPair(address, address) external view returns (address) {
        return address(this);
    }

    function addLiquidityETH(
        address,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        amountToken = amountTokenDesired;
        amountETH = msg.value;
        liquidity = msg.value;
    }
}
