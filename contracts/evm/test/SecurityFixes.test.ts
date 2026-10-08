import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenFactory } from "../typechain-types";

enum TokenFlavor {
  Standard = 0,
  Taxable = 1,
  Deflationary = 2,
  Reflection = 3,
  BondingCurve = 4,
  AIAgent = 5,
  PolitiFi = 6,
  UtilityHybrid = 7,
  PumpMigrate = 8,
}

const LAUNCH_FEE = ethers.parseEther("0.001");

async function deployImplementations() {
  const names = [
    "StandardERC20",
    "TaxableERC20",
    "DeflationaryERC20",
    "ReflectionERC20",
    "BondingCurveToken",
    "AIAgentToken",
    "PolitiFiToken",
    "UtilityHybridToken",
    "PumpMigrateToken",
  ] as const;
  const deployed = [];
  for (const name of names) {
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    deployed.push(contract);
  }
  return deployed;
}

describe("Security fixes", function () {
  let impls: Awaited<ReturnType<typeof deployImplementations>>;
  let factory: TokenFactory;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  function params(overrides: Record<string, unknown> = {}) {
    return {
      name: "MyToken",
      symbol: "MTK",
      totalSupply: ethers.parseUnits("1000000", 0),
      decimals: 18,
      buyTaxBps: 0,
      sellTaxBps: 0,
      burnBps: 0,
      reflectionBps: 0,
      marketingWallet: ethers.ZeroAddress,
      liquidityBps: 0,
      owner: user1.address,
      flavor: TokenFlavor.Standard,
      ...overrides,
    };
  }

  async function create(flavorOverrides: Record<string, unknown> = {}, value = LAUNCH_FEE) {
    const tx = await factory.connect(user1).createToken(params(flavorOverrides), { value });
    const receipt = await tx.wait();
    const event = receipt!.logs.find((l: any) => l.fragment?.name === "TokenCreated") as any;
    return event.args.tokenAddress as string;
  }

  before(async function () {
    [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();
    impls = await deployImplementations();
  });

  beforeEach(async function () {
    const addresses = await Promise.all(impls.map((c) => c.getAddress()));
    const Factory = await ethers.getContractFactory("TokenFactory");
    factory = (await Factory.deploy(
      ...addresses,
      LAUNCH_FEE,
      feeRecipient.address
    )) as unknown as TokenFactory;
    await factory.waitForDeployment();
  });

  describe("factory input and fee controls", function () {
    it("rejects decimals above 18, empty symbols, long names, and a zero owner", async function () {
      await expect(
        factory.connect(user1).createToken(params({ decimals: 19 }), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: decimals > 18");
      await expect(
        factory.connect(user1).createToken(params({ symbol: "" }), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: empty symbol");
      await expect(
        factory.connect(user1).createToken(params({ name: "N".repeat(65) }), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: name too long");
      await expect(
        factory.connect(user1).createToken(params({ owner: ethers.ZeroAddress }), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: zero owner");
    });

    it("lets the owner pause new launches without touching an existing token", async function () {
      const token = await create();
      await expect(factory.connect(user1).setLaunchesPaused(true)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount"
      );
      await expect(factory.connect(owner).setLaunchesPaused(true))
        .to.emit(factory, "LaunchesPaused")
        .withArgs(true);
      await expect(
        factory.connect(user1).createToken(params(), { value: LAUNCH_FEE })
      ).to.be.revertedWith("TokenFactory: launches paused");
      expect(await ethers.provider.getCode(token)).to.not.equal("0x");
      await factory.connect(owner).setLaunchesPaused(false);
      await create();
    });

    it("rejects the factory itself as fee recipient", async function () {
      await expect(
        factory.connect(owner).queueSetFeeRecipient(await factory.getAddress())
      ).to.be.revertedWith("TokenFactory: recipient is factory");
    });

    it("does not pay a referrer who is the caller, and a second claim reverts", async function () {
      const send = ethers.parseEther("1");
      await factory.connect(user1).createTokenWithReferral(params(), user1.address, { value: send });
      expect(await factory.referralEarnings(user1.address)).to.equal(0n);

      await factory.connect(user1).createTokenWithReferral(params(), user2.address, { value: send });
      await factory.connect(user2).claimReferralEarnings();
      await expect(factory.connect(user2).claimReferralEarnings()).to.be.revertedWith(
        "TokenFactory: nothing to claim"
      );
    });

    it("keeps referral liabilities equal to the contract balance across mixed launches", async function () {
      const values = [
        LAUNCH_FEE,
        ethers.parseEther("0.01"),
        ethers.parseEther("0.2"),
        ethers.parseEther("1"),
        ethers.parseEther("3"),
      ];
      for (let i = 0; i < values.length; i++) {
        const referrer = i % 2 === 0 ? user2.address : ethers.ZeroAddress;
        await factory.connect(user1).createTokenWithReferral(params(), referrer, { value: values[i] });
      }
      const owed =
        (await factory.referralEarnings(user2.address)) +
        (await factory.referralEarnings(user1.address)) +
        (await factory.referralEarnings(user3.address));
      expect(await ethers.provider.getBalance(await factory.getAddress())).to.equal(owed);
    });

    it("blocks reentering from the fee recipient", async function () {
      const Sink = await ethers.getContractFactory("ReentrantFeeSink");
      const sink = await Sink.deploy();
      await sink.waitForDeployment();
      await sink.setFactory(await factory.getAddress());
      const queued = await factory.connect(owner).queueSetFeeRecipient(await sink.getAddress());
      const receipt = await queued.wait();
      const eta = receipt!.logs.find((l: any) => l.fragment?.name === "AdminOpQueued").args.eta as bigint;
      await time.increaseTo(eta);
      await factory.executeSetFeeRecipient(await sink.getAddress(), eta);

      const token = await create();
      expect(token).to.not.equal(ethers.ZeroAddress);
      expect(await sink.attempts()).to.equal(1n);
      expect(await sink.reenterSucceeded()).to.equal(0n);
    });

    it("cannot initialize an implementation or a clone twice", async function () {
      const standard = impls[0];
      await expect(
        (standard as any).initialize(
          "X", "X", 1, 18, 0, 0, 0, 0, ethers.ZeroAddress, 0, user1.address
        )
      ).to.be.revertedWithCustomError(standard, "InvalidInitialization");

      const tokenAddress = await create();
      const token = await ethers.getContractAt("StandardERC20", tokenAddress);
      await expect(
        token.initialize("X", "X", 1, 18, 0, 0, 0, 0, ethers.ZeroAddress, 0, user1.address)
      ).to.be.revertedWithCustomError(token, "InvalidInitialization");
    });
  });

  describe("tax lock", function () {
    it("freezes tax, pair flags, and the marketing wallet", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.Taxable,
        buyTaxBps: 100,
        sellTaxBps: 200,
        marketingWallet: user2.address,
      });
      const token = await ethers.getContractAt("TaxableERC20", tokenAddress);
      await token.connect(user1).setDexPair(user3.address, true);
      await token.connect(user1).lockTax();

      await expect(token.connect(user1).setTax(0, 0)).to.be.revertedWith("TaxableERC20: tax locked");
      await expect(token.connect(user1).setDexPair(user3.address, false)).to.be.revertedWith(
        "TaxableERC20: tax locked"
      );
      await expect(token.connect(user1).setMarketingWallet(user3.address)).to.be.revertedWith(
        "TaxableERC20: tax locked"
      );
      await expect(token.connect(user2).lockTax()).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );

      const amount = ethers.parseEther("1000");
      await token.connect(user1).transfer(user3.address, amount);
      const tax = (amount * 200n) / 10_000n;
      expect(await token.balanceOf(user2.address)).to.equal(tax);
      expect(await token.balanceOf(user3.address)).to.equal(amount - tax);
    });
  });

  describe("reflection accounting", function () {
    it("pays holders the reflected amount instead of silently burning it", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.Reflection,
        reflectionBps: 1000,
        totalSupply: 1000n,
      });
      const token = await ethers.getContractAt("ReflectionERC20", tokenAddress);
      const supplyBefore = await token.totalSupply();
      const move = ethers.parseEther("400");

      await token.connect(user1).transfer(user2.address, move);
      const burned = supplyBefore - (await token.totalSupply());
      expect(burned).to.equal((move * 1000n) / 10_000n);

      const pending =
        (await token.pendingReflections(user1.address)) +
        (await token.pendingReflections(user2.address));
      expect(pending).to.be.gt(0n);
      expect(burned - pending).to.be.lte(5n);

      const user2BeforeSecond = await token.pendingReflections(user2.address);
      await token.connect(user1).transfer(user3.address, ethers.parseEther("100"));
      expect(await token.pendingReflections(user2.address)).to.be.gt(user2BeforeSecond);

      await token.connect(user1).claimReflections();
      await token.connect(user2).claimReflections();
      await token.connect(user3).claimReflections();

      const supplyAfter = await token.totalSupply();
      expect(supplyBefore - supplyAfter).to.be.lte(10n);
      expect(await token.pendingReflections(user2.address)).to.equal(0n);
    });
  });

  describe("utility hybrid staking", function () {
    async function hybrid(extra: Record<string, unknown> = {}) {
      const tokenAddress = await create({
        flavor: TokenFlavor.UtilityHybrid,
        buyTaxBps: 100,
        sellTaxBps: 500,
        burnBps: 0,
        ...extra,
      });
      return ethers.getContractAt("UtilityHybridToken", tokenAddress);
    }

    it("does not burn staked principal or reward deposits", async function () {
      const token = await hybrid({ burnBps: 500 });
      const fund = ethers.parseEther("1000");
      const stake = ethers.parseEther("2000");
      const tokenAddress = await token.getAddress();

      const before = await token.balanceOf(tokenAddress);
      await token.connect(user1).fundRewardPool(fund);
      expect((await token.balanceOf(tokenAddress)) - before).to.equal(fund);
      expect(await token.rewardPool()).to.equal(fund);

      await token.connect(user1).transfer(user2.address, stake);
      const received = await token.balanceOf(user2.address);
      expect(received).to.be.lt(stake);
      await token.connect(user2).stake(received);
      expect(await token.balanceOf(user2.address)).to.equal(0n);
      expect(await token.totalStaked()).to.equal(received);
      expect(await token.balanceOf(tokenAddress)).to.equal(received + fund);
    });

    it("lets a holder unstake a balance above the wallet cap", async function () {
      const token = await hybrid();
      const amount = ethers.parseEther("100000");
      await token.connect(user1).setExcludedFromCap(user2.address, true);
      await token.connect(user1).transfer(user2.address, amount);
      await token.connect(user1).setExcludedFromCap(user2.address, false);

      await token.connect(user2).stake(amount);
      await token.connect(user2).unstake(ethers.parseEther("40000"));
      expect(await token.isExcludedFromCap(user2.address)).to.equal(true);
      await token.connect(user2).unstake(ethers.parseEther("60000"));

      expect(await token.balanceOf(user2.address)).to.equal(amount);
      expect(await token.isExcludedFromCap(user2.address)).to.equal(false);
      expect(await token.totalStaked()).to.equal(0n);
    });

    it("pays the exact reward and ignores same-transaction stake votes", async function () {
      const token = await hybrid();
      const stake = ethers.parseEther("1000");
      await token.connect(user1).fundRewardPool(ethers.parseEther("100"));
      await token.connect(user1).transfer(user2.address, stake);
      await token.connect(user2).stake(stake);

      const expected = (stake * 100n) / 10_000n;
      const opened = await time.latest();
      await time.setNextBlockTimestamp(opened + 24 * 60 * 60);
      const before = await token.balanceOf(user2.address);
      await token.connect(user2).claimRewards();
      expect((await token.balanceOf(user2.address)) - before).to.equal(expected);

      await token.connect(user2).createProposal("ship it", 7);
      await token.connect(user2).vote(0, true);
      expect((await token.proposals(0)).votesFor).to.equal(stake);

      const flashStake = ethers.parseEther("5000");
      await token.connect(user1).transfer(user3.address, flashStake);
      const Helper = await ethers.getContractFactory("StakeAndVote");
      const helper = await Helper.deploy();
      await helper.waitForDeployment();
      await token.connect(user3).approve(await helper.getAddress(), flashStake);
      await expect(helper.connect(user3).go(await token.getAddress(), flashStake, 0)).to.be.revertedWith(
        "UtilityHybridToken: stake too new"
      );
    });
  });

  describe("bonding curve", function () {
    it("round-trips buy and sell without stranding or overpaying ETH", async function () {
      const tokenAddress = await create({ flavor: TokenFlavor.BondingCurve });
      const token = await ethers.getContractAt("BondingCurveToken", tokenAddress);

      await token.connect(user1).setCurveParams(1_000_000_000n, 1_000n);
      const eth = ethers.parseEther("0.05");
      await token.connect(user2).buy(1, { value: eth });
      await expect(token.connect(user1).setCurveParams(1n, 1n)).to.be.revertedWith(
        "BondingCurveToken: curve locked"
      );
      await expect(
        user2.sendTransaction({ to: tokenAddress, value: 1n })
      ).to.be.revertedWith("BondingCurveToken: use buy()");

      const bought = await token.balanceOf(user2.address);
      expect(bought).to.be.gt(0n);
      await token.connect(user2).sell(bought, 0);
      expect(await token.totalSupply()).to.equal(0n);
      expect(await token.ethReserve()).to.equal(0n);
      expect(await ethers.provider.getBalance(tokenAddress)).to.equal(0n);
    });

    it("preserves reserve solvency across random buy and sell sizes", async function () {
      const tokenAddress = await create({ flavor: TokenFlavor.BondingCurve });
      const token = await ethers.getContractAt("BondingCurveToken", tokenAddress);
      let seed = 0xc0ffee;
      const next = () => {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        return seed;
      };
      const buyers = [user1, user2, user3];
      for (let i = 0; i < 12; i++) {
        const buyer = buyers[i % buyers.length];
        const value = ethers.parseEther("0.001") * BigInt((next() % 15) + 1);
        await token.connect(buyer).buy(0, { value });
        const balance = await token.balanceOf(buyer.address);
        if (balance > 1n) {
          const sellAmount = balance / BigInt((next() % 3) + 2);
          await token.connect(buyer).sell(sellAmount, 0);
        }
        expect(await ethers.provider.getBalance(tokenAddress)).to.equal(await token.ethReserve());
      }
    });
  });

  describe("pump migrate curve", function () {
    it("prices the first token in wei, not tens of ETH, and cannot freeze the reserve", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.PumpMigrate,
        totalSupply: ethers.parseEther("0.01"),
        buyTaxBps: 100,
        marketingWallet: user3.address,
      });
      const token = await ethers.getContractAt("PumpMigrateToken", tokenAddress);
      expect(await token.getBuyCost(1n)).to.be.lt(ethers.parseEther("0.001"));
      expect(await token.virtualTokenReserve()).to.equal(1_000_000n);

      await token.connect(user1).setGraduationThreshold(ethers.parseEther("1"));
      const EarlyRouter = await ethers.getContractFactory("MockUniswapV2Router");
      const earlyRouter = await EarlyRouter.deploy();
      await earlyRouter.waitForDeployment();
      await token.connect(user2).buy(1, { value: ethers.parseEther("0.05") });
      expect(await token.isGraduated()).to.equal(false);
      await expect(
        token.connect(user1).setGraduationThreshold(1n)
      ).to.be.revertedWith("PumpMigrateToken: trading already started");
      await token.connect(user1).setDexRouter(await earlyRouter.getAddress());
      await expect(token.connect(user1).setDexRouter(user2.address)).to.be.revertedWith(
        "PumpMigrateToken: router locked"
      );

      const graduatedAddress = await create({
        flavor: TokenFlavor.PumpMigrate,
        totalSupply: ethers.parseEther("0.01"),
        buyTaxBps: 100,
        marketingWallet: user3.address,
      });
      const graduated = await ethers.getContractAt("PumpMigrateToken", graduatedAddress);
      const Router = await ethers.getContractFactory("MockUniswapV2Router");
      const router = await Router.deploy();
      await router.waitForDeployment();
      await graduated.connect(user1).setDexRouter(await router.getAddress());
      await graduated.connect(user2).buy(1, { value: ethers.parseEther("0.05") });
      expect(await graduated.isGraduated()).to.equal(true);
      expect(await graduated.liquidityMigrated()).to.equal(true);
      expect(await graduated.ethReserve()).to.equal(0n);
      expect(await ethers.provider.getBalance(graduatedAddress)).to.equal(0n);
      expect(await router.balanceOf(await graduated.LP_BURN_ADDRESS())).to.be.gt(0n);
      await expect(graduated.connect(user2).sell(1n, 0)).to.be.revertedWith(
        "PumpMigrateToken: trading paused (graduating)"
      );
      await expect(graduated.connect(user1).setDexRouter(user1.address)).to.be.revertedWith(
        "PumpMigrateToken: already graduated"
      );
    });

    it("reverts graduation when the router misses the ETH minimum", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.PumpMigrate,
        totalSupply: ethers.parseEther("0.01"),
        buyTaxBps: 100,
        marketingWallet: user3.address,
      });
      const token = await ethers.getContractAt("PumpMigrateToken", tokenAddress);
      const Router = await ethers.getContractFactory("MockUniswapV2Router");
      const router = await Router.deploy();
      await router.waitForDeployment();
      await router.setShortEth(true);
      await token.connect(user1).setDexRouter(await router.getAddress());
      await expect(token.connect(user2).buy(1, { value: ethers.parseEther("0.05") })).to.be.revertedWith(
        "MockRouter: eth slippage"
      );
      expect(await token.isGraduated()).to.equal(false);
      expect(await token.ethReserve()).to.equal(0n);
    });

    it("rolls back a graduating buy when the router was never set", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.PumpMigrate,
        totalSupply: ethers.parseEther("0.01"),
        buyTaxBps: 100,
        marketingWallet: user3.address,
      });
      const token = await ethers.getContractAt("PumpMigrateToken", tokenAddress);
      await expect(token.connect(user2).buy(1, { value: ethers.parseEther("0.05") })).to.be.revertedWith(
        "PumpMigrateToken: router not set"
      );
      expect(await token.isGraduated()).to.equal(false);
      expect(await token.ethReserve()).to.equal(0n);
      expect(await token.tradingPaused()).to.equal(false);
    });
  });

  describe("politiFi cutoff and loser burn", function () {
    it("counts each holder once, freezes transfers, and burns losers without taxing the prize", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.PolitiFi,
        buyTaxBps: 1000,
        sellTaxBps: 2000,
        totalSupply: 10_000n,
      });
      const token = await ethers.getContractAt("PolitiFiToken", tokenAddress);
      const chunk = ethers.parseEther("1000");
      await token.connect(user1).transfer(user2.address, chunk);
      await token.connect(user1).transfer(user3.address, chunk);

      await token.connect(user2).registerSide(1);
      await token.connect(user3).registerSide(2);
      const resolution = (await time.latest()) + 100;
      await token.connect(user1).setEventMeta("Test Election", resolution);

      await token.connect(user1).lockCutoff([user2.address, user2.address, user3.address]);
      expect(await token.totalYesBalance()).to.equal(await token.balanceOf(user2.address));
      expect(await token.totalNoBalance()).to.equal(await token.balanceOf(user3.address));
      await expect(token.connect(user2).transfer(user1.address, 1n)).to.be.revertedWith(
        "PolitiFiToken: transfers frozen until resolution"
      );
      await expect(token.connect(user1).resolve(true)).to.be.revertedWith("PolitiFiToken: too early");

      await time.increaseTo(resolution);
      await token.connect(user1).resolve(true);

      const prize = await token.prizePool();
      const yesBefore = await token.balanceOf(user2.address);
      await token.connect(user2).claimPrize();
      expect((await token.balanceOf(user2.address)) - yesBefore).to.equal(prize);
      expect(await token.prizePool()).to.equal(0n);

      const noBefore = await token.balanceOf(user3.address);
      await expect(token.connect(user3).transfer(user1.address, 1n)).to.be.revertedWith(
        "PolitiFiToken: loser must burn before transfer"
      );
      await token.connect(user1).applyLoserBurn(user3.address);
      const burned = (noBefore * 2000n) / 10_000n;
      expect(noBefore - (await token.balanceOf(user3.address))).to.equal(burned);
      await token.connect(user3).transfer(user1.address, 1n);
    });
  });

  describe("AI agent treasury", function () {
    it("enforces the daily burn cap and reports the treasury that is actually left", async function () {
      const tokenAddress = await create({
        flavor: TokenFlavor.AIAgent,
        marketingWallet: user2.address,
        burnBps: 100,
      });
      const token = await ethers.getContractAt("AIAgentToken", tokenAddress);
      const deposit = ethers.parseEther("1000");
      await token.connect(user1).depositToTreasury(deposit);
      expect(await token.treasuryBalance()).to.equal(deposit);

      const cap = ((await token.totalSupply()) * 100n) / 10_000n;
      await expect(token.connect(user2).autoBurn(cap + 1n, "too much")).to.be.revertedWith(
        "AIAgentToken: daily burn cap exceeded"
      );
      await expect(token.connect(user1).autoBurn(1n, "nope")).to.be.revertedWith("AIAgentToken: not agent");

      const burn = ethers.parseEther("10");
      await token.connect(user2).autoBurn(burn, "daily");
      expect(await token.treasuryBalance()).to.equal(deposit - burn);
      expect(await token.balanceOf(await token.getAddress())).to.equal(deposit - burn);
    });
  });

  describe("LP locker", function () {
    it("locks the amount that actually arrived and can extend or transfer the lock", async function () {
      const Locker = await ethers.getContractFactory("LPLocker");
      const locker = await Locker.deploy();
      await locker.waitForDeployment();

      const Fee = await ethers.getContractFactory("FeeOnTransferERC20");
      const feeToken = await Fee.deploy();
      await feeToken.waitForDeployment();
      const requested = ethers.parseEther("1000");
      await feeToken.mint(user1.address, requested);
      await feeToken.connect(user1).approve(await locker.getAddress(), requested);

      const unlockAt = BigInt(await time.latest()) + 3600n;
      await locker.connect(user1).lock(await feeToken.getAddress(), requested, unlockAt);
      const lock = await locker.getLock(0);
      expect(lock.amount).to.equal((requested * 9n) / 10n);

      await locker.connect(user1).extendLock(0, unlockAt + 1000n);
      await locker.connect(user1).transferLock(0, user2.address);
      expect((await locker.getLocksByOwner(user1.address)).length).to.equal(0);
      expect((await locker.getLocksByOwner(user2.address))[0]).to.equal(0n);

      await time.increaseTo(unlockAt + 1000n);
      await expect(locker.connect(user1).unlock(0)).to.be.revertedWith("LPLocker: not owner");
      await locker.connect(user2).unlock(0);
      expect(await feeToken.balanceOf(user2.address)).to.equal(lock.amount);
      await expect(locker.connect(user2).unlock(0)).to.be.revertedWith("LPLocker: already withdrawn");
    });
  });

  describe("burn bridge receiver", function () {
    function payload(args: {
      recipient: string;
      amount: bigint;
      chainId: number;
      nonce: bigint;
      extra?: string;
    }) {
      const body = ethers.concat([
        ethers.zeroPadValue(ethers.ZeroHash, 32),
        ethers.zeroPadValue(ethers.id("sender"), 32),
        ethers.getBytes(args.recipient),
        new Uint8Array(12),
        ethers.toBeHex(args.amount, 8),
        ethers.toBeHex(args.chainId, 2),
        ethers.toBeHex(args.nonce, 8),
      ]);
      return args.extra ? ethers.concat([body, args.extra]) : body;
    }

    it("mints once for a verified VAA and rejects bad signatures, emitters, replays, and malformed payloads", async function () {
      const Core = await ethers.getContractFactory("MockWormholeCore");
      const core = await Core.deploy();
      await core.waitForDeployment();

      const Token = await ethers.getContractFactory("BridgeMintableToken");
      const bridged = await Token.deploy("Bridged", "BRG", 18, owner.address);
      await bridged.waitForDeployment();

      const emitter = ethers.id("solana-emitter");
      const Receiver = await ethers.getContractFactory("BurnBridgeReceiver");
      const receiver = await Receiver.deploy(
        2,
        await core.getAddress(),
        emitter,
        await bridged.getAddress(),
        1_000_000_000n
      );
      await receiver.waitForDeployment();
      await bridged.connect(owner).setMinter(await receiver.getAddress());

      await expect(bridged.connect(user1).mint(user2.address, 1n)).to.be.revertedWithCustomError(
        bridged,
        "NotMinter"
      );

      const message = payload({
        recipient: user2.address,
        amount: 5n,
        chainId: 2,
        nonce: 1n,
      });
      await core.configure(true, 1, emitter, 1, message);
      await receiver.connect(user2).receiveMessage(message);
      expect(await bridged.balanceOf(user2.address)).to.equal(5n * 1_000_000_000n);

      await expect(receiver.connect(user1).receiveMessage(message)).to.be.revertedWith(
        "BurnBridgeReceiver: already processed"
      );

      const padded = payload({
        recipient: user2.address,
        amount: 5n,
        chainId: 2,
        nonce: 1n,
        extra: "0x01",
      });
      await core.configure(true, 1, emitter, 2, padded);
      await expect(receiver.receiveMessage(padded)).to.be.revertedWith(
        "BurnBridgeReceiver: bad payload length"
      );

      const badSig = payload({ recipient: user2.address, amount: 1n, chainId: 2, nonce: 8n });
      await core.configure(false, 1, emitter, 8, badSig);
      await expect(receiver.receiveMessage(badSig)).to.be.revertedWith("BurnBridgeReceiver: invalid VAA");

      const wrongEmitter = payload({ recipient: user2.address, amount: 1n, chainId: 2, nonce: 9n });
      await core.configure(true, 1, ethers.id("other-emitter"), 9, wrongEmitter);
      await expect(receiver.receiveMessage(wrongEmitter)).to.be.revertedWith(
        "BurnBridgeReceiver: emitter not allowed"
      );

      const sameSequence = payload({ recipient: user2.address, amount: 1n, chainId: 2, nonce: 10n });
      await core.configure(true, 1, emitter, 1, sameSequence);
      await expect(receiver.receiveMessage(sameSequence)).to.be.revertedWith(
        "BurnBridgeReceiver: sequence used"
      );

      const wrongChain = payload({ recipient: user2.address, amount: 5n, chainId: 4, nonce: 2n });
      await core.configure(true, 1, emitter, 11, wrongChain);
      await expect(receiver.receiveMessage(wrongChain)).to.be.revertedWith(
        "BurnBridgeReceiver: wrong target chain"
      );

      const wildcard = payload({ recipient: user2.address, amount: 2n, chainId: 0, nonce: 3n });
      await core.configure(true, 1, emitter, 12, wildcard);
      await expect(receiver.receiveMessage(wildcard)).to.be.revertedWith(
        "BurnBridgeReceiver: wildcard target disabled"
      );

      const zeroAmount = payload({ recipient: user2.address, amount: 0n, chainId: 2, nonce: 13n });
      await core.configure(true, 1, emitter, 13, zeroAmount);
      await expect(receiver.receiveMessage(zeroAmount)).to.be.revertedWith(
        "BurnBridgeReceiver: zero amount"
      );

      const queued = await receiver.connect(owner).queueSetAcceptWildcardTarget(true);
      const receipt = await queued.wait();
      const eta = receipt!.logs.find((l: any) => l.fragment?.name === "AdminOpQueued").args.eta as bigint;
      await expect(receiver.executeSetAcceptWildcardTarget(true, eta)).to.be.revertedWith(
        "DelayedAdmin: too early"
      );
      await time.increaseTo(eta);
      await receiver.executeSetAcceptWildcardTarget(true, eta);

      const allowed = payload({ recipient: user3.address, amount: 2n, chainId: 0, nonce: 4n });
      await core.configure(true, 1, emitter, 14, allowed);
      await receiver.receiveMessage(allowed);
      expect(await bridged.balanceOf(user3.address)).to.equal(2n * 1_000_000_000n);
    });
  });

  describe("admin delay and fee cap", function () {
    it("caps the flat launch fee and changes the delay only through the queue", async function () {
      await expect(
        factory.connect(owner).queueSetLaunchFee(ethers.parseEther("1") + 1n)
      ).to.be.revertedWith("TokenFactory: fee too high");

      const queued = await factory.connect(owner).queueSetLaunchFee(ethers.parseEther("0.01"));
      const receipt = await queued.wait();
      const queuedLog = receipt!.logs.find((l: any) => l.fragment?.name === "AdminOpQueued");
      const eta = queuedLog.args.eta as bigint;
      const opId = queuedLog.args.opId as string;
      await factory.connect(owner).cancelAdminOp(opId);
      await time.increaseTo(eta);
      await expect(
        factory.executeSetLaunchFee(ethers.parseEther("0.01"), eta)
      ).to.be.revertedWith("DelayedAdmin: not queued");

      await expect(factory.connect(owner).queueSetAdminDelay(30 * 60)).to.be.revertedWith(
        "DelayedAdmin: delay"
      );
      const delayTx = await factory.connect(owner).queueSetAdminDelay(2 * 60 * 60);
      const delayReceipt = await delayTx.wait();
      const delayEta = delayReceipt!.logs.find((l: any) => l.fragment?.name === "AdminOpQueued").args.eta as bigint;
      await expect(factory.executeSetAdminDelay(2 * 60 * 60, delayEta)).to.be.revertedWith(
        "DelayedAdmin: too early"
      );
      await time.increaseTo(delayEta);
      await factory.executeSetAdminDelay(2 * 60 * 60, delayEta);
      expect(await factory.adminDelay()).to.equal(2n * 60n * 60n);

      const addresses = await Promise.all(impls.map((c) => c.getAddress()));
      const Factory = await ethers.getContractFactory("TokenFactory");
      await expect(
        Factory.deploy(...addresses, ethers.parseEther("2"), feeRecipient.address)
      ).to.be.revertedWith("TokenFactory: fee too high");

      const atCap = await factory.connect(owner).queueSetLaunchFee(ethers.parseEther("1"));
      const capReceipt = await atCap.wait();
      const capEta = capReceipt!.logs.find((l: any) => l.fragment?.name === "AdminOpQueued").args.eta as bigint;
      await time.increaseTo(capEta);
      await expect(factory.executeSetLaunchFee(ethers.parseEther("1"), capEta))
        .to.emit(factory, "LaunchFeeUpdated")
        .withArgs(ethers.parseEther("1"));
      expect(await factory.launchFee()).to.equal(ethers.parseEther("1"));

      await expect(factory.connect(owner).queueSetReferralShareBps(5001)).to.be.revertedWith(
        "TokenFactory: referral share too high"
      );
      await expect(
        factory.connect(user1).createToken(params({ buyTaxBps: 2000, sellTaxBps: 1001 }), { value: ethers.parseEther("1") })
      ).to.be.revertedWith("TokenFactory: total fees exceed 30 %");
    });

    it("rejects token fee parameters above the hard caps", async function () {
      const taxable = await ethers.getContractAt(
        "TaxableERC20",
        await create({
          flavor: TokenFlavor.Taxable,
          buyTaxBps: 100,
          sellTaxBps: 100,
          marketingWallet: user2.address,
        })
      );
      await expect(taxable.connect(user1).setTax(2501, 0)).to.be.revertedWith("TaxableERC20: buy tax > 25 %");
      await expect(taxable.connect(user1).setTax(2500, 2500)).to.emit(taxable, "TaxUpdated").withArgs(2500, 2500);

      const deflationary = await ethers.getContractAt(
        "DeflationaryERC20",
        await create({ flavor: TokenFlavor.Deflationary, burnBps: 100 })
      );
      await expect(deflationary.connect(user1).setBurnBps(1001)).to.be.revertedWith(
        "DeflationaryERC20: burn > 10 %"
      );
      await expect(deflationary.connect(user1).setBurnBps(1000)).to.emit(deflationary, "BurnBpsUpdated").withArgs(1000);

      const reflection = await ethers.getContractAt(
        "ReflectionERC20",
        await create({ flavor: TokenFlavor.Reflection, reflectionBps: 100 })
      );
      await expect(reflection.connect(user1).setReflectionBps(1001)).to.be.revertedWith(
        "ReflectionERC20: reflection > 10 %"
      );

      const utility = await ethers.getContractAt(
        "UtilityHybridToken",
        await create({ flavor: TokenFlavor.UtilityHybrid, buyTaxBps: 100, burnBps: 100 })
      );
      await expect(utility.connect(user1).setRewardRate(501)).to.be.revertedWith(
        "UtilityHybridToken: reward > 5 %/day"
      );
      await expect(utility.connect(user1).setBurnBps(501)).to.be.revertedWith("UtilityHybridToken: burn > 5 %");
      await expect(utility.connect(user1).setBurnBps(500)).to.emit(utility, "BurnBpsUpdated").withArgs(500);

      const agent = await ethers.getContractAt(
        "AIAgentToken",
        await create({ flavor: TokenFlavor.AIAgent, burnBps: 100, marketingWallet: user2.address })
      );
      await expect(agent.connect(user1).setAgentBurnCap(501)).to.be.revertedWith(
        "AIAgentToken: burn cap > 5 %/day"
      );
      await expect(agent.connect(user1).setAgentBurnCap(500)).to.emit(agent, "AgentBurnCapUpdated").withArgs(500);

      await create({
        flavor: TokenFlavor.PumpMigrate,
        totalSupply: ethers.parseEther("1"),
        buyTaxBps: 300,
        marketingWallet: user2.address,
      });
      await expect(
        factory.connect(user1).createToken(
          params({
            flavor: TokenFlavor.PumpMigrate,
            totalSupply: ethers.parseEther("1"),
            buyTaxBps: 301,
            marketingWallet: user2.address,
          }),
          { value: LAUNCH_FEE }
        )
      ).to.be.revertedWith("TokenFactory: initialization failed");
    });
  });
});
