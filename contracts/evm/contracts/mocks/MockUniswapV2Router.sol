// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Minimal Uniswap V2 router/factory/pair stand-in.
 *         `shortEth` uses half of the ETH so a 99% minimum reverts.
 *         LP tokens are this contract's own ERC20, minted to `to`.
 */
contract MockUniswapV2Router is ERC20 {
    address public factoryAddress;
    address public weth;
    bool public shortEth;

    constructor() ERC20("Mock LP", "MLP") {
        factoryAddress = address(this);
        weth = address(this);
    }

    function factory() external view returns (address) {
        return factoryAddress;
    }

    function WETH() external view returns (address) {
        return weth;
    }

    function WAVAX() external view returns (address) {
        return weth;
    }

    function getPair(address, address) external view returns (address) {
        return address(this);
    }

    function setShortEth(bool enabled) external {
        shortEth = enabled;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        return _add(token, amountTokenDesired, amountTokenMin, amountETHMin, to);
    }

    /// @dev Same body as addLiquidityETH. Trader Joe V1 uses this name.
    function addLiquidityAVAX(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        return _add(token, amountTokenDesired, amountTokenMin, amountETHMin, to);
    }

    function _add(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to
    ) internal returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        require(amountTokenDesired >= amountTokenMin, "MockRouter: token slippage");
        amountETH = shortEth ? msg.value / 2 : msg.value;
        require(amountETH >= amountETHMin, "MockRouter: eth slippage");
        require(to != address(0), "MockRouter: zero to");

        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        amountToken = amountTokenDesired;
        liquidity = amountETH;
        _mint(to, liquidity);

        uint256 refund = msg.value - amountETH;
        if (refund > 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            require(ok, "MockRouter: refund failed");
        }
    }
}
