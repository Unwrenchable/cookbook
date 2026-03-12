// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title TaxableERC20
 * @notice ERC20 with configurable buy/sell taxes forwarded to a marketing wallet.
 *         Tax rates are expressed in basis points (100 bps = 1 %).
 */
contract TaxableERC20 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    uint8   private _tokenDecimals;
    uint16  public  buyTaxBps;
    uint16  public  sellTaxBps;
    address public  marketingWallet;

    // Simple DEX detection: any address can be flagged as a DEX pair
    mapping(address => bool) public isDexPair;

    event DexPairSet(address indexed pair, bool value);
    event TaxUpdated(uint16 buyTaxBps, uint16 sellTaxBps);
    event MarketingWalletUpdated(address newWallet);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string  calldata name_,
        string  calldata symbol_,
        uint256 totalSupply_,
        uint8   decimals_,
        uint16  buyTaxBps_,
        uint16  sellTaxBps_,
        uint16, // burnBps – unused
        uint16, // reflectionBps – unused
        address marketingWallet_,
        uint16, // liquidityBps – unused
        address owner_
    ) external initializer {
        require(owner_ != address(0),           "TaxableERC20: zero owner");
        require(buyTaxBps_  <= 2500,            "TaxableERC20: buy tax > 25 %");
        require(sellTaxBps_ <= 2500,            "TaxableERC20: sell tax > 25 %");

        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);

        _tokenDecimals = decimals_ == 0 ? 18 : decimals_;
        buyTaxBps      = buyTaxBps_;
        sellTaxBps     = sellTaxBps_;
        marketingWallet = marketingWallet_ != address(0) ? marketingWallet_ : owner_;

        _mint(owner_, totalSupply_ * 10 ** _tokenDecimals);
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // ─── Tax logic ────────────────────────────────────────────────────────────

    function _update(address from, address to, uint256 amount) internal override {
        uint256 taxAmount = 0;

        if (isDexPair[from] && buyTaxBps > 0) {
            // Buy: from is the DEX pair
            taxAmount = (amount * buyTaxBps) / 10_000;
        } else if (isDexPair[to] && sellTaxBps > 0) {
            // Sell: to is the DEX pair
            taxAmount = (amount * sellTaxBps) / 10_000;
        }

        if (taxAmount > 0) {
            super._update(from, marketingWallet, taxAmount);
            super._update(from, to, amount - taxAmount);
        } else {
            super._update(from, to, amount);
        }
    }

    // ─── Owner controls ───────────────────────────────────────────────────────

    function setDexPair(address pair, bool value) external onlyOwner {
        isDexPair[pair] = value;
        emit DexPairSet(pair, value);
    }

    function setTax(uint16 _buyTaxBps, uint16 _sellTaxBps) external onlyOwner {
        require(_buyTaxBps  <= 2500, "TaxableERC20: buy tax > 25 %");
        require(_sellTaxBps <= 2500, "TaxableERC20: sell tax > 25 %");
        buyTaxBps  = _buyTaxBps;
        sellTaxBps = _sellTaxBps;
        emit TaxUpdated(_buyTaxBps, _sellTaxBps);
    }

    function setMarketingWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "TaxableERC20: zero wallet");
        marketingWallet = wallet;
        emit MarketingWalletUpdated(wallet);
    }
}
