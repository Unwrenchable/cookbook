import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenFactory, StandardERC20, TaxableERC20, DeflationaryERC20, ReflectionERC20, BondingCurveToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// TokenFlavor enum (mirrors the Solidity enum – keep in sync with TokenFactory.sol)
enum TokenFlavor {
  Standard      = 0,
  Taxable       = 1,
  Deflationary  = 2,
  Reflection    = 3,
  BondingCurve  = 4,
  AIAgent       = 5,
  PolitiFi      = 6,
  UtilityHybrid = 7,
  PumpMigrate   = 8,
}

describe("TokenFactory", function () {
  let factory: TokenFactory;
  let standardImpl: StandardERC20;
  let taxableImpl: TaxableERC20;
  let deflationaryImpl: DeflationaryERC20;
  let reflectionImpl: ReflectionERC20;
  let bondingCurveImpl: BondingCurveToken;
  // meta-narrative impls (typed as any since typechain may not have generated for them yet)
  let aiAgentImpl: any;
  let politiFiImpl: any;
  let utilityHybridImpl: any;
  let pumpMigrateImpl: any;

  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  const LAUNCH_FEE = ethers.parseEther("0.001");

  // Helper: build a default TokenParams struct
  function defaultParams(overrides: Partial<{
    name: string;
    symbol: string;
    totalSupply: bigint;
    decimals: number;
    buyTaxBps: number;
    sellTaxBps: number;
    burnBps: number;
    reflectionBps: number;
    marketingWallet: string;
    liquidityBps: number;
    tokenOwner: string;
    flavor: TokenFlavor;
  }> = {}) {
    return {
      name:            overrides.name            ?? "MyToken",
      symbol:          overrides.symbol          ?? "MTK",
      totalSupply:     overrides.totalSupply      ?? ethers.parseUnits("1000000", 0), // 1M (raw, decimals applied in contract)
      decimals:        overrides.decimals         ?? 18,
      buyTaxBps:       overrides.buyTaxBps        ?? 0,
      sellTaxBps:      overrides.sellTaxBps       ?? 0,
      burnBps:         overrides.burnBps          ?? 0,
      reflectionBps:   overrides.reflectionBps    ?? 0,
      marketingWallet: overrides.marketingWallet  ?? ethers.ZeroAddress,
      liquidityBps:    overrides.liquidityBps     ?? 0,
      owner:           overrides.tokenOwner       ?? user1.address,
      flavor:          overrides.flavor           ?? TokenFlavor.Standard,
    };
  }

  before(async function () {
    [owner, user1, user2, feeRecipient] = await ethers.getSigners();
  });

  beforeEach(async function () {
    // Deploy template implementations
    const StandardFactory       = await ethers.getContractFactory("StandardERC20");
    const TaxableFactory        = await ethers.getContractFactory("TaxableERC20");
    const DeflationaryFactory   = await ethers.getContractFactory("DeflationaryERC20");
    const ReflectionFactory     = await ethers.getContractFactory("ReflectionERC20");
    const BondingCurveFactory   = await ethers.getContractFactory("BondingCurveToken");
    const AIAgentFactory        = await ethers.getContractFactory("AIAgentToken");
    const PolitiFiFactory       = await ethers.getContractFactory("PolitiFiToken");
    const UtilityHybridFactory  = await ethers.getContractFactory("UtilityHybridToken");
    const PumpMigrateFactory    = await ethers.getContractFactory("PumpMigrateToken");

    standardImpl     = await StandardFactory.deploy()       as StandardERC20;
    taxableImpl      = await TaxableFactory.deploy()        as TaxableERC20;
    deflationaryImpl = await DeflationaryFactory.deploy()   as DeflationaryERC20;
    reflectionImpl   = await ReflectionFactory.deploy()     as ReflectionERC20;
    bondingCurveImpl = await BondingCurveFactory.deploy()   as BondingCurveToken;
    aiAgentImpl      = await AIAgentFactory.deploy();
    politiFiImpl     = await PolitiFiFactory.deploy();
    utilityHybridImpl = await UtilityHybridFactory.deploy();
    pumpMigrateImpl  = await PumpMigrateFactory.deploy();

    await Promise.all([
      standardImpl.waitForDeployment(),
      taxableImpl.waitForDeployment(),
      deflationaryImpl.waitForDeployment(),
      reflectionImpl.waitForDeployment(),
      bondingCurveImpl.waitForDeployment(),
      aiAgentImpl.waitForDeployment(),
      politiFiImpl.waitForDeployment(),
      utilityHybridImpl.waitForDeployment(),
      pumpMigrateImpl.waitForDeployment(),
    ]);

    // Deploy factory with all 9 implementations
    const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactoryContract.deploy(
      await standardImpl.getAddress(),
      await taxableImpl.getAddress(),
      await deflationaryImpl.getAddress(),
      await reflectionImpl.getAddress(),
      await bondingCurveImpl.getAddress(),
      await aiAgentImpl.getAddress(),
      await politiFiImpl.getAddress(),
      await utilityHybridImpl.getAddress(),
      await pumpMigrateImpl.getAddress(),
      LAUNCH_FEE,
      feeRecipient.address
    ) as TokenFactory;
    await factory.waitForDeployment();
  });

  // ─── Deployment ────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Sets implementation addresses correctly", async function () {
      expect(await factory.standardImpl()).to.equal(await standardImpl.getAddress());
      expect(await factory.taxableImpl()).to.equal(await taxableImpl.getAddress());
      expect(await factory.deflationaryImpl()).to.equal(await deflationaryImpl.getAddress());
      expect(await factory.reflectionImpl()).to.equal(await reflectionImpl.getAddress());
      expect(await factory.bondingCurveImpl()).to.equal(await bondingCurveImpl.getAddress());
      expect(await factory.aiAgentImpl()).to.equal(await aiAgentImpl.getAddress());
      expect(await factory.politiFiImpl()).to.equal(await politiFiImpl.getAddress());
      expect(await factory.utilityHybridImpl()).to.equal(await utilityHybridImpl.getAddress());
      expect(await factory.pumpMigrateImpl()).to.equal(await pumpMigrateImpl.getAddress());
    });

    it("Sets launch fee and fee recipient", async function () {
      expect(await factory.launchFee()).to.equal(LAUNCH_FEE);
      expect(await factory.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("Owner is the deployer", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });
  });

  // ─── createToken – Standard ────────────────────────────────────────────────

  describe("createToken – Standard ERC20", function () {
    it("Deploys a standard token and mints total supply to token owner", async function () {
      const params = defaultParams();
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();

      // Check event
      const event = receipt!.logs.find(
        (l: any) => l.fragment?.name === "TokenCreated"
      ) as any;
      expect(event).to.not.be.undefined;

      const tokenAddress = event.args.tokenAddress;
      const token = await ethers.getContractAt("StandardERC20", tokenAddress) as StandardERC20;

      expect(await token.name()).to.equal("MyToken");
      expect(await token.symbol()).to.equal("MTK");
      expect(await token.decimals()).to.equal(18);
      // 1_000_000 * 10^18
      expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000000", 18));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("1000000", 18));
    });

    it("Records the token in tokensByOwner and allTokens", async function () {
      const params = defaultParams({ tokenOwner: user1.address });
      await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });

      const userTokens = await factory.getTokensByOwner(user1.address);
      expect(userTokens.length).to.equal(1);

      const allTokens = await factory.getAllTokens();
      expect(allTokens.length).to.equal(1);
      expect(allTokens[0]).to.equal(userTokens[0]);
    });

    it("Forwards launch fee to feeRecipient", async function () {
      const before = await ethers.provider.getBalance(feeRecipient.address);
      await factory.connect(user1).createToken(defaultParams(), { value: LAUNCH_FEE });
      const after  = await ethers.provider.getBalance(feeRecipient.address);
      expect(after - before).to.equal(LAUNCH_FEE);
    });

    it("Reverts when insufficient launch fee is sent", async function () {
      await expect(
        factory.connect(user1).createToken(defaultParams(), { value: LAUNCH_FEE - 1n })
      ).to.be.revertedWith("TokenFactory: insufficient launch fee");
    });

    it("Reverts on empty name", async function () {
      await expect(
        factory.connect(user1).createToken(defaultParams({ name: "" }), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: empty name");
    });

    it("Reverts on zero total supply", async function () {
      await expect(
        factory.connect(user1).createToken(defaultParams({ totalSupply: 0n }), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: zero supply");
    });

    it("Reverts when total fees exceed 30 %", async function () {
      await expect(
        factory.connect(user1).createToken(
          defaultParams({ buyTaxBps: 1500, sellTaxBps: 1501, flavor: TokenFlavor.Taxable }),
          { value: LAUNCH_FEE }
        )
      ).to.be.revertedWith("TokenFactory: total fees exceed 30 %");
    });
  });

  // ─── createToken – Taxable ─────────────────────────────────────────────────

  describe("createToken – Taxable ERC20", function () {
    it("Deploys with correct tax parameters", async function () {
      const params = defaultParams({
        flavor:    TokenFlavor.Taxable,
        buyTaxBps: 300,   // 3 %
        sellTaxBps: 500,  // 5 %
        marketingWallet: user2.address,
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("TaxableERC20", event.args.tokenAddress) as TaxableERC20;

      expect(await token.buyTaxBps()).to.equal(300);
      expect(await token.sellTaxBps()).to.equal(500);
      expect(await token.marketingWallet()).to.equal(user2.address);
    });
  });

  // ─── createToken – Deflationary ───────────────────────────────────────────

  describe("createToken – Deflationary ERC20", function () {
    it("Deploys with correct burn percentage", async function () {
      const params = defaultParams({
        flavor:  TokenFlavor.Deflationary,
        burnBps: 200, // 2 %
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("DeflationaryERC20", event.args.tokenAddress) as DeflationaryERC20;

      expect(await token.burnBps()).to.equal(200);
    });

    it("Burns tokens on transfer", async function () {
      const params = defaultParams({
        flavor:  TokenFlavor.Deflationary,
        burnBps: 100, // 1 %
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("DeflationaryERC20", event.args.tokenAddress) as DeflationaryERC20;

      const transferAmount = ethers.parseUnits("1000", 18);
      const expectedBurn   = transferAmount * 100n / 10_000n;
      const expectedReceive = transferAmount - expectedBurn;

      const supplyBefore = await token.totalSupply();
      await token.connect(user1).transfer(user2.address, transferAmount);
      const supplyAfter = await token.totalSupply();

      expect(await token.balanceOf(user2.address)).to.equal(expectedReceive);
      expect(supplyBefore - supplyAfter).to.equal(expectedBurn);
    });
  });

  // ─── createToken – Reflection ─────────────────────────────────────────────

  describe("createToken – Reflection ERC20", function () {
    it("Deploys with correct reflection bps", async function () {
      const params = defaultParams({
        flavor:        TokenFlavor.Reflection,
        reflectionBps: 100, // 1 %
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("ReflectionERC20", event.args.tokenAddress) as ReflectionERC20;

      expect(await token.reflectionBps()).to.equal(100);
    });
  });

  // ─── createToken – Bonding Curve ──────────────────────────────────────────

  describe("createToken – Bonding Curve Token", function () {
    it("Deploys a bonding curve token", async function () {
      const params = defaultParams({ flavor: TokenFlavor.BondingCurve });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("BondingCurveToken", event.args.tokenAddress) as BondingCurveToken;

      // Total supply starts at 0 (minted on buy)
      expect(await token.totalSupply()).to.equal(0n);
      expect(await token.basePrice()).to.be.gt(0n);
    });

    it("Allows buying tokens via the bonding curve", async function () {
      const params = defaultParams({ flavor: TokenFlavor.BondingCurve });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("BondingCurveToken", event.args.tokenAddress) as BondingCurveToken;

      const ethToBuy = ethers.parseEther("0.01");
      await token.connect(user2).buy(0, { value: ethToBuy });
      expect(await token.balanceOf(user2.address)).to.be.gt(0n);
    });
  });

  // ─── createToken – AI Agent ────────────────────────────────────────────────

  describe("createToken – AI Agent Token", function () {
    it("Deploys an AI agent token with the correct agent wallet", async function () {
      const params = defaultParams({
        flavor:          TokenFlavor.AIAgent,
        marketingWallet: user2.address, // agent wallet
        burnBps:         100,           // agentBurnCapBps
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("AIAgentToken", event.args.tokenAddress);

      expect(await token.agentWallet()).to.equal(user2.address);
      expect(await token.agentBurnCapBps()).to.equal(100);
    });
  });

  // ─── createToken – PolitiFi ────────────────────────────────────────────────

  describe("createToken – PolitiFi Token", function () {
    it("Deploys a PolitiFi token with prediction fee and loser burn", async function () {
      const params = defaultParams({
        flavor:     TokenFlavor.PolitiFi,
        buyTaxBps:  200,  // predictionFeeBps
        sellTaxBps: 2000, // loserBurnBps
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("PolitiFiToken", event.args.tokenAddress);

      expect(await token.predictionFeeBps()).to.equal(200);
      expect(await token.loserBurnBps()).to.equal(2000);
    });
  });

  // ─── createToken – Utility Hybrid ─────────────────────────────────────────

  describe("createToken – Utility Hybrid Token", function () {
    it("Deploys a utility hybrid token with staking reward rate and burn", async function () {
      const params = defaultParams({
        flavor:     TokenFlavor.UtilityHybrid,
        buyTaxBps:  10,  // rewardRateBps
        sellTaxBps: 500, // teamCapBps
        burnBps:    50,
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("UtilityHybridToken", event.args.tokenAddress);

      expect(await token.rewardRateBps()).to.equal(10);
      expect(await token.burnBps()).to.equal(50);
    });
  });

  // ─── createToken – Pump Migrate ───────────────────────────────────────────

  describe("createToken – Pump Migrate Token", function () {
    it("Deploys a pump-migrate token with graduation threshold", async function () {
      const graduationWei = ethers.parseEther("0.085");
      const params = defaultParams({
        flavor:      TokenFlavor.PumpMigrate,
        totalSupply: graduationWei, // graduation threshold stored in totalSupply slot
      });
      const tx = await factory.connect(user1).createToken(params, { value: LAUNCH_FEE });
      const receipt = await tx.wait();
      const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
      const token = await ethers.getContractAt("PumpMigrateToken", event.args.tokenAddress);

      expect(await token.graduationThreshold()).to.equal(graduationWei);
      expect(await token.isGraduated()).to.equal(false);
    });
  });

  // ─── Admin functions ───────────────────────────────────────────────────────

  describe("Admin functions", function () {
    it("Owner can update launch fee", async function () {
      const newFee = ethers.parseEther("0.002");
      await factory.connect(owner).setLaunchFee(newFee);
      expect(await factory.launchFee()).to.equal(newFee);
    });

    it("Non-owner cannot update launch fee", async function () {
      await expect(
        factory.connect(user1).setLaunchFee(0n)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Owner can update fee recipient", async function () {
      await factory.connect(owner).setFeeRecipient(user2.address);
      expect(await factory.feeRecipient()).to.equal(user2.address);
    });

    it("Owner can update implementation address", async function () {
      const newImpl = await (await ethers.getContractFactory("StandardERC20")).deploy();
      await newImpl.waitForDeployment();
      await factory.connect(owner).setImplementation(TokenFlavor.Standard, await newImpl.getAddress());
      expect(await factory.standardImpl()).to.equal(await newImpl.getAddress());
    });

    it("Owner can deploy multiple tokens and totalTokensDeployed increments", async function () {
      await factory.connect(user1).createToken(defaultParams(), { value: LAUNCH_FEE });
      await factory.connect(user2).createToken(defaultParams({ tokenOwner: user2.address }), { value: LAUNCH_FEE });
      expect(await factory.totalTokensDeployed()).to.equal(2n);
    });
  });
});

// ─── LPLocker tests ────────────────────────────────────────────────────────────

describe("LPLocker", function () {
  let locker: any;
  let lpToken: any; // StandardERC20 used as a mock LP token
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  const LOCK_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy LPLocker
    const LPLockerFactory = await ethers.getContractFactory("LPLocker");
    locker = await LPLockerFactory.deploy();
    await locker.waitForDeployment();

    // Deploy a mock ERC20 to use as LP token
    const ERC20Factory = await ethers.getContractFactory("StandardERC20");
    lpToken = await ERC20Factory.deploy();
    await lpToken.waitForDeployment();

    // Initialize the mock LP token with user1 as owner
    await lpToken.initialize(
      "MockLP",
      "MLP",
      ethers.parseUnits("1000000", 0),
      18,
      user1.address
    );
  });

  it("Locks LP tokens and emits Locked event", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await lpToken.connect(user1).approve(await locker.getAddress(), LOCK_AMOUNT);
    const tx = await locker.connect(user1).lock(
      await lpToken.getAddress(), LOCK_AMOUNT, unlockAt
    );
    await expect(tx).to.emit(locker, "Locked").withArgs(
      0n, user1.address, await lpToken.getAddress(), LOCK_AMOUNT, unlockAt
    );
    expect(await lpToken.balanceOf(await locker.getAddress())).to.equal(LOCK_AMOUNT);
  });

  it("Reverts unlock before time expires", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await lpToken.connect(user1).approve(await locker.getAddress(), LOCK_AMOUNT);
    await locker.connect(user1).lock(await lpToken.getAddress(), LOCK_AMOUNT, unlockAt);
    await expect(locker.connect(user1).unlock(0n)).to.be.revertedWith("LPLocker: still locked");
  });

  it("Reverts lock with zero amount", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await expect(
      locker.connect(user1).lock(await lpToken.getAddress(), 0n, unlockAt)
    ).to.be.revertedWith("LPLocker: amount = 0");
  });

  it("Reverts lock with unlock timestamp in past", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) - 1);
    await expect(
      locker.connect(user1).lock(await lpToken.getAddress(), LOCK_AMOUNT, unlockAt)
    ).to.be.revertedWith("LPLocker: unlock in past");
  });

  it("Reverts unlock attempt by non-owner of lock", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await lpToken.connect(user1).approve(await locker.getAddress(), LOCK_AMOUNT);
    await locker.connect(user1).lock(await lpToken.getAddress(), LOCK_AMOUNT, unlockAt);
    await expect(locker.connect(owner).unlock(0n)).to.be.revertedWith("LPLocker: not owner");
  });

  it("Returns correct lock IDs by owner", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await lpToken.connect(user1).approve(await locker.getAddress(), LOCK_AMOUNT * 2n);
    await locker.connect(user1).lock(await lpToken.getAddress(), LOCK_AMOUNT, unlockAt);
    await locker.connect(user1).lock(await lpToken.getAddress(), LOCK_AMOUNT, unlockAt);
    const ids = await locker.getLocksByOwner(user1.address);
    expect(ids.length).to.equal(2);
    expect(ids[0]).to.equal(0n);
    expect(ids[1]).to.equal(1n);
  });

  it("totalLocks increments with each lock", async function () {
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await lpToken.connect(user1).approve(await locker.getAddress(), LOCK_AMOUNT);
    await locker.connect(user1).lock(await lpToken.getAddress(), LOCK_AMOUNT, unlockAt);
    expect(await locker.totalLocks()).to.equal(1n);
  });
});

// ─── v2: Percentage-based launch fee (launchFeeBps) ──────────────────────────

describe("Percentage-based launch fee (launchFeeBps)", function () {
  let factory: TokenFactory;
  let standardImpl: StandardERC20;
  let taxableImpl: TaxableERC20;
  let deflationaryImpl: DeflationaryERC20;
  let reflectionImpl: ReflectionERC20;
  let bondingCurveImpl: BondingCurveToken;
  let aiAgentImpl: any;
  let politiFiImpl: any;
  let utilityHybridImpl: any;
  let pumpMigrateImpl: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  const LAUNCH_FEE = ethers.parseEther("0.001");

  function defaultParams(overrides: { tokenOwner?: string } = {}) {
    return {
      name: "Test", symbol: "TST", totalSupply: ethers.parseUnits("1000000", 0),
      decimals: 18, buyTaxBps: 0, sellTaxBps: 0, burnBps: 0, reflectionBps: 0,
      marketingWallet: ethers.ZeroAddress, liquidityBps: 0,
      owner: overrides.tokenOwner ?? user1.address,
      flavor: TokenFlavor.Standard,
    };
  }

  beforeEach(async function () {
    [owner, user1, , feeRecipient] = await ethers.getSigners();

    const StdFactory = await ethers.getContractFactory("StandardERC20");
    standardImpl = await StdFactory.deploy();
    await standardImpl.waitForDeployment();

    const TaxFactory = await ethers.getContractFactory("TaxableERC20");
    taxableImpl = await TaxFactory.deploy();
    await taxableImpl.waitForDeployment();

    const DefFactory = await ethers.getContractFactory("DeflationaryERC20");
    deflationaryImpl = await DefFactory.deploy();
    await deflationaryImpl.waitForDeployment();

    const RefFactory = await ethers.getContractFactory("ReflectionERC20");
    reflectionImpl = await RefFactory.deploy();
    await reflectionImpl.waitForDeployment();

    const BcFactory = await ethers.getContractFactory("BondingCurveToken");
    bondingCurveImpl = await BcFactory.deploy();
    await bondingCurveImpl.waitForDeployment();

    const AIFactory = await ethers.getContractFactory("AIAgentToken");
    aiAgentImpl = await AIFactory.deploy();
    await aiAgentImpl.waitForDeployment();

    const PoliFactory = await ethers.getContractFactory("PolitiFiToken");
    politiFiImpl = await PoliFactory.deploy();
    await politiFiImpl.waitForDeployment();

    const UHFactory = await ethers.getContractFactory("UtilityHybridToken");
    utilityHybridImpl = await UHFactory.deploy();
    await utilityHybridImpl.waitForDeployment();

    const PMFactory = await ethers.getContractFactory("PumpMigrateToken");
    pumpMigrateImpl = await PMFactory.deploy();
    await pumpMigrateImpl.waitForDeployment();

    const FactoryContract = await ethers.getContractFactory("TokenFactory");
    factory = await FactoryContract.deploy(
      await standardImpl.getAddress(), await taxableImpl.getAddress(),
      await deflationaryImpl.getAddress(), await reflectionImpl.getAddress(),
      await bondingCurveImpl.getAddress(), await aiAgentImpl.getAddress(),
      await politiFiImpl.getAddress(), await utilityHybridImpl.getAddress(),
      await pumpMigrateImpl.getAddress(), LAUNCH_FEE, feeRecipient.address
    );
    await factory.waitForDeployment();
  });

  it("launchFeeBps defaults to 50", async function () {
    expect(await factory.launchFeeBps()).to.equal(50n);
  });

  it("percentage fee kicks in when msg.value exceeds breakeven", async function () {
    // Send 10 ETH — pct fee = 10 * 50/10000 = 0.05 ETH, which is > flat 0.001 ETH
    const sendValue = ethers.parseEther("10");
    const expectedFee = (sendValue * 50n) / 10_000n; // 0.05 ETH

    const feeRecipientBefore = await ethers.provider.getBalance(feeRecipient.address);
    const user1Before = await ethers.provider.getBalance(user1.address);

    const tx = await factory.connect(user1).createToken(defaultParams(), { value: sendValue });
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

    const feeRecipientAfter = await ethers.provider.getBalance(feeRecipient.address);
    const user1After = await ethers.provider.getBalance(user1.address);

    // feeRecipient should have received exactly 0.05 ETH
    expect(feeRecipientAfter - feeRecipientBefore).to.equal(expectedFee);

    // user1 net spend = fee + gas (excess returned)
    const netSpend = user1Before - user1After;
    expect(netSpend).to.be.closeTo(expectedFee + gasUsed, ethers.parseEther("0.001"));
  });

  it("flat minimum fee still applies for small amounts", async function () {
    // Send exactly LAUNCH_FEE (0.001 ETH). pct fee = 0.000005 ETH < flat → flat wins.
    const feeRecipientBefore = await ethers.provider.getBalance(feeRecipient.address);
    await factory.connect(user1).createToken(defaultParams(), { value: LAUNCH_FEE });
    const feeRecipientAfter = await ethers.provider.getBalance(feeRecipient.address);

    expect(feeRecipientAfter - feeRecipientBefore).to.equal(LAUNCH_FEE);
  });
});

// ─── v2: Referral system ──────────────────────────────────────────────────────

describe("Referral system", function () {
  let factory: TokenFactory;
  let standardImpl: StandardERC20;
  let taxableImpl: TaxableERC20;
  let deflationaryImpl: DeflationaryERC20;
  let reflectionImpl: ReflectionERC20;
  let bondingCurveImpl: BondingCurveToken;
  let aiAgentImpl: any;
  let politiFiImpl: any;
  let utilityHybridImpl: any;
  let pumpMigrateImpl: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  const LAUNCH_FEE = ethers.parseEther("0.001");

  function defaultParams(overrides: { tokenOwner?: string } = {}) {
    return {
      name: "RefTest", symbol: "REFT", totalSupply: ethers.parseUnits("1000000", 0),
      decimals: 18, buyTaxBps: 0, sellTaxBps: 0, burnBps: 0, reflectionBps: 0,
      marketingWallet: ethers.ZeroAddress, liquidityBps: 0,
      owner: overrides.tokenOwner ?? user1.address,
      flavor: TokenFlavor.Standard,
    };
  }

  beforeEach(async function () {
    [owner, user1, user2, feeRecipient] = await ethers.getSigners();

    const StdFactory = await ethers.getContractFactory("StandardERC20");
    standardImpl = await StdFactory.deploy();
    await standardImpl.waitForDeployment();

    const TaxFactory = await ethers.getContractFactory("TaxableERC20");
    taxableImpl = await TaxFactory.deploy();
    await taxableImpl.waitForDeployment();

    const DefFactory = await ethers.getContractFactory("DeflationaryERC20");
    deflationaryImpl = await DefFactory.deploy();
    await deflationaryImpl.waitForDeployment();

    const RefFactory = await ethers.getContractFactory("ReflectionERC20");
    reflectionImpl = await RefFactory.deploy();
    await reflectionImpl.waitForDeployment();

    const BcFactory = await ethers.getContractFactory("BondingCurveToken");
    bondingCurveImpl = await BcFactory.deploy();
    await bondingCurveImpl.waitForDeployment();

    const AIFactory = await ethers.getContractFactory("AIAgentToken");
    aiAgentImpl = await AIFactory.deploy();
    await aiAgentImpl.waitForDeployment();

    const PoliFactory = await ethers.getContractFactory("PolitiFiToken");
    politiFiImpl = await PoliFactory.deploy();
    await politiFiImpl.waitForDeployment();

    const UHFactory = await ethers.getContractFactory("UtilityHybridToken");
    utilityHybridImpl = await UHFactory.deploy();
    await utilityHybridImpl.waitForDeployment();

    const PMFactory = await ethers.getContractFactory("PumpMigrateToken");
    pumpMigrateImpl = await PMFactory.deploy();
    await pumpMigrateImpl.waitForDeployment();

    const FactoryContract = await ethers.getContractFactory("TokenFactory");
    factory = await FactoryContract.deploy(
      await standardImpl.getAddress(), await taxableImpl.getAddress(),
      await deflationaryImpl.getAddress(), await reflectionImpl.getAddress(),
      await bondingCurveImpl.getAddress(), await aiAgentImpl.getAddress(),
      await politiFiImpl.getAddress(), await utilityHybridImpl.getAddress(),
      await pumpMigrateImpl.getAddress(), LAUNCH_FEE, feeRecipient.address
    );
    await factory.waitForDeployment();
  });

  it("createTokenWithReferral splits fee with referrer", async function () {
    // Send 1 ETH: fee = 1 ETH * 50/10000 = 0.005 ETH
    // Referral (20%) = 0.001 ETH to user2
    // feeRecipient gets 0.004 ETH
    const sendValue = ethers.parseEther("1");
    const expectedFee = (sendValue * 50n) / 10_000n; // 0.005 ETH
    const expectedReferral = (expectedFee * 2000n) / 10_000n; // 0.001 ETH
    const expectedToRecipient = expectedFee - expectedReferral; // 0.004 ETH

    const feeRecipientBefore = await ethers.provider.getBalance(feeRecipient.address);

    const tx = await factory.connect(user1).createTokenWithReferral(
      defaultParams(), user2.address, { value: sendValue }
    );
    await expect(tx).to.emit(factory, "ReferralEarned")
      .withArgs(user2.address, user1.address, expectedReferral);

    const feeRecipientAfter = await ethers.provider.getBalance(feeRecipient.address);
    expect(feeRecipientAfter - feeRecipientBefore).to.equal(expectedToRecipient);

    // Referral earnings tracked on-chain
    expect(await factory.referralEarnings(user2.address)).to.equal(expectedReferral);
  });

  it("claimReferralEarnings pays out to referrer", async function () {
    const sendValue = ethers.parseEther("1");
    const expectedFee = (sendValue * 50n) / 10_000n;
    const expectedReferral = (expectedFee * 2000n) / 10_000n;

    await factory.connect(user1).createTokenWithReferral(
      defaultParams(), user2.address, { value: sendValue }
    );

    const user2Before = await ethers.provider.getBalance(user2.address);
    const claimTx = await factory.connect(user2).claimReferralEarnings();
    const claimReceipt = await claimTx.wait();
    const gasUsed = claimReceipt!.gasUsed * claimReceipt!.gasPrice;
    const user2After = await ethers.provider.getBalance(user2.address);

    expect(user2After - user2Before + gasUsed).to.equal(expectedReferral);
    expect(await factory.referralEarnings(user2.address)).to.equal(0n);
  });

  it("owner can set launchFeeBps", async function () {
    await expect(factory.connect(owner).setLaunchFeeBps(100))
      .to.emit(factory, "LaunchFeeBpsUpdated").withArgs(100);
    expect(await factory.launchFeeBps()).to.equal(100n);

    // Non-owner cannot set
    await expect(factory.connect(user1).setLaunchFeeBps(10))
      .to.be.reverted;
  });

  it("setLaunchFeeBps reverts when bps > 1000", async function () {
    await expect(factory.connect(owner).setLaunchFeeBps(1001))
      .to.be.revertedWith("TokenFactory: bps too high");
  });

  it("owner can set referralShareBps", async function () {
    await expect(factory.connect(owner).setReferralShareBps(3000))
      .to.emit(factory, "ReferralShareBpsUpdated").withArgs(3000);
    expect(await factory.referralShareBps()).to.equal(3000n);

    // Non-owner cannot set
    await expect(factory.connect(user1).setReferralShareBps(100))
      .to.be.reverted;
  });
});
