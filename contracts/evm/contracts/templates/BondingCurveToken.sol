// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title BondingCurveToken
 * @notice Meme / pump.fun-style token with a simple linear bonding curve.
 *         Users buy tokens by sending ETH; price increases linearly with supply.
 *         Selling returns ETH from the reserve at the current curve price.
 *
 * Price formula:
 *   price per token (wei) = BASE_PRICE + SLOPE * tokensSoldSoFar
 *
 * This is a simplified educational implementation. Production deployments should
 * use audited bonding-curve libraries and add slippage protection.
 */
contract BondingCurveToken is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable
{
    uint8   private _tokenDecimals;
    uint256 public  basePrice;   // wei per raw token unit at zero supply
    uint256 public  slope;       // wei increase per raw token unit minted

    // Track ETH reserve separately (vs. address(this).balance) to be explicit
    uint256 public ethReserve;

    // Simple reentrancy guard (OZ 5.x dropped ReentrancyGuardUpgradeable)
    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "BondingCurveToken: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    event Buy(address indexed buyer,  uint256 tokenAmount, uint256 ethPaid);
    event Sell(address indexed seller, uint256 tokenAmount, uint256 ethReturned);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256,         // totalSupply – not pre-minted; tokens are minted on buy
        uint8   decimals_,
        uint16, // buyTaxBps  – unused (curve handles pricing)
        uint16, // sellTaxBps – unused
        uint16, // burnBps    – unused
        uint16, // reflectionBps – unused
        address, // marketingWallet – unused
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_ != address(0), "BondingCurveToken: zero owner");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _reentrancyStatus = _NOT_ENTERED;
        _tokenDecimals = decimals_ == 0 ? 18 : decimals_;
        // Defaults: 0.000001 ETH base price, tiny slope
        basePrice = 1e12; // 0.000001 ETH (1 micro-ETH) per token unit
        slope     = 1e6;  // increases by 1e-12 ETH per token minted
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // ─── Curve helpers ────────────────────────────────────────────────────────

    /**
     * @notice Returns the cost (in wei) to buy `amount` raw token units
     *         given current total supply.
     */
    function getBuyCost(uint256 amount) public view returns (uint256 cost) {
        uint256 s = totalSupply();
        // Integral of (basePrice + slope * x) from s to s+amount
        // = basePrice * amount + slope * (amount * (2*s + amount)) / 2
        cost = basePrice * amount + slope * (amount * (2 * s + amount)) / 2;
    }

    /**
     * @notice Returns the ETH refund for selling `amount` raw token units.
     */
    function getSellRefund(uint256 amount) public view returns (uint256 refund) {
        uint256 s = totalSupply();
        if (amount > s) return 0;
        // Integral from s-amount to s
        refund = basePrice * amount + slope * (amount * (2 * (s - amount) + amount)) / 2;
        if (refund > ethReserve) refund = ethReserve;
    }

    // ─── Buy / Sell ───────────────────────────────────────────────────────────

    /**
     * @notice Buy tokens by sending ETH. Mints tokens to caller.
     * @param minTokens Minimum tokens expected (slippage guard).
     */
    function buy(uint256 minTokens) external payable nonReentrant {
        require(msg.value > 0, "BondingCurveToken: send ETH to buy");

        // Binary-search for the number of tokens purchasable with msg.value
        uint256 amount = _tokensForEth(msg.value);
        require(amount >= minTokens, "BondingCurveToken: slippage");

        uint256 cost = getBuyCost(amount);
        uint256 refund = msg.value - cost;

        ethReserve += cost;
        _mint(msg.sender, amount);

        if (refund > 0) {
            (bool sent, ) = msg.sender.call{value: refund}("");
            require(sent, "BondingCurveToken: refund failed");
        }

        emit Buy(msg.sender, amount, cost);
    }

    /**
     * @notice Sell tokens, receive ETH from reserve.
     * @param amount Raw token units to sell.
     * @param minEth Minimum ETH expected (slippage guard).
     */
    function sell(uint256 amount, uint256 minEth) external nonReentrant {
        require(amount > 0, "BondingCurveToken: zero amount");
        require(balanceOf(msg.sender) >= amount, "BondingCurveToken: insufficient balance");

        uint256 refund = getSellRefund(amount);
        require(refund >= minEth, "BondingCurveToken: slippage");
        require(refund <= ethReserve, "BondingCurveToken: insufficient reserve");

        ethReserve -= refund;
        _burn(msg.sender, amount);

        (bool sent, ) = msg.sender.call{value: refund}("");
        require(sent, "BondingCurveToken: ETH transfer failed");

        emit Sell(msg.sender, amount, refund);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setCurveParams(uint256 _basePrice, uint256 _slope) external onlyOwner {
        require(_basePrice > 0, "BondingCurveToken: zero base price");
        basePrice = _basePrice;
        slope     = _slope;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @dev Approximate number of tokens purchasable for `ethAmount` via binary search.
     *      Avoids floating-point arithmetic.
     */
    function _tokensForEth(uint256 ethAmount) internal view returns (uint256) {
        uint256 lo = 0;
        uint256 hi = 10 ** 30; // upper bound
        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (getBuyCost(mid) <= ethAmount) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return lo;
    }
}
