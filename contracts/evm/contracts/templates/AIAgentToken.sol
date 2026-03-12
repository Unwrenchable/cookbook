// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title AIAgentToken
 * @notice ERC20 token with a designated on-chain AI agent wallet that can
 *         execute pre-approved actions autonomously (buy/burn/redistribute)
 *         within hard-coded safety limits.
 *
 * Narrative: "agentic AI" — the token has its own agent that acts on-chain
 * using a $WILL / AI16Z style architecture. The agent wallet is set at launch
 * and cannot exceed its authority caps without owner approval.
 *
 * Agent actions:
 *  - autoBurn(amount)         – agent burns tokens (deflationary pressure)
 *  - autoRedistribute(amount) – agent sends from treasury to holders
 *  - postMeme(uri)            – agent posts a new meme URI on-chain (event log)
 */
contract AIAgentToken is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8 private _tokenDecimals;

    // ─── Agent config ─────────────────────────────────────────────────────────
    address public agentWallet;
    string  public agentName;        // e.g. "DonutAI", "HAL9000", "WILL"
    string  public memeUri;          // IPFS URI of the latest AI-generated meme
    string  public agentDescription; // stored on-chain for transparency

    // Treasury held by this contract for agent redistribution
    // (owner sends tokens here; agent redistributes them)
    uint256 public treasuryBalance;

    // Safety cap: agent cannot auto-burn more than this % of supply per day (bps)
    uint16  public agentBurnCapBps;       // e.g. 100 = 1 %/day cap
    uint256 public lastAgentActionTime;
    uint256 public agentDailyBurnUsed;

    // ─── Events ───────────────────────────────────────────────────────────────
    event AgentAction(address indexed agent, string action, uint256 amount, string meta);
    event AgentWalletUpdated(address newAgent);
    event MemePosted(string uri, uint256 timestamp);
    event TreasuryDeposit(address from, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 totalSupply_,
        uint8   decimals_,
        uint16, // buyTaxBps   – unused
        uint16, // sellTaxBps  – unused
        uint16  agentBurnCapBps_, // reuse burnBps slot for agent burn cap
        uint16, // reflectionBps – unused
        address agentWallet_,    // reuse marketingWallet slot for agent wallet
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_       != address(0), "AIAgentToken: zero owner");
        require(agentWallet_ != address(0), "AIAgentToken: zero agent wallet");
        require(agentBurnCapBps_ <= 500,    "AIAgentToken: burn cap > 5 %/day");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals   = decimals_ == 0 ? 18 : decimals_;
        agentWallet      = agentWallet_;
        agentBurnCapBps  = agentBurnCapBps_ == 0 ? 100 : agentBurnCapBps_;

        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }

    // ─── Agent-only actions ───────────────────────────────────────────────────

    modifier onlyAgent() {
        require(msg.sender == agentWallet, "AIAgentToken: not agent");
        _;
    }

    /**
     * @notice Agent auto-burns tokens from the treasury (deflationary signal).
     *         Capped at agentBurnCapBps % of total supply per 24 hours.
     */
    function autoBurn(uint256 amount, string calldata reason) external onlyAgent {
        _resetDailyLimitIfNeeded();

        uint256 cap = (totalSupply() * agentBurnCapBps) / 10_000;
        require(agentDailyBurnUsed + amount <= cap, "AIAgentToken: daily burn cap exceeded");
        require(balanceOf(address(this)) >= amount,  "AIAgentToken: insufficient treasury");

        agentDailyBurnUsed += amount;
        _burn(address(this), amount);
        emit AgentAction(agentWallet, "autoBurn", amount, reason);
    }

    /**
     * @notice Agent redistributes treasury tokens to a list of holder addresses.
     */
    function autoRedistribute(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyAgent {
        require(recipients.length == amounts.length, "AIAgentToken: length mismatch");
        require(recipients.length <= 200,             "AIAgentToken: too many recipients");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];
        require(balanceOf(address(this)) >= total, "AIAgentToken: insufficient treasury");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && amounts[i] > 0) {
                _transfer(address(this), recipients[i], amounts[i]);
            }
        }
        emit AgentAction(agentWallet, "autoRedistribute", total, reason);
    }

    /**
     * @notice Agent posts a new AI-generated meme URI on-chain.
     */
    function postMeme(string calldata uri) external onlyAgent {
        memeUri = uri;
        emit MemePosted(uri, block.timestamp);
        emit AgentAction(agentWallet, "postMeme", 0, uri);
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function depositToTreasury(uint256 amount) external {
        _transfer(msg.sender, address(this), amount);
        treasuryBalance = balanceOf(address(this));
        emit TreasuryDeposit(msg.sender, amount);
    }

    function setAgentWallet(address newAgent) external onlyOwner {
        require(newAgent != address(0), "AIAgentToken: zero agent");
        agentWallet = newAgent;
        emit AgentWalletUpdated(newAgent);
    }

    function setAgentMeta(string calldata name_, string calldata description_) external onlyOwner {
        agentName        = name_;
        agentDescription = description_;
    }

    function setAgentBurnCap(uint16 bps) external onlyOwner {
        require(bps <= 500, "AIAgentToken: burn cap > 5 %/day");
        agentBurnCapBps = bps;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _resetDailyLimitIfNeeded() internal {
        if (block.timestamp >= lastAgentActionTime + 1 days) {
            agentDailyBurnUsed  = 0;
            lastAgentActionTime = block.timestamp;
        }
    }
}
