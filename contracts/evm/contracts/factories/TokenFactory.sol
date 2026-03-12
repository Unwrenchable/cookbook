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
        Standard,       // plain ERC20
        Taxable,        // buy/sell tax
        Deflationary,   // auto-burn on transfer
        Reflection,     // redistribution to holders
        BondingCurve    // meme token with bonding curve
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
    uint256 public launchFee;          // in wei (native token)
    address public feeRecipient;

    // ─── Template implementations ─────────────────────────────────────────────
    address public standardImpl;
    address public taxableImpl;
    address public deflationaryImpl;
    address public reflectionImpl;
    address public bondingCurveImpl;

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

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _standardImpl,
        address _taxableImpl,
        address _deflationaryImpl,
        address _reflectionImpl,
        address _bondingCurveImpl,
        uint256 _launchFee,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_standardImpl     != address(0), "TokenFactory: zero standard impl");
        require(_taxableImpl      != address(0), "TokenFactory: zero taxable impl");
        require(_deflationaryImpl != address(0), "TokenFactory: zero deflationary impl");
        require(_reflectionImpl   != address(0), "TokenFactory: zero reflection impl");
        require(_bondingCurveImpl != address(0), "TokenFactory: zero bonding curve impl");
        require(_feeRecipient     != address(0), "TokenFactory: zero fee recipient");

        standardImpl     = _standardImpl;
        taxableImpl      = _taxableImpl;
        deflationaryImpl = _deflationaryImpl;
        reflectionImpl   = _reflectionImpl;
        bondingCurveImpl = _bondingCurveImpl;
        launchFee        = _launchFee;
        feeRecipient     = _feeRecipient;
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
        require(bytes(params.name).length > 0,   "TokenFactory: empty name");
        require(bytes(params.symbol).length > 0,  "TokenFactory: empty symbol");
        require(params.totalSupply > 0,           "TokenFactory: zero supply");
        require(params.owner != address(0),        "TokenFactory: zero owner");
        require(
            uint8(params.flavor) <= uint8(TokenFlavor.BondingCurve),
            "TokenFactory: unknown flavor"
        );
        require(
            uint256(params.buyTaxBps)       +
            uint256(params.sellTaxBps)      +
            uint256(params.burnBps)         +
            uint256(params.reflectionBps)   <= 3000,
            "TokenFactory: total fees exceed 30 %"
        );

        // Pick the right implementation
        address impl = _implFor(params.flavor);

        // Clone and initialise
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

        // Track deployment
        tokensByOwner[params.owner].push(tokenAddress);
        allTokens.push(tokenAddress);

        // Forward fee
        if (launchFee > 0 && msg.value > 0) {
            (bool sent, ) = feeRecipient.call{value: msg.value}("");
            require(sent, "TokenFactory: fee transfer failed");
        }

        emit TokenCreated(
            tokenAddress,
            params.owner,
            params.flavor,
            params.name,
            params.symbol,
            params.totalSupply
        );
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
        if (flavor == TokenFlavor.Standard)      standardImpl     = impl;
        else if (flavor == TokenFlavor.Taxable)       taxableImpl      = impl;
        else if (flavor == TokenFlavor.Deflationary)  deflationaryImpl = impl;
        else if (flavor == TokenFlavor.Reflection)    reflectionImpl   = impl;
        else if (flavor == TokenFlavor.BondingCurve)  bondingCurveImpl = impl;
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

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _implFor(TokenFlavor flavor) internal view returns (address) {
        if (flavor == TokenFlavor.Standard)      return standardImpl;
        if (flavor == TokenFlavor.Taxable)        return taxableImpl;
        if (flavor == TokenFlavor.Deflationary)   return deflationaryImpl;
        if (flavor == TokenFlavor.Reflection)     return reflectionImpl;
        return bondingCurveImpl;
    }
}
