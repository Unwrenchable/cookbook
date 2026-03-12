// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title StandardERC20
 * @notice A plain ERC20 token deployed via the TokenFactory clone pattern.
 *         All supply is minted to the owner on initialization.
 */
contract StandardERC20 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8 private _tokenDecimals;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializer called once by the factory immediately after cloning.
     */
    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 totalSupply_,
        uint8   decimals_,
        uint16, // buyTaxBps   – unused for standard token
        uint16, // sellTaxBps  – unused
        uint16, // burnBps     – unused
        uint16, // reflectionBps – unused
        address, // marketingWallet – unused
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_ != address(0), "StandardERC20: zero owner");
        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);
        _tokenDecimals = decimals_ == 0 ? 18 : decimals_;
        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }
}
