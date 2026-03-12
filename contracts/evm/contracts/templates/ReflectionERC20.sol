// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ReflectionERC20
 * @notice ERC20 that redistributes a percentage of every transfer to all current
 *         holders proportionally, using a shares-based accounting model.
 *         reflectionBps is expressed in basis points (100 bps = 1 %).
 */
contract ReflectionERC20 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8  private _tokenDecimals;
    uint16 public  reflectionBps;

    // Reflection accounting
    uint256 private constant _MAGNITUDE = 2 ** 128;
    uint256 private _reflectionsPerShare;
    uint256 private _totalReflected;

    mapping(address => uint256) private _reflectionDebt;

    event ReflectionBpsUpdated(uint16 newReflectionBps);

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
        uint16, // burnBps    – unused
        uint16  reflectionBps_,
        address, // marketingWallet – unused
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_          != address(0), "ReflectionERC20: zero owner");
        require(reflectionBps_  <= 1000,       "ReflectionERC20: reflection > 10 %");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals = decimals_ == 0 ? 18 : decimals_;
        reflectionBps  = reflectionBps_;

        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // ─── Reflection logic ─────────────────────────────────────────────────────

    /**
     * @dev Returns claimable reflections for an account.
     */
    function pendingReflections(address account) public view returns (uint256) {
        uint256 bal = balanceOf(account);
        if (bal == 0 || totalSupply() == 0) return 0;
        uint256 share = (_reflectionsPerShare * bal) / _MAGNITUDE;
        return share > _reflectionDebt[account] ? share - _reflectionDebt[account] : 0;
    }

    /**
     * @dev Withdraw accumulated reflections to caller.
     */
    function claimReflections() external {
        uint256 owed = pendingReflections(msg.sender);
        require(owed > 0, "ReflectionERC20: nothing to claim");
        _reflectionDebt[msg.sender] += owed;
        _totalReflected += owed;
        _mint(msg.sender, owed);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0) || reflectionBps == 0) {
            super._update(from, to, amount);
            _syncDebt(from);
            _syncDebt(to);
            return;
        }
        uint256 reflectAmount = (amount * reflectionBps) / 10_000;
        if (reflectAmount > 0 && totalSupply() > 0) {
            // Distribute reflection to all holders via per-share accumulator.
            // Use totalSupply() before burning so the per-share increase is
            // computed against the full outstanding supply.
            _reflectionsPerShare += (reflectAmount * _MAGNITUDE) / totalSupply();
            // Burn the reflection amount from the sender so they pay the full
            // `amount` (net transfer + reflection tax), and so that
            // claimReflections() can re-mint without inflating supply.
            super._update(from, address(0), reflectAmount);
        }
        super._update(from, to, amount - reflectAmount);
        _syncDebt(from);
        _syncDebt(to);
    }

    function _syncDebt(address account) private {
        if (account == address(0)) return;
        uint256 bal = balanceOf(account);
        _reflectionDebt[account] = (_reflectionsPerShare * bal) / _MAGNITUDE;
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function setReflectionBps(uint16 _bps) external onlyOwner {
        require(_bps <= 1000, "ReflectionERC20: reflection > 10 %");
        reflectionBps = _bps;
        emit ReflectionBpsUpdated(_bps);
    }
}
