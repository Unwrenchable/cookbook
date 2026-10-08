import { expect } from "chai";
import { ethers } from "hardhat";
import {
  assertBroadcastAllowed,
  LEAKED_SOLANA_EMITTER,
  MAINNET_CONFIRM,
  normalizeEmitter,
} from "../scripts/mainnetGuard";

describe("deploy broadcast guard", function () {
  const deployer = "0x0000000000000000000000000000000000000001";
  const treasury = "0x0000000000000000000000000000000000000002";
  const emitter = "0x" + "ab".repeat(32);

  afterEach(function () {
    delete process.env.CONFIRM_MAINNET;
    delete process.env.CONFIRM_NETWORK;
  });

  it("rejects the leaked program id and a zero emitter", function () {
    expect(() =>
      assertBroadcastAllowed({
        networkName: "sepolia",
        isMainnet: false,
        emitter: LEAKED_SOLANA_EMITTER,
        feeRecipient: deployer,
        deployer,
      })
    ).to.throw(/leaked/);
    expect(() =>
      assertBroadcastAllowed({
        networkName: "sepolia",
        isMainnet: false,
        emitter: ethers.ZeroHash,
        feeRecipient: deployer,
        deployer,
      })
    ).to.throw(/SOLANA_EMITTER/);
    expect(() =>
      assertBroadcastAllowed({
        networkName: "sepolia",
        isMainnet: false,
        emitter,
        feeRecipient: deployer,
        deployer,
      })
    ).to.not.throw();
  });

  it("requires both confirm flags and a distinct fee recipient on mainnet", function () {
    const base = {
      networkName: "base",
      isMainnet: true,
      emitter,
      feeRecipient: treasury,
      deployer,
    };
    expect(() => assertBroadcastAllowed(base)).to.throw(/CONFIRM_MAINNET/);
    process.env.CONFIRM_MAINNET = MAINNET_CONFIRM;
    process.env.CONFIRM_NETWORK = "optimism";
    expect(() => assertBroadcastAllowed(base)).to.throw(/CONFIRM_MAINNET/);
    process.env.CONFIRM_NETWORK = "base";
    expect(() => assertBroadcastAllowed({ ...base, feeRecipient: deployer })).to.throw(/multisig/);
    expect(() => assertBroadcastAllowed({ ...base, feeRecipient: ethers.ZeroAddress })).to.throw(/FEE_RECIPIENT/);
    expect(() => assertBroadcastAllowed(base)).to.not.throw();
  });

  it("left-pads a short emitter to 32 bytes", function () {
    expect(normalizeEmitter("0x01")).to.equal(ethers.zeroPadValue("0x01", 32).toLowerCase());
    expect(normalizeEmitter(undefined)).to.equal(ethers.ZeroHash);
  });
});
