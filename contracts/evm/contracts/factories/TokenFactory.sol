// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenFactory
 * @notice Factory contract that deploys parameterized token contracts using the minimal proxy (clone) pattern.
 *         One factory is deployed per chain; users call createToken() and never need to trust the deployer
 *         with private keys.
 */
contract TokenFactory is Ownable {
    using Clones for address;

    // ─── Token flavors ────────────────────────────────────────────────────────
    enum TokenFlavor {
        Standard,        // plain ERC20
        Taxable,         // buy/sell tax
        Deflationary,    // auto-burn on transfer
        Reflection,      // redistribution to holders
        BondingCurve,    // meme token with bonding curve
        AIAgent,         // AI agent wallet with auto-burn + meme posting
        PolitiFi,        // political prediction market with prize pool + loser burn
        UtilityHybrid,   // staking + auto-burn + governance (SHIB model)
        PumpMigrate      // bonding curve → CEX graduation (pump.fun style)
    }

    // ─── Deployment parameters ────────────────────────────────────────────────
    struct TokenParams {
        string  name;
        string  symbol;
        uint256 totalSupply;
        uint8   decimals;
        // Tax / burn settings (basis points, 100 = 1 %)
        uint16  buyTaxBps;
        uint16  sellTaxBps;
        uint16  burnBps;
        uint16  reflectionBps;
        address marketingWallet;
        // Liquidity settings (basis points of total supply)
        uint16  liquidityBps;
        // Misc
        address owner;
        TokenFlavor flavor;
    }

    // ─── Platform fee ─────────────────────────────────────────────────────────
    uint256 public launchFee;          // minimum flat fee in wei (native token)
    address public feeRecipient;

    // ─── v2: percentage-based fee + referral ──────────────────────────────────
    uint16 public launchFeeBps;        // 50 = 0.5 % of msg.value (applied when > flat fee)
    uint16 public referralShareBps;    // 2000 = 20 % of the collected fee goes to referrer
    mapping(address => uint256) public referralEarnings;

    // ─── Template implementations ─────────────────────────────────────────────
    address public standardImpl;
    address public taxableImpl;
    address public deflationaryImpl;
    address public reflectionImpl;
    address public bondingCurveImpl;
    address public aiAgentImpl;
    address public politiFiImpl;
    address public utilityHybridImpl;
    address public pumpMigrateImpl;

    // ─── Deployment tracking ──────────────────────────────────────────────────
    mapping(address => address[]) public tokensByOwner;
    address[] public allTokens;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokenCreated(
        address indexed tokenAddress,
        address indexed tokenOwner,
        TokenFlavor flavor,
        string  name,
        string  symbol,
        uint256 totalSupply
    );
    event ImplementationUpdated(TokenFlavor indexed flavor, address impl);
    event LaunchFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);
    event LaunchFeeBpsUpdated(uint16 newBps);
    event ReferralShareBpsUpdated(uint16 newBps);
    event ReferralEarned(address indexed referrer, address indexed user, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _standardImpl,
        address _taxableImpl,
        address _deflationaryImpl,
        address _reflectionImpl,
        address _bondingCurveImpl,
        address _aiAgentImpl,
        address _politiFiImpl,
        address _utilityHybridImpl,
        address _pumpMigrateImpl,
        uint256 _launchFee,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_standardImpl      != address(0), "TokenFactory: zero standard impl");
        require(_taxableImpl       != address(0), "TokenFactory: zero taxable impl");
        require(_deflationaryImpl  != address(0), "TokenFactory: zero deflationary impl");
        require(_reflectionImpl    != address(0), "TokenFactory: zero reflection impl");
        require(_bondingCurveImpl  != address(0), "TokenFactory: zero bonding curve impl");
        require(_aiAgentImpl       != address(0), "TokenFactory: zero ai agent impl");
        require(_politiFiImpl      != address(0), "TokenFactory: zero politifi impl");
        require(_utilityHybridImpl != address(0), "TokenFactory: zero utility hybrid impl");
        require(_pumpMigrateImpl   != address(0), "TokenFactory: zero pump migrate impl");
        require(_feeRecipient      != address(0), "TokenFactory: zero fee recipient");

        standardImpl      = _standardImpl;
        taxableImpl       = _taxableImpl;
        deflationaryImpl  = _deflationaryImpl;
        reflectionImpl    = _reflectionImpl;
        bondingCurveImpl  = _bondingCurveImpl;
        aiAgentImpl       = _aiAgentImpl;
        politiFiImpl      = _politiFiImpl;
        utilityHybridImpl = _utilityHybridImpl;
        pumpMigrateImpl   = _pumpMigrateImpl;
        launchFee         = _launchFee;
        feeRecipient      = _feeRecipient;
        launchFeeBps      = 50;
        referralShareBps  = 2000;
    }

    // ─── Core: create token ───────────────────────────────────────────────────
    /**
     * @notice Deploy a new token using the minimal proxy pattern.
     * @param params Token configuration (see TokenParams struct).
     * @return tokenAddress Address of the newly deployed token.
     */
    function createToken(TokenParams calldata params)
        external
        payable
        returns (address tokenAddress)
    {
        require(msg.value >= launchFee, "TokenFactory: insufficient launch fee");
        _validateParams(params);

        address impl = _implFor(params.flavor);
        tokenAddress = _cloneAndInit(impl, params);

        uint256 fee = _computeFee(msg.value);
        _returnExcess(fee);
        _forwardFee(fee);

        emit TokenCreated(
            tokenAddress,
            params.owner,
            params.flavor,
            params.name,
            params.symbol,
            params.totalSupply
        );
    }

    /**
     * @notice Deploy a new token and credit a referrer with a share of the fee.
     * @param params   Token configuration.
     * @param referrer Address to credit with referral earnings (use address(0) for none).
     * @return tokenAddress Address of the newly deployed token.
     */
    function createTokenWithReferral(TokenParams calldata params, address referrer)
        external
        payable
        returns (address tokenAddress)
    {
        require(msg.value >= launchFee, "TokenFactory: insufficient launch fee");
        _validateParams(params);

        address impl = _implFor(params.flavor);
        tokenAddress = _cloneAndInit(impl, params);

        uint256 fee = _computeFee(msg.value);
        _returnExcess(fee);

        // Split referral
        if (referrer != address(0) && referrer != msg.sender && referralShareBps > 0 && fee > 0) {
            uint256 referralAmt = (fee * referralShareBps) / 10_000;
            referralEarnings[referrer] += referralAmt;
            fee -= referralAmt;
            emit ReferralEarned(referrer, msg.sender, referralAmt);
        }

        _forwardFee(fee);

        emit TokenCreated(
            tokenAddress,
            params.owner,
            params.flavor,
            params.name,
            params.symbol,
            params.totalSupply
        );
    }

    /**
     * @notice Referrers call this to withdraw their accumulated earnings.
     */
    function claimReferralEarnings() external {
        uint256 amount = referralEarnings[msg.sender];
        require(amount > 0, "TokenFactory: nothing to claim");
        referralEarnings[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "TokenFactory: claim transfer failed");
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function getTokensByOwner(address _owner) external view returns (address[] memory) {
        return tokensByOwner[_owner];
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function totalTokensDeployed() external view returns (uint256) {
        return allTokens.length;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function setImplementation(TokenFlavor flavor, address impl) external onlyOwner {
        require(impl != address(0), "TokenFactory: zero impl");
        if      (flavor == TokenFlavor.Standard)      standardImpl      = impl;
        else if (flavor == TokenFlavor.Taxable)        taxableImpl       = impl;
        else if (flavor == TokenFlavor.Deflationary)   deflationaryImpl  = impl;
        else if (flavor == TokenFlavor.Reflection)     reflectionImpl    = impl;
        else if (flavor == TokenFlavor.BondingCurve)   bondingCurveImpl  = impl;
        else if (flavor == TokenFlavor.AIAgent)         aiAgentImpl       = impl;
        else if (flavor == TokenFlavor.PolitiFi)        politiFiImpl      = impl;
        else if (flavor == TokenFlavor.UtilityHybrid)  utilityHybridImpl = impl;
        else if (flavor == TokenFlavor.PumpMigrate)    pumpMigrateImpl   = impl;
        emit ImplementationUpdated(flavor, impl);
    }

    function setLaunchFee(uint256 _fee) external onlyOwner {
        launchFee = _fee;
        emit LaunchFeeUpdated(_fee);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "TokenFactory: zero recipient");
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    function setLaunchFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= 1000, "TokenFactory: bps too high");
        launchFeeBps = _bps;
        emit LaunchFeeBpsUpdated(_bps);
    }

    function setReferralShareBps(uint16 _bps) external onlyOwner {
        require(_bps <= 5000, "TokenFactory: referral share too high");
        referralShareBps = _bps;
        emit ReferralShareBpsUpdated(_bps);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _validateParams(TokenParams calldata params) internal pure {
        require(bytes(params.name).length > 0,   "TokenFactory: empty name");
        require(bytes(params.symbol).length > 0,  "TokenFactory: empty symbol");
        require(params.totalSupply > 0,           "TokenFactory: zero supply");
        require(params.owner != address(0),        "TokenFactory: zero owner");
        require(
            uint8(params.flavor) <= uint8(TokenFlavor.PumpMigrate),
            "TokenFactory: unknown flavor"
        );
        require(
            uint256(params.buyTaxBps)     +
            uint256(params.sellTaxBps)    +
            uint256(params.burnBps)       +
            uint256(params.reflectionBps) <= 3000,
            "TokenFactory: total fees exceed 30 %"
        );
    }

    function _cloneAndInit(address impl, TokenParams calldata params) internal returns (address tokenAddress) {
        tokenAddress = impl.clone();
        (bool success, ) = tokenAddress.call(
            abi.encodeWithSignature(
                "initialize(string,string,uint256,uint8,uint16,uint16,uint16,uint16,address,uint16,address)",
                params.name,
                params.symbol,
                params.totalSupply,
                params.decimals == 0 ? 18 : params.decimals,
                params.buyTaxBps,
                params.sellTaxBps,
                params.burnBps,
                params.reflectionBps,
                params.marketingWallet,
                params.liquidityBps,
                params.owner
            )
        );
        require(success, "TokenFactory: initialization failed");
        tokensByOwner[params.owner].push(tokenAddress);
        allTokens.push(tokenAddress);
    }

    /// @dev Compute the fee to collect: max(flatFee, pctFee), capped at msg.value.
    function _computeFee(uint256 value) internal view returns (uint256 fee) {
        fee = launchFee;
        if (launchFeeBps > 0) {
            uint256 pctFee = (value * launchFeeBps) / 10_000;
            if (pctFee > fee) fee = pctFee;
        }
        if (fee > value) fee = value;
    }

    /// @dev Return any ETH above the fee to the caller.
    function _returnExcess(uint256 fee) internal {
        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "TokenFactory: ETH return failed");
        }
    }

    /// @dev Forward fee to feeRecipient.
    function _forwardFee(uint256 fee) internal {
        if (fee > 0) {
            (bool sent, ) = feeRecipient.call{value: fee}("");
            require(sent, "TokenFactory: fee transfer failed");
        }
    }

    function _implFor(TokenFlavor flavor) internal view returns (address) {
        if (flavor == TokenFlavor.Standard)      return standardImpl;
        if (flavor == TokenFlavor.Taxable)        return taxableImpl;
        if (flavor == TokenFlavor.Deflationary)   return deflationaryImpl;
        if (flavor == TokenFlavor.Reflection)     return reflectionImpl;
        if (flavor == TokenFlavor.BondingCurve)   return bondingCurveImpl;
        if (flavor == TokenFlavor.AIAgent)         return aiAgentImpl;
        if (flavor == TokenFlavor.PolitiFi)        return politiFiImpl;
        if (flavor == TokenFlavor.UtilityHybrid)  return utilityHybridImpl;
        return pumpMigrateImpl;
    }
}
