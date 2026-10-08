// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test double: transferFrom delivers 90% and burns the remaining 10%.
contract FeeOnTransferERC20 is ERC20 {
    constructor() ERC20("Fee LP", "FEE-LP") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = amount / 10;
        uint256 net = amount - fee;
        _spendAllowance(from, _msgSender(), amount);
        _transfer(from, to, net);
        if (fee > 0) _burn(from, fee);
        return true;
    }
}
