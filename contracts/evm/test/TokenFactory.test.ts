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

describe("TokenFactory", function () {
  let factory: TokenFactory;
  let standardImpl: StandardERC20;
  let taxableImpl: TaxableERC20;
  let deflationaryImpl: DeflationaryERC20;
  let reflectionImpl: ReflectionERC20;
  let bondingCurveImpl: BondingCurveToken;

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
    const StandardFactory     = await ethers.getContractFactory("StandardERC20");
    const TaxableFactory      = await ethers.getContractFactory("TaxableERC20");
    const DeflationaryFactory = await ethers.getContractFactory("DeflationaryERC20");
    const ReflectionFactory   = await ethers.getContractFactory("ReflectionERC20");
    const BondingCurveFactory = await ethers.getContractFactory("BondingCurveToken");

    standardImpl     = await StandardFactory.deploy()     as StandardERC20;
    taxableImpl      = await TaxableFactory.deploy()      as TaxableERC20;
    deflationaryImpl = await DeflationaryFactory.deploy() as DeflationaryERC20;
    reflectionImpl   = await ReflectionFactory.deploy()   as ReflectionERC20;
    bondingCurveImpl = await BondingCurveFactory.deploy() as BondingCurveToken;

    await Promise.all([
      standardImpl.waitForDeployment(),
      taxableImpl.waitForDeployment(),
      deflationaryImpl.waitForDeployment(),
      reflectionImpl.waitForDeployment(),
      bondingCurveImpl.waitForDeployment(),
    ]);

    // Deploy factory
    const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactoryContract.deploy(
      await standardImpl.getAddress(),
      await taxableImpl.getAddress(),
      await deflationaryImpl.getAddress(),
      await reflectionImpl.getAddress(),
      await bondingCurveImpl.getAddress(),
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
