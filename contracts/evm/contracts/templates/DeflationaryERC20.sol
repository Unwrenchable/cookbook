// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title DeflationaryERC20
 * @notice ERC20 that auto-burns a configurable percentage of every transfer.
 *         burnBps is expressed in basis points (100 bps = 1 %).
 */
contract DeflationaryERC20 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8  private _tokenDecimals;
    uint16 public  burnBps;

    event BurnBpsUpdated(uint16 newBurnBps);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 totalSupply_,
        uint8   decimals_,
        uint16, // buyTaxBps  – unused
        uint16, // sellTaxBps – unused
        uint16  burnBps_,
        uint16, // reflectionBps – unused
        address, // marketingWallet – unused
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_   != address(0), "DeflationaryERC20: zero owner");
        require(burnBps_ <= 1000,       "DeflationaryERC20: burn > 10 %");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals = decimals_ == 0 ? 18 : decimals_;
        burnBps        = burnBps_;

        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // ─── Auto-burn on every transfer ──────────────────────────────────────────

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0) || burnBps == 0) {
            super._update(from, to, amount);
            return;
        }
        uint256 burnAmount = (amount * burnBps) / 10_000;
        if (burnAmount > 0) {
            super._update(from, address(0), burnAmount);   // burn
            super._update(from, to, amount - burnAmount);  // transfer remainder
        } else {
            super._update(from, to, amount);
        }
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function setBurnBps(uint16 _burnBps) external onlyOwner {
        require(_burnBps <= 1000, "DeflationaryERC20: burn > 10 %");
        burnBps = _burnBps;
        emit BurnBpsUpdated(_burnBps);
    }
}
