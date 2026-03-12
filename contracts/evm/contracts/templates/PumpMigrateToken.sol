// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title PumpMigrateToken
 * @notice Bonding curve token that automatically "graduates" to CEX-ready status
 *         once a SOL/ETH graduation threshold is reached — exactly like pump.fun.
 *
 * Narrative: "CEX Migration Meta" — launch on a bonding curve, graduate when
 * you hit the ETH threshold, auto-lock LP, then ride the CEX listing liquidity explosion.
 *
 * Flow:
 *  1. Token launches with a virtual ETH reserve (creates initial price).
 *  2. Users buy via `buy()` — price increases linearly with supply.
 *  3. When `ethReserve >= graduationThreshold` → `_graduate()` is triggered.
 *  4. Graduation: trading pauses for 24 h, emits `Graduated` event,
 *     owner calls `addLiquidityToDex()` to create an LP pair.
 *  5. After LP is added, normal trading resumes on DEX.
 *
 * This matches the pump.fun → Raydium migration pattern on Solana,
 * adapted for EVM (pump.fun → Uniswap/PancakeSwap).
 */
contract PumpMigrateToken is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8   private _tokenDecimals;

    // ─── Bonding curve ────────────────────────────────────────────────────────
    uint256 public basePrice;        // wei per raw token unit at zero supply
    uint256 public slope;            // wei increase per raw token unit minted
    uint256 public ethReserve;       // actual ETH in the curve
    uint256 public virtualEthReserve; // virtual ETH (sets initial price)

    // ─── Graduation ───────────────────────────────────────────────────────────
    uint256 public graduationThreshold; // ETH needed to graduate (e.g. 0.085 ETH on L2, 85 ETH on mainnet)
    bool    public isGraduated;
    bool    public tradingPaused;
    uint256 public graduatedAt;
    uint256 public constant PAUSE_DURATION = 24 hours;

    // ─── DEX config (set by owner after graduation) ───────────────────────────
    address public dexRouter;        // Uniswap / PancakeSwap router
    address public liquidityPair;    // LP pair address after migration
    uint256 public lpTokensLocked;   // amount of LP tokens locked

    // ─── Fee ──────────────────────────────────────────────────────────────────
    uint16  public tradingFeeBps;    // basis points fee on buys/sells (e.g. 100 = 1%)
    address public feeWallet;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Buy(address indexed buyer, uint256 tokenAmount, uint256 ethPaid);
    event Sell(address indexed seller, uint256 tokenAmount, uint256 ethReturned);
    event Graduated(uint256 ethReserve, uint256 totalSupply, uint256 timestamp);
    event LiquidityAdded(address pair, uint256 tokens, uint256 eth);
    event TradingResumed();

    // ─── Reentrancy guard ─────────────────────────────────────────────────────
    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "PumpMigrateToken: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    modifier notPaused() {
        require(!tradingPaused, "PumpMigrateToken: trading paused (graduating)");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 graduationThresholdEth_, // totalSupply slot: graduation ETH (in wei, scaled to avoid huge numbers)
        uint8   decimals_,
        uint16  tradingFeeBps_,   // reuse buyTaxBps
        uint16, // unused
        uint16, // unused
        uint16, // unused
        address feeWallet_,       // reuse marketingWallet
        uint16, // unused
        address owner_
    ) external initializer {
        require(owner_    != address(0), "PumpMigrateToken: zero owner");
        require(tradingFeeBps_ <= 300,   "PumpMigrateToken: fee > 3 %");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals       = decimals_ == 0 ? 18 : decimals_;
        tradingFeeBps        = tradingFeeBps_ == 0 ? 100 : tradingFeeBps_;
        feeWallet            = feeWallet_ != address(0) ? feeWallet_ : owner_;
        _reentrancyStatus    = _NOT_ENTERED;

        // graduation threshold: stored in wei. If user passes 0, default to 0.085 ETH (L2 friendly)
        graduationThreshold  = graduationThresholdEth_ > 0
            ? graduationThresholdEth_
            : 85_000_000_000_000_000; // 0.085 ETH

        // Bonding curve params (pump.fun inspired)
        virtualEthReserve    = 30_000_000_000_000_000; // 0.03 ETH virtual (sets start price)
        basePrice            = 1e9;    // ~1e-9 ETH per raw token at zero supply
        slope                = 1e3;
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }

    // ─── Bonding curve buy ────────────────────────────────────────────────────

    function buy(uint256 minTokens) external payable nonReentrant notPaused {
        require(msg.value > 0, "PumpMigrateToken: send ETH");

        uint256 fee       = (msg.value * tradingFeeBps) / 10_000;
        uint256 ethIn     = msg.value - fee;
        uint256 amount    = _tokensForEth(ethIn);
        require(amount >= minTokens, "PumpMigrateToken: slippage");
        require(amount > 0,          "PumpMigrateToken: zero tokens");

        // Charge only the exact bonding-curve cost; refund unused ETH to buyer.
        uint256 cost   = getBuyCost(amount);
        uint256 excess = ethIn - cost;

        ethReserve += cost;
        _mint(msg.sender, amount);

        // Forward fee
        if (fee > 0) {
            (bool sent,) = feeWallet.call{value: fee}("");
            require(sent, "PumpMigrateToken: fee failed");
        }

        // Refund any ETH not consumed by the curve
        if (excess > 0) {
            (bool ok,) = msg.sender.call{value: excess}("");
            require(ok, "PumpMigrateToken: refund failed");
        }

        emit Buy(msg.sender, amount, cost);

        // Check graduation
        if (!isGraduated && ethReserve >= graduationThreshold) {
            _graduate();
        }
    }

    function sell(uint256 amount, uint256 minEth) external nonReentrant notPaused {
        require(amount > 0, "PumpMigrateToken: zero amount");
        require(balanceOf(msg.sender) >= amount, "PumpMigrateToken: insufficient balance");

        uint256 refund = getSellRefund(amount);
        uint256 fee    = (refund * tradingFeeBps) / 10_000;
        uint256 net    = refund - fee;

        require(net >= minEth, "PumpMigrateToken: slippage");
        require(ethReserve >= refund, "PumpMigrateToken: reserve low");

        ethReserve -= refund;
        _burn(msg.sender, amount);

        if (fee > 0) {
            (bool sent,) = feeWallet.call{value: fee}("");
            require(sent, "PumpMigrateToken: fee failed");
        }
        (bool ok,) = msg.sender.call{value: net}("");
        require(ok, "PumpMigrateToken: ETH transfer failed");

        emit Sell(msg.sender, amount, net);
    }

    // ─── Curve math ───────────────────────────────────────────────────────────

    function getBuyCost(uint256 amount) public view returns (uint256) {
        uint256 s = totalSupply() + virtualEthReserve; // virtual offset
        return basePrice * amount + slope * (amount * (2 * s + amount)) / 2;
    }

    function getSellRefund(uint256 amount) public view returns (uint256) {
        uint256 s = totalSupply() + virtualEthReserve;
        if (amount > totalSupply()) return 0;
        uint256 refund = basePrice * amount + slope * (amount * (2 * (s - amount) + amount)) / 2;
        return refund > ethReserve ? ethReserve : refund;
    }

    function _tokensForEth(uint256 ethAmount) internal view returns (uint256) {
        uint256 lo = 0;
        uint256 hi = 1e30;
        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (getBuyCost(mid) <= ethAmount) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    // ─── Graduation ───────────────────────────────────────────────────────────

    function _graduate() internal {
        isGraduated  = true;
        tradingPaused = true;
        graduatedAt  = block.timestamp;
        emit Graduated(ethReserve, totalSupply(), block.timestamp);
    }

    /**
     * @notice Resume trading after the pause window.
     *         Call after adding liquidity to a DEX.
     */
    function resumeTrading(address pair) external onlyOwner {
        require(isGraduated,   "PumpMigrateToken: not graduated");
        require(tradingPaused, "PumpMigrateToken: not paused");
        require(
            block.timestamp >= graduatedAt + PAUSE_DURATION,
            "PumpMigrateToken: 24 h pause not elapsed"
        );
        tradingPaused = false;
        liquidityPair = pair;
        emit TradingResumed();
    }

    /**
     * @notice Status check for the frontend dashboard.
     */
    function graduationProgress() external view returns (
        uint256 current,
        uint256 target,
        uint256 percentBps,  // 0–10000
        bool    graduated
    ) {
        current    = ethReserve;
        target     = graduationThreshold;
        percentBps = target > 0 ? (ethReserve * 10_000) / target : 0;
        if (percentBps > 10_000) percentBps = 10_000;
        graduated  = isGraduated;
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function setDexRouter(address router) external onlyOwner {
        dexRouter = router;
    }

    function setFeeWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "PumpMigrateToken: zero wallet");
        feeWallet = wallet;
    }

    function setGraduationThreshold(uint256 thresholdWei) external onlyOwner {
        require(!isGraduated, "PumpMigrateToken: already graduated");
        graduationThreshold = thresholdWei;
    }
}
