// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeMintableToken
 * @notice ERC20 minted by a single BurnBridgeReceiver.
 *         The factory templates are not mintable; this is the token the
 *         Solana burn bridge is supposed to activate on each EVM chain.
 */
contract BridgeMintableToken is ERC20, Ownable {
    uint8 private immutable _tokenDecimals;
    address public minter;

    event MinterUpdated(address indexed minter);

    error ZeroAddress();
    error NotMinter();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        _tokenDecimals = decimals_ == 0 ? 18 : decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    /// @notice Point minting at the deployed BurnBridgeReceiver. One-way in practice: set it once.
    function setMinter(address minter_) external onlyOwner {
        if (minter_ == address(0)) revert ZeroAddress();
        minter = minter_;
        emit MinterUpdated(minter_);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }
}
