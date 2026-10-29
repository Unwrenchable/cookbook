import { expect } from "chai";
import { ethers } from "hardhat";

// Ported from the removed relayer-era BurnBridgeReceiver.test.ts. SecurityFixes
// "burn bridge receiver" already covers replay, bad VAA, emitter allowlist,
// sequence reuse, wrong chain, wildcard and zero amount. This keeps the one case it
// does not: a realistic 9-decimal burn, submitted by any wallet, mints
// amount * mintRatio and emits TokensActivated with the payload fields.
describe("BurnBridgeReceiver (wallet-submitted VAA)", function () {
  it("emits TokensActivated with the payload fields when a wallet submits a verified VAA", async function () {
    const [owner, submitter, recipient] = await ethers.getSigners();

    const Core = await ethers.getContractFactory("MockWormholeCore");
    const core = await Core.deploy();
    await core.waitForDeployment();

    const Token = await ethers.getContractFactory("BridgeMintableToken");
    const bridged = await Token.deploy("Bridged", "BRG", 18, owner.address);
    await bridged.waitForDeployment();

    const emitter = ethers.id("solana-emitter");
    const mintRatio = 1_000_000_000n;
    const Receiver = await ethers.getContractFactory("BurnBridgeReceiver");
    const receiver = await Receiver.deploy(
      2,
      await core.getAddress(),
      emitter,
      await bridged.getAddress(),
      mintRatio
    );
    await receiver.waitForDeployment();
    await bridged.connect(owner).setMinter(await receiver.getAddress());

    const solanaMint = ethers.id("solana-mint");
    const solanaSender = ethers.id("solana-sender");
    const amountBurned = 500_000_000_000n; // 500 tokens at 9 decimals
    const nonce = 7n;
    const message = ethers.concat([
      solanaMint,
      solanaSender,
      ethers.getBytes(recipient.address),
      new Uint8Array(12),
      ethers.toBeHex(amountBurned, 8),
      ethers.toBeHex(2, 2),
      ethers.toBeHex(nonce, 8),
    ]);
    await core.configure(true, 1, emitter, 1, message);

    await expect(receiver.connect(submitter).receiveMessage(message))
      .to.emit(receiver, "TokensActivated")
      .withArgs(solanaMint, solanaSender, recipient.address, amountBurned * mintRatio, nonce);
    expect(await bridged.balanceOf(recipient.address)).to.equal(amountBurned * mintRatio);
  });
});
