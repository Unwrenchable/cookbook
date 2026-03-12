// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title UtilityHybridToken
 * @notice ERC20 with built-in staking, auto-burn, and team wallet transparency cap.
 *
 * Narrative: "Utility Hybrid" — survivors of hype cycles add real utility.
 * This token implements the SHIB model:
 *  - Auto-burn on every transfer (deflationary)
 *  - On-chain staking for APY rewards (sustainable ecosystem)
 *  - Enforced team wallet cap (no massive team wallets — community demands transparency)
 *  - Simple governance proposal + vote system
 *
 * Staking mechanics:
 *  - Stake tokens → earn rewardRateBps per day on staked amount
 *  - Unstake any time (no lock)
 *  - Rewards come from the reward pool (owner fills it)
 */
contract UtilityHybridToken is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8  private _tokenDecimals;

    // ─── Burn config ──────────────────────────────────────────────────────────
    uint16 public burnBps;          // auto-burn per transfer (basis points)

    // ─── Team wallet transparency ─────────────────────────────────────────────
    uint16 public teamWalletCapBps; // max % of supply any single address can hold
    mapping(address => bool) public isExcludedFromCap; // team / LP / staking contract

    // ─── Staking ──────────────────────────────────────────────────────────────
    uint16  public rewardRateBps;   // reward per day in bps of staked amount
    uint256 public rewardPool;      // tokens set aside for staking rewards

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 pendingRewards;
        uint256 lastClaimTime;
    }
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;

    // ─── Governance ───────────────────────────────────────────────────────────
    struct Proposal {
        string  description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 endTime;
        bool    executed;
    }
    Proposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardPoolFunded(uint256 amount);
    event ProposalCreated(uint256 indexed id, string description, uint256 endTime);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 totalSupply_,
        uint8   decimals_,
        uint16  rewardRateBps_,   // reuse buyTaxBps: staking APY in bps/day
        uint16  teamCapBps_,      // reuse sellTaxBps: max % per wallet
        uint16  burnBps_,
        uint16, // reflectionBps – unused
        address, // marketingWallet – unused
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_          != address(0), "UtilityHybridToken: zero owner");
        require(burnBps_        <= 500,        "UtilityHybridToken: burn > 5 %");
        require(rewardRateBps_  <= 500,        "UtilityHybridToken: reward > 5 %/day");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals    = decimals_ == 0 ? 18 : decimals_;
        burnBps           = burnBps_;
        rewardRateBps     = rewardRateBps_ == 0 ? 10 : rewardRateBps_; // default 0.1 %/day
        teamWalletCapBps  = teamCapBps_ == 0 ? 500 : teamCapBps_;      // default 5 % cap

        isExcludedFromCap[owner_]          = true;
        isExcludedFromCap[address(this)]   = true;
        isExcludedFromCap[address(0)]      = true;

        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }

    // ─── Auto-burn on transfer ────────────────────────────────────────────────

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0) || burnBps == 0) {
            super._update(from, to, amount);
            _enforceTeamCap(to);
            return;
        }
        uint256 burnAmount = (amount * burnBps) / 10_000;
        if (burnAmount > 0) {
            super._update(from, address(0), burnAmount);
            super._update(from, to, amount - burnAmount);
        } else {
            super._update(from, to, amount);
        }
        _enforceTeamCap(to);
    }

    function _enforceTeamCap(address to) internal view {
        if (to == address(0) || isExcludedFromCap[to]) return;
        uint256 cap = (totalSupply() * teamWalletCapBps) / 10_000;
        require(balanceOf(to) <= cap, "UtilityHybridToken: wallet exceeds team cap");
    }

    // ─── Staking ──────────────────────────────────────────────────────────────

    function stake(uint256 amount) external {
        require(amount > 0, "UtilityHybridToken: zero amount");
        _settlePending(msg.sender);
        _transfer(msg.sender, address(this), amount);
        stakes[msg.sender].amount    += amount;
        stakes[msg.sender].stakedAt   = block.timestamp;
        stakes[msg.sender].lastClaimTime = block.timestamp;
        totalStaked += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount >= amount, "UtilityHybridToken: insufficient stake");
        _settlePending(msg.sender);
        s.amount -= amount;
        totalStaked -= amount;
        isExcludedFromCap[msg.sender] = (s.amount > 0); // keep excluded while staking
        _transfer(address(this), msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external {
        _settlePending(msg.sender);
        uint256 pending = stakes[msg.sender].pendingRewards;
        require(pending > 0,               "UtilityHybridToken: no rewards");
        require(rewardPool >= pending,     "UtilityHybridToken: reward pool empty");
        stakes[msg.sender].pendingRewards = 0;
        rewardPool -= pending;
        _transfer(address(this), msg.sender, pending);
        emit RewardsClaimed(msg.sender, pending);
    }

    function pendingRewards(address user) external view returns (uint256) {
        StakeInfo storage s = stakes[user];
        if (s.amount == 0) return s.pendingRewards;
        uint256 elapsed = block.timestamp - s.lastClaimTime;
        uint256 earned  = (s.amount * rewardRateBps * elapsed) / (10_000 * 1 days);
        return s.pendingRewards + earned;
    }

    function _settlePending(address user) internal {
        StakeInfo storage s = stakes[user];
        if (s.amount > 0) {
            uint256 elapsed = block.timestamp - s.lastClaimTime;
            uint256 earned  = (s.amount * rewardRateBps * elapsed) / (10_000 * 1 days);
            s.pendingRewards += earned;
        }
        s.lastClaimTime = block.timestamp;
    }

    // ─── Governance ───────────────────────────────────────────────────────────

    function createProposal(string calldata description, uint256 durationDays) external {
        require(balanceOf(msg.sender) + stakes[msg.sender].amount > 0,
                "UtilityHybridToken: no governance power");
        uint256 endTime = block.timestamp + (durationDays * 1 days);
        proposals.push(Proposal(description, 0, 0, endTime, false));
        emit ProposalCreated(proposals.length - 1, description, endTime);
    }

    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposals.length, "UtilityHybridToken: invalid proposal");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.endTime,   "UtilityHybridToken: voting ended");
        require(!hasVoted[proposalId][msg.sender], "UtilityHybridToken: already voted");

        uint256 weight = balanceOf(msg.sender) + stakes[msg.sender].amount;
        require(weight > 0, "UtilityHybridToken: no voting power");

        hasVoted[proposalId][msg.sender] = true;
        if (support) p.votesFor     += weight;
        else          p.votesAgainst += weight;
        emit Voted(proposalId, msg.sender, support, weight);
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function fundRewardPool(uint256 amount) external onlyOwner {
        _transfer(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }

    function setExcludedFromCap(address account, bool excluded) external onlyOwner {
        isExcludedFromCap[account] = excluded;
    }

    function setRewardRate(uint16 bps) external onlyOwner {
        require(bps <= 500, "UtilityHybridToken: reward > 5 %/day");
        rewardRateBps = bps;
    }

    function setBurnBps(uint16 bps) external onlyOwner {
        require(bps <= 500, "UtilityHybridToken: burn > 5 %");
        burnBps = bps;
    }
}
