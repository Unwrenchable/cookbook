// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DomainRegistry
 * @notice Production-ready domain registration contract with lifetime ownership
 * @dev Integrated into Goonforge (from supreme-goggles). Deploy separate instances per chain.
 * 
 * This is the naming layer for the Goonforge degen launchpad ecosystem.
 * After launching a token (bonding curve, AI agent, Pump->CEX, etc.),
 * users can immediately claim custom .fizz, .goon, or ANY extension with lifetime ownership.
 *
 * FEATURES (from supreme-goggles):
 * - Lifetime domain ownership (no renewal fees)
 * - Custom domain extensions support (unlimited TLDs)
 * - Domain records (wallet, IPFS, social, avatar, etc.)
 * - Domain transfers
 * - Emergency pause
 * - Treasury payments (instant to your wallet)
 *
 * Ecosystem tie-in:
 * - Perfect companion to Goonforge token launches + the FIZZ wasteland protocol.
 * - .fizz TLDs for Atomic Fizz / Goonforge projects.
 * - "Supreme Goggles" = the vision/HUD layer over the on-chain wasteland.
 *
 * Original source: https://github.com/Unwrenchable/supreme-goggles
 * Integrated here to keep the full launcher + naming experience in one dApp.
 */

contract DomainRegistry {
    address public owner;
    address public treasury;
    bool public paused;
    uint256 public registrationFee;

    struct Domain {
        address owner;
        uint256 registrationDate;
        uint256 expirationDate; // type(uint256).max for lifetime
        bool isActive;
        string extension;
    }

    struct DomainRecords {
        string walletAddress;
        string ipfsHash;
        string twitter;
        string discord;
        string email;
        string website;
        string avatar;
    }

    mapping(string => Domain) public domains;
    mapping(string => DomainRecords) public domainRecords;
    mapping(address => string[]) private userDomains;

    event DomainRegistered(string indexed domainName, address indexed owner, uint256 paymentAmount, string extension, uint256 registrationDate);
    event DomainTransferred(string indexed domainName, address indexed fromAddress, address indexed toAddress, uint256 timestamp);
    event RecordUpdated(string indexed domainName, string recordType, string value, uint256 timestamp);
    event PaymentReceived(address indexed from, uint256 amount, string domainName, uint256 timestamp);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, uint256 timestamp);
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee, uint256 timestamp);
    event Paused(bool paused, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error InvalidAddress();
    error InvalidDomainName();
    error DomainAlreadyRegistered();
    error DomainNotRegistered();
    error NotDomainOwner();
    error InsufficientPayment();
    error IsPaused();
    error OnlyOwner();
    error TransferFailed();

    modifier onlyOwner() { if (msg.sender != owner) revert OnlyOwner(); _; }
    modifier whenNotPaused() { if (paused) revert IsPaused(); _; }
    modifier validAddress(address addr) { if (addr == address(0)) revert InvalidAddress(); _; }
    modifier onlyDomainOwner(string memory domainName) {
        if (!domains[domainName].isActive) revert DomainNotRegistered();
        if (domains[domainName].owner != msg.sender) revert NotDomainOwner();
        _;
    }

    constructor(address _treasury, uint256 _registrationFee) validAddress(_treasury) {
        owner = msg.sender;
        treasury = _treasury;
        registrationFee = _registrationFee;
        paused = false;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function registerDomain(string calldata domainName, string calldata extension) external payable whenNotPaused {
        if (bytes(domainName).length == 0) revert InvalidDomainName();
        if (domains[domainName].isActive) revert DomainAlreadyRegistered();
        if (msg.value < registrationFee) revert InsufficientPayment();

        (bool success, ) = payable(treasury).call{value: msg.value}("");
        if (!success) revert TransferFailed();

        domains[domainName] = Domain({
            owner: msg.sender,
            registrationDate: block.timestamp,
            expirationDate: type(uint256).max,
            isActive: true,
            extension: extension
        });

        userDomains[msg.sender].push(domainName);

        emit PaymentReceived(msg.sender, msg.value, domainName, block.timestamp);
        emit DomainRegistered(domainName, msg.sender, msg.value, extension, block.timestamp);
    }

    function checkAvailability(string calldata domainName) external view returns (bool) {
        return !domains[domainName].isActive;
    }

    function getDomainInfo(string calldata domainName) external view returns (Domain memory) {
        return domains[domainName];
    }

    function getDomainRecords(string calldata domainName) external view returns (DomainRecords memory) {
        return domainRecords[domainName];
    }

    function setWalletAddress(string calldata domainName, string calldata walletAddress) external onlyDomainOwner(domainName) {
        domainRecords[domainName].walletAddress = walletAddress;
        emit RecordUpdated(domainName, "wallet", walletAddress, block.timestamp);
    }

    function setIPFSHash(string calldata domainName, string calldata ipfsHash) external onlyDomainOwner(domainName) {
        domainRecords[domainName].ipfsHash = ipfsHash;
        emit RecordUpdated(domainName, "ipfs", ipfsHash, block.timestamp);
    }

    function setSocialRecords(string calldata domainName, string calldata twitter, string calldata discord) external onlyDomainOwner(domainName) {
        domainRecords[domainName].twitter = twitter;
        domainRecords[domainName].discord = discord;
        emit RecordUpdated(domainName, "social", "updated", block.timestamp);
    }

    function setContactInfo(string calldata domainName, string calldata email, string calldata website) external onlyDomainOwner(domainName) {
        domainRecords[domainName].email = email;
        domainRecords[domainName].website = website;
        emit RecordUpdated(domainName, "contact", "updated", block.timestamp);
    }

    function setAvatar(string calldata domainName, string calldata avatar) external onlyDomainOwner(domainName) {
        domainRecords[domainName].avatar = avatar;
        emit RecordUpdated(domainName, "avatar", avatar, block.timestamp);
    }

    function transferDomain(string calldata domainName, address newOwner) external onlyDomainOwner(domainName) validAddress(newOwner) {
        address oldOwner = domains[domainName].owner;
        domains[domainName].owner = newOwner;

        string[] storage oldList = userDomains[oldOwner];
        for (uint256 i = 0; i < oldList.length; i++) {
            if (keccak256(bytes(oldList[i])) == keccak256(bytes(domainName))) {
                oldList[i] = oldList[oldList.length - 1];
                oldList.pop();
                break;
            }
        }
        userDomains[newOwner].push(domainName);

        emit DomainTransferred(domainName, oldOwner, newOwner, block.timestamp);
    }

    function getUserDomains(address userAddress) external view returns (string[] memory) {
        return userDomains[userAddress];
    }

    function updateTreasury(address newTreasury) external onlyOwner validAddress(newTreasury) {
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury, block.timestamp);
    }

    function updateRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 old = registrationFee;
        registrationFee = newFee;
        emit RegistrationFeeUpdated(old, newFee, block.timestamp);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused, block.timestamp);
    }

    function transferOwnership(address newOwner) external onlyOwner validAddress(newOwner) {
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    function isOwnerOf(address userAddress, string calldata domainName) external view returns (bool) {
        return domains[domainName].isActive && domains[domainName].owner == userAddress;
    }

    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value, "direct", block.timestamp);
    }

    function version() external pure returns (string memory) { return "1.0.0-gf-integrated"; }
}
