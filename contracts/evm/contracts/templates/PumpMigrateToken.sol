// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../libraries/LinearCurve.sol";
import "../libraries/CanonicalDex.sol";

interface IDexRouter {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

interface IDexFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

interface IJoeRouter {
    function WAVAX() external view returns (address);
}

/**
 * @title PumpMigrateToken
 * @notice Bonding curve token that automatically "graduates" to CEX-ready status
 *         once a SOL/ETH graduation threshold is reached — exactly like pump.fun.
 *
 * Narrative: "CEX Migration Meta" — launch on a bonding curve, graduate when
 * you hit the ETH threshold, auto-lock LP, then ride the CEX listing liquidity explosion.
 *
 * Flow:
 *  1. Token launches with a virtual token reserve (a supply offset, not a wei balance).
 *  2. Users buy via `buy()` — price increases linearly with supply.
 *  3. When `ethReserve >= graduationThreshold` the same buy migrates the reserve
 *     and an equal token amount into the canonical V2 router for `block.chainid`.
 *  4. LP tokens are minted to the burn address. Curve trading stays halted.
 *  5. Neither the token creator nor the factory owner can choose the router.
 *     The address comes from `CanonicalDex`. Migration can run once.
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
    /// @notice Deprecated. Retained so older readers do not mistake a wei value for token supply.
    uint256 public virtualEthReserve;
    /// @notice Virtual tokens already "sold", used only as the curve's supply offset.
    uint256 public virtualTokenReserve;

    // ─── Graduation ───────────────────────────────────────────────────────────
    uint256 public graduationThreshold;
    bool    public isGraduated;
    bool    public tradingPaused;
    bool    public liquidityMigrated;
    uint256 public graduatedAt;
    /// @notice LP is sent here so the creator cannot pull the pool.
    address public constant LP_BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    /// @notice Minimum share of the reserve the router must keep. 9900 = 99%.
    uint16  public minMigrateEthBps;
    uint16  public constant MAX_TRADING_FEE_BPS = 300;

    // ─── DEX config ───────────────────────────────────────────────────────────
    /// @notice Factory that created this clone. It does not choose the router.
    address public launchFactory;
    /// @notice Router used at graduation. Written only inside `_migrate`.
    address public dexRouter;
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
    event DexRouterUpdated(address router);
    event MinMigrateEthBpsUpdated(uint16 bps);

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
        require(tradingFeeBps_ <= MAX_TRADING_FEE_BPS, "PumpMigrateToken: fee > 3 %");

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

        // Price offset is in token units. Adding wei (the old virtualEthReserve)
        // to totalSupply() priced the first token at tens of ETH.
        virtualEthReserve    = 0;
        virtualTokenReserve  = 1_000_000;
        basePrice            = 1e9;
        slope                = 1e3;
        minMigrateEthBps     = 9900;
        launchFactory        = msg.sender;
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }

    // ─── Bonding curve buy ────────────────────────────────────────────────────

    function buy(uint256 minTokens) external payable nonReentrant notPaused {
        require(msg.value > 0, "PumpMigrateToken: send ETH");

        // Fee is charged on ETH the curve actually keeps, not on the refunded surplus.
        uint256 budget = tradingFeeBps == 0
            ? msg.value
            : (msg.value * 10_000) / (10_000 + uint256(tradingFeeBps));
        uint256 amount = LinearCurve.tokensForEth(basePrice, slope, _curveIndex(), budget);
        require(amount > 0, "PumpMigrateToken: zero tokens");
        require(amount >= minTokens, "PumpMigrateToken: slippage");

        uint256 cost = getBuyCost(amount);
        uint256 fee = (cost * tradingFeeBps) / 10_000;
        uint256 totalCharge = cost + fee;
        require(totalCharge <= msg.value, "PumpMigrateToken: insufficient ETH");

        ethReserve += cost;
        _mint(msg.sender, amount);

        if (fee > 0) {
            (bool sent,) = feeWallet.call{value: fee}("");
            require(sent, "PumpMigrateToken: fee failed");
        }

        uint256 excess = msg.value - totalCharge;
        if (excess > 0) {
            (bool ok,) = msg.sender.call{value: excess}("");
            require(ok, "PumpMigrateToken: refund failed");
        }

        emit Buy(msg.sender, amount, cost);

        if (!isGraduated && ethReserve >= graduationThreshold) {
            _migrate();
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
        (bool ok, uint256 cost) = LinearCurve.tryCost(basePrice, slope, _curveIndex(), amount);
        require(ok, "PumpMigrateToken: cost overflow");
        return cost;
    }

    function getSellRefund(uint256 amount) public view returns (uint256) {
        if (amount > totalSupply()) return 0;
        uint256 index = _curveIndex();
        (bool ok, uint256 refund) = LinearCurve.tryCost(basePrice, slope, index - amount, amount);
        if (!ok) return 0;
        return refund > ethReserve ? ethReserve : refund;
    }

    function _curveIndex() internal view returns (uint256) {
        return totalSupply() + virtualTokenReserve;
    }

    // ─── Graduation ───────────────────────────────────────────────────────────

    /// @notice Registry entry for this chain. Zero when the chain has no verified router.
    function canonicalVenue()
        external
        view
        returns (address router, address dexFactory, address wrappedNative, bool avaxNative)
    {
        CanonicalDex.Venue memory v = CanonicalDex.venue(block.chainid);
        return (v.router, v.factory, v.wrappedNative, v.avaxNative);
    }

    function _venue() internal view virtual returns (CanonicalDex.Venue memory v) {
        v = CanonicalDex.venue(block.chainid);
        CanonicalDex.assertLive(v);
    }

    function _migrate() internal {
        require(!liquidityMigrated, "PumpMigrateToken: already migrated");
        CanonicalDex.Venue memory v = _venue();

        uint256 ethIn = ethReserve;
        uint256 supply = totalSupply();
        require(ethIn > 0 && supply > 0, "PumpMigrateToken: empty pool");

        isGraduated = true;
        tradingPaused = true;
        liquidityMigrated = true;
        graduatedAt = block.timestamp;
        ethReserve = 0;
        dexRouter = v.router;
        emit DexRouterUpdated(v.router);

        _mint(address(this), supply);
        _approve(address(this), v.router, supply);

        uint256 ethMin = (ethIn * minMigrateEthBps) / 10_000;
        uint256 tokenMin = (supply * 9900) / 10_000;
        (uint256 usedToken, uint256 usedEth, uint256 liquidity) = _addLiquidity(v, supply, tokenMin, ethMin, ethIn);
        require(liquidity > 0, "PumpMigrateToken: no liquidity");
        require(usedEth >= ethMin && usedToken >= tokenMin, "PumpMigrateToken: slippage");

        uint256 dust = balanceOf(address(this));
        if (dust > 0) _burn(address(this), dust);
        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool ok,) = feeWallet.call{value: leftover}("");
            require(ok, "PumpMigrateToken: leftover failed");
        }

        address pair = IDexFactory(v.factory).getPair(address(this), v.wrappedNative);
        liquidityPair = pair;
        lpTokensLocked = liquidity;
        emit Graduated(ethIn, supply, block.timestamp);
        emit LiquidityAdded(pair, usedToken, usedEth);
    }

    function _addLiquidity(
        CanonicalDex.Venue memory v,
        uint256 supply,
        uint256 tokenMin,
        uint256 ethMin,
        uint256 ethIn
    ) internal returns (uint256 usedToken, uint256 usedEth, uint256 liquidity) {
        if (v.avaxNative) {
            (bool ok, bytes memory data) = v.router.call{value: ethIn}(
                abi.encodeWithSelector(
                    bytes4(keccak256("addLiquidityAVAX(address,uint256,uint256,uint256,address,uint256)")),
                    address(this),
                    supply,
                    tokenMin,
                    ethMin,
                    LP_BURN_ADDRESS,
                    block.timestamp
                )
            );
            if (!ok) {
                if (data.length > 0) {
                    assembly {
                        revert(add(data, 32), mload(data))
                    }
                }
                revert("PumpMigrateToken: liquidity call failed");
            }
            return abi.decode(data, (uint256, uint256, uint256));
        }
        return IDexRouter(v.router).addLiquidityETH{value: ethIn}(
            address(this),
            supply,
            tokenMin,
            ethMin,
            LP_BURN_ADDRESS,
            block.timestamp
        );
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

    function setMinMigrateEthBps(uint16 bps) external onlyOwner {
        require(ethReserve == 0 && !isGraduated, "PumpMigrateToken: trading already started");
        require(bps >= 9000 && bps <= 10_000, "PumpMigrateToken: slippage bounds");
        minMigrateEthBps = bps;
        emit MinMigrateEthBpsUpdated(bps);
    }

    function setFeeWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "PumpMigrateToken: zero wallet");
        feeWallet = wallet;
    }

    function setGraduationThreshold(uint256 thresholdWei) external onlyOwner {
        require(!isGraduated, "PumpMigrateToken: already graduated");
        require(ethReserve == 0, "PumpMigrateToken: trading already started");
        require(thresholdWei > 0, "PumpMigrateToken: zero threshold");
        graduationThreshold = thresholdWei;
    }

    /// @dev Plain transfers would sit outside ethReserve and become unrecoverable.
    receive() external payable {
        revert("PumpMigrateToken: use buy()");
    }
}
