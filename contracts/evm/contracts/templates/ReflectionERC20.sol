// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/math/Math.sol";
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
    mapping(address => uint256) private _claimable;

    event ReflectionBpsUpdated(uint16 newReflectionBps);
    event ReflectionsClaimed(address indexed account, uint256 amount);

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
     * @dev Returns claimable reflections for an account, including amounts not yet settled.
     */
    function pendingReflections(address account) public view returns (uint256) {
        return _claimable[account] + _unsettled(account);
    }

    /**
     * @dev Withdraw accumulated reflections to caller.
     *      Reflections are burned on transfer and minted back here, so a full
     *      claim does not inflate supply beyond rounding dust.
     */
    function claimReflections() external {
        _checkpoint(msg.sender);
        uint256 owed = _claimable[msg.sender];
        require(owed > 0, "ReflectionERC20: nothing to claim");
        _claimable[msg.sender] = 0;
        _totalReflected += owed;
        _mint(msg.sender, owed);
        emit ReflectionsClaimed(msg.sender, owed);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0)) _checkpoint(from);
        if (to != address(0) && to != from) _checkpoint(to);

        uint256 reflectAmount = 0;
        if (from != address(0) && to != address(0) && reflectionBps > 0 && amount > 0) {
            reflectAmount = (amount * reflectionBps) / 10_000;
        }

        if (reflectAmount > 0) {
            super._update(from, address(0), reflectAmount);
            uint256 net = amount - reflectAmount;
            if (net > 0) super._update(from, to, net);
        } else {
            super._update(from, to, amount);
        }

        // Realign debt to post-transfer balances at the pre-distribution index.
        // The following per-share increase is then claimable on the new balances.
        if (from != address(0)) _syncDebt(from);
        if (to != address(0) && to != from) _syncDebt(to);

        if (reflectAmount > 0) {
            uint256 supply = totalSupply();
            if (supply > 0) {
                _reflectionsPerShare += Math.mulDiv(reflectAmount, _MAGNITUDE, supply);
            }
        }
    }

    function _unsettled(address account) internal view returns (uint256) {
        if (account == address(0)) return 0;
        uint256 bal = balanceOf(account);
        if (bal == 0) return 0;
        uint256 accumulated = Math.mulDiv(_reflectionsPerShare, bal, _MAGNITUDE);
        uint256 debt = _reflectionDebt[account];
        return accumulated > debt ? accumulated - debt : 0;
    }

    function _checkpoint(address account) internal {
        uint256 pending = _unsettled(account);
        if (pending > 0) _claimable[account] += pending;
        _syncDebt(account);
    }

    function _syncDebt(address account) private {
        if (account == address(0)) return;
        _reflectionDebt[account] = Math.mulDiv(_reflectionsPerShare, balanceOf(account), _MAGNITUDE);
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function setReflectionBps(uint16 _bps) external onlyOwner {
        require(_bps <= 1000, "ReflectionERC20: reflection > 10 %");
        reflectionBps = _bps;
        emit ReflectionBpsUpdated(_bps);
    }
}
