import { expect } from "chai";
import { ethers, network } from "hardhat";
import { CANONICAL_DEX } from "../../../frontend/src/lib/canonicalDex";
import {
  FACTORY_SALT,
  NICK_DEPLOYER,
  NICK_RUNTIME,
  OFFICIAL_PAIR_INIT_HASH,
  ROUTER_SALT,
  deployCreate2,
  factoryInitCode,
  officialPairArtifact,
  pinnedFactoryAddress,
  pinnedRouterAddress,
  routerInitCode,
} from "../scripts/uniswapV2Bytecode";

const TESTNET_IDS = [80002, 421614, 84532, 11155420];
const DEAD = "0x000000000000000000000000000000000000dEaD";

describe("Testnet Uniswap V2 bytecode", function () {
  it("hashes the published pair creation code to the Uniswap V2 init-code hash", function () {
    const { bytecode } = officialPairArtifact();
    expect(ethers.keccak256(bytecode)).to.equal(OFFICIAL_PAIR_INIT_HASH);
  });

  it("pins those CREATE2 addresses only on the four testnets", async function () {
    const Harness = await ethers.getContractFactory("CanonicalDexHarness");
    const harness = await Harness.deploy();
    await harness.waitForDeployment();
    const factory = pinnedFactoryAddress();

    for (const venue of CANONICAL_DEX) {
      const got = await harness.venue(venue.chainId);
      expect(got.router).to.equal(venue.router);
      if (venue.origin === "testnet-deployment") {
        expect(TESTNET_IDS).to.include(venue.chainId);
        expect(venue.factory).to.equal(factory);
        expect(venue.router).to.equal(pinnedRouterAddress(venue.wrappedNative));
        expect(await harness.testnetDeployment(venue.chainId)).to.equal(true);
      } else {
        expect(venue.factory).to.not.equal(factory);
        expect(await harness.testnetDeployment(venue.chainId)).to.equal(false);
      }
    }

    for (const chainId of [1, 56, 137, 10, 31337, 80001, 81457, 130, 80094, 999, 146]) {
      expect(await harness.testnetDeployment(chainId)).to.equal(false);
      if (!CANONICAL_DEX.some((venue) => venue.chainId === chainId)) {
        expect((await harness.venue(chainId)).router).to.equal(ethers.ZeroAddress);
      }
    }
  });

  it("graduates a pump clone through the published router", async function () {
    await network.provider.send("hardhat_setCode", [NICK_DEPLOYER, NICK_RUNTIME]);
    const [deployer, buyer, feeWallet] = await ethers.getSigners();

    const Weth = await ethers.getContractFactory("TestWETH9");
    const weth = await Weth.deploy();
    await weth.waitForDeployment();
    const wethAddress = await weth.getAddress();

    const factory = await deployCreate2(deployer, FACTORY_SALT, factoryInitCode());
    expect(factory).to.equal(pinnedFactoryAddress());
    const router = await deployCreate2(deployer, ROUTER_SALT, routerInitCode(factory, wethAddress));
    expect(router).to.equal(pinnedRouterAddress(wethAddress));
    expect(router).to.not.equal(pinnedRouterAddress(CANONICAL_DEX.find((v) => v.chainId === 80002)!.wrappedNative));

    const Harness = await ethers.getContractFactory("PumpMigrateRouterHarness");
    const impl = await Harness.deploy();
    await impl.waitForDeployment();
    const implAddress = (await impl.getAddress()).toLowerCase().replace(/^0x/, "");
    const initCode = "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" + implAddress + "5af43d82803e903d91602b57fd5bf3";
    const tx = await deployer.sendTransaction({ data: initCode });
    const receipt = await tx.wait();
    const token = await ethers.getContractAt("PumpMigrateRouterHarness", receipt!.contractAddress!);
    await token.initialize(
      "Dry",
      "DRY",
      ethers.parseEther("0.01"),
      18,
      100,
      0,
      0,
      0,
      feeWallet.address,
      0,
      deployer.address
    );
    await token.setRouterForTest(router, false);
    await token.connect(buyer).buy(1, { value: ethers.parseEther("0.05") });

    expect(await token.isGraduated()).to.equal(true);
    expect(await token.dexRouter()).to.equal(router);
    expect(await token.ethReserve()).to.equal(0n);
    const pairAddress = await token.liquidityPair();
    const pair = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], pairAddress);
    expect(await pair.balanceOf(DEAD)).to.be.gt(0n);
    await expect(token.connect(buyer).sell(1n, 0)).to.be.revertedWith(
      "PumpMigrateToken: trading paused (graduating)"
    );
  });
});
