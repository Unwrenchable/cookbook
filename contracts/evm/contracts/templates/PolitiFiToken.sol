// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title PolitiFiToken
 * @notice ERC20 token themed around a political event or prediction market.
 *
 * Narrative: "PolitiFi" — token value is tied to a real-world binary event
 * (election, vote, ruling). Holders who "win" receive a bonus from a prize pool;
 * holders who "lose" get a partial burn. Perfect for headline-driven volatility.
 *
 * Mechanics:
 *  - Two sides: YES (bullish) and NO (bearish) on the political event.
 *  - Token holders register their side before the cutoff.
 *  - Owner (or decentralised oracle) calls resolve(outcome) after the event.
 *  - Winners claim a proportional share of the prize pool.
 *  - Losers suffer a configurable burn on their balance.
 *
 * The prize pool is funded by a % of every transfer (predictionFeeBps).
 */
contract PolitiFiToken is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8  private _tokenDecimals;

    // ─── Political event config ───────────────────────────────────────────────
    string  public eventName;        // e.g. "US Election 2024", "Brexit v2"
    uint256 public resolutionTime;   // Unix timestamp – after this, resolve() can be called
    uint16  public predictionFeeBps; // % of each transfer sent to prize pool
    uint16  public loserBurnBps;     // % burned from losers' balances on resolution

    // ─── Prediction state ─────────────────────────────────────────────────────
    enum Side { None, Yes, No }
    enum Outcome { Pending, Yes, No, Cancelled }

    Outcome public outcome;
    uint256 public prizePool;
    uint256 public totalYesBalance;
    uint256 public totalNoBalance;

    mapping(address => Side)    public holderSide;
    mapping(address => bool)    public hasClaimed;
    mapping(address => uint256) public sideBalanceSnapshot; // balance at cutoff
    mapping(address => bool)    public snapshotted;
    mapping(address => bool)    public loserBurnApplied;

    bool public cutoffReached;

    // ─── Events ───────────────────────────────────────────────────────────────
    event SideRegistered(address indexed holder, Side side);
    event EventResolved(Outcome outcome);
    event WinnerClaimed(address indexed winner, uint256 prize);
    event EventCancelled();
    event CutoffReached(uint256 totalYes, uint256 totalNo, uint256 prizePool);
    event LoserBurned(address indexed holder, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 totalSupply_,
        uint8   decimals_,
        uint16  predictionFeeBps_, // reuse buyTaxBps slot
        uint16  loserBurnBps_,     // reuse sellTaxBps slot
        uint16, // burnBps – unused
        uint16, // reflectionBps – unused
        address, // marketingWallet – unused
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_             != address(0), "PolitiFiToken: zero owner");
        require(predictionFeeBps_  <= 1000,       "PolitiFiToken: fee > 10 %");
        require(loserBurnBps_      <= 5000,       "PolitiFiToken: loser burn > 50 %");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals    = decimals_ == 0 ? 18 : decimals_;
        predictionFeeBps  = predictionFeeBps_;
        loserBurnBps      = loserBurnBps_;
        outcome           = Outcome.Pending;
        resolutionTime    = block.timestamp + 365 days; // default: 1 year, owner updates

        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }

    // ─── Prediction mechanics ─────────────────────────────────────────────────

    /**
     * @notice Register your prediction: YES or NO on the political event.
     *         Can only be called before the cutoff is reached.
     */
    function registerSide(Side side) external {
        require(!cutoffReached,                   "PolitiFiToken: cutoff passed");
        require(side == Side.Yes || side == Side.No, "PolitiFiToken: invalid side");
        require(balanceOf(msg.sender) > 0,        "PolitiFiToken: no balance");
        holderSide[msg.sender] = side;
        emit SideRegistered(msg.sender, side);
    }

    /**
     * @notice Owner locks predictions and snapshots balances.
     *         Must be called before resolution.
     */
    function lockCutoff(address[] calldata holders) external onlyOwner {
        require(!cutoffReached,          "PolitiFiToken: already locked");
        require(outcome == Outcome.Pending, "PolitiFiToken: already resolved");
        require(holders.length > 0 && holders.length <= 200, "PolitiFiToken: bad holder list");

        cutoffReached = true;
        for (uint256 i = 0; i < holders.length; i++) {
            _snapshot(holders[i]);
        }
        require(totalYesBalance + totalNoBalance > 0, "PolitiFiToken: nobody snapshotted");
        emit CutoffReached(totalYesBalance, totalNoBalance, prizePool);
    }

    function _snapshot(address holder) internal {
        if (snapshotted[holder]) return;
        Side side = holderSide[holder];
        if (side != Side.Yes && side != Side.No) return;
        snapshotted[holder] = true;
        uint256 bal = balanceOf(holder);
        sideBalanceSnapshot[holder] = bal;
        if (bal == 0) return;
        if (side == Side.Yes) totalYesBalance += bal;
        else totalNoBalance += bal;
    }

    /**
     * @notice Resolve the event. Owner or oracle calls this after the event.
     *         YES = outcome is Yes; NO = outcome is No.
     */
    function resolve(bool yesWon) external onlyOwner {
        require(cutoffReached,              "PolitiFiToken: cutoff not locked");
        require(outcome == Outcome.Pending, "PolitiFiToken: already resolved");
        require(block.timestamp >= resolutionTime, "PolitiFiToken: too early");

        outcome = yesWon ? Outcome.Yes : Outcome.No;
        emit EventResolved(outcome);
    }

    /**
     * @notice Burn loserBurnBps of a losing holder's balance.
     *         Permissionless so resolution does not need an unbounded loop.
     *         Transfers by that holder are blocked until this runs.
     */
    function applyLoserBurn(address holder) external {
        require(outcome == Outcome.Yes || outcome == Outcome.No, "PolitiFiToken: not resolved");
        require(!loserBurnApplied[holder], "PolitiFiToken: already burned");
        Side losingSide = outcome == Outcome.Yes ? Side.No : Side.Yes;
        require(holderSide[holder] == losingSide, "PolitiFiToken: not a loser");

        loserBurnApplied[holder] = true;
        uint256 bal = balanceOf(holder);
        if (bal == 0 || loserBurnBps == 0) return;
        uint256 burnAmount = (bal * loserBurnBps) / 10_000;
        if (burnAmount == 0) return;
        _burn(holder, burnAmount);
        emit LoserBurned(holder, burnAmount);
    }

    /**
     * @notice Winners claim their share of the prize pool.
     */
    function claimPrize() external {
        require(outcome == Outcome.Yes || outcome == Outcome.No, "PolitiFiToken: not resolved");
        require(!hasClaimed[msg.sender],  "PolitiFiToken: already claimed");

        Side winningSide = outcome == Outcome.Yes ? Side.Yes : Side.No;
        require(holderSide[msg.sender] == winningSide, "PolitiFiToken: not a winner");

        uint256 snapshot   = sideBalanceSnapshot[msg.sender];
        require(snapshot > 0, "PolitiFiToken: no snapshot balance");

        uint256 totalWinnerBalance = outcome == Outcome.Yes ? totalYesBalance : totalNoBalance;
        require(totalWinnerBalance > 0, "PolitiFiToken: no winners");

        hasClaimed[msg.sender] = true;

        uint256 prize = (prizePool * snapshot) / totalWinnerBalance;
        if (prize > 0) {
            prizePool -= prize;
            _transfer(address(this), msg.sender, prize);
            emit WinnerClaimed(msg.sender, prize);
        }
    }

    function cancelEvent() external onlyOwner {
        require(outcome == Outcome.Pending, "PolitiFiToken: already resolved");
        outcome = Outcome.Cancelled;
        emit EventCancelled();
    }

    // ─── Fee on transfer → prize pool ────────────────────────────────────────

    function _update(address from, address to, uint256 amount) internal override {
        if (
            cutoffReached &&
            outcome == Outcome.Pending &&
            from != address(0) &&
            to != address(0) &&
            from != address(this)
        ) {
            revert("PolitiFiToken: transfers frozen until resolution");
        }
        if (
            from != address(0) &&
            to != address(0) &&
            (outcome == Outcome.Yes || outcome == Outcome.No)
        ) {
            Side losingSide = outcome == Outcome.Yes ? Side.No : Side.Yes;
            if (holderSide[from] == losingSide && !loserBurnApplied[from]) {
                revert("PolitiFiToken: loser must burn before transfer");
            }
        }

        // Prize payouts are transfers out of this contract. Taxing them again
        // would skim the prize and desync prizePool from the token balance.
        if (from == address(0) || to == address(0) || from == address(this) || predictionFeeBps == 0) {
            super._update(from, to, amount);
            return;
        }
        uint256 fee = (amount * predictionFeeBps) / 10_000;
        if (fee > 0) {
            super._update(from, address(this), fee);
            prizePool += fee;
            super._update(from, to, amount - fee);
        } else {
            super._update(from, to, amount);
        }
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function setEventMeta(string calldata name_, uint256 resolutionTime_) external onlyOwner {
        require(outcome == Outcome.Pending, "PolitiFiToken: already resolved");
        require(!cutoffReached, "PolitiFiToken: cutoff passed");
        require(resolutionTime_ > block.timestamp, "PolitiFiToken: resolution not in future");
        eventName      = name_;
        resolutionTime = resolutionTime_;
    }
}
