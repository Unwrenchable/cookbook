import { expect } from "chai";
import { ethers } from "hardhat";
import { BurnBridgeReceiver, MockMintable } from "../typechain-types";

describe("BurnBridgeReceiver", function () {
  let receiver: BurnBridgeReceiver;
  let mintable: MockMintable;

  async function buildPayload(args: {
    recipient: string;
    amountBurned: bigint;
    targetChainId: number;
    nonce: bigint;
  }) {
    const solanaMint = ethers.randomBytes(32);
    const solanaSender = ethers.randomBytes(32);
    const recipient = Buffer.from(args.recipient.slice(2), "hex");
    const amount = Buffer.alloc(8);
    const chainId = Buffer.alloc(2);
    const nonce = Buffer.alloc(8);

    amount.writeBigUInt64BE(args.amountBurned);
    chainId.writeUInt16BE(args.targetChainId);
    nonce.writeBigUInt64BE(args.nonce);

    return ethers.hexlify(
      Buffer.concat([
        Buffer.from(solanaMint),
        Buffer.from(solanaSender),
        recipient,
        Buffer.alloc(12),
        amount,
        chainId,
        nonce,
      ])
    );
  }

  beforeEach(async function () {
    const [owner, , recipient] = await ethers.getSigners();

    const MockMintableFactory = await ethers.getContractFactory("MockMintable");
    mintable = await MockMintableFactory.deploy() as MockMintable;
    await mintable.waitForDeployment();

    const BurnBridgeReceiverFactory = await ethers.getContractFactory("BurnBridgeReceiver");
    receiver = await BurnBridgeReceiverFactory.deploy(
      2,
      owner.address,
      ethers.zeroPadValue("0x1234", 32),
      await mintable.getAddress(),
      1_000_000_000n
    ) as BurnBridgeReceiver;
    await receiver.waitForDeployment();

    const [, relayer] = await ethers.getSigners();
    await receiver.connect(owner).setTrustedRelayer(relayer.address, true);

    expect(await mintable.balanceOf(recipient.address)).to.equal(0n);
  });

  it("mints tokens for a trusted relayer payload", async function () {
    const [, relayer, recipient] = await ethers.getSigners();
    const payload = await buildPayload({
      recipient: recipient.address,
      amountBurned: 500_000_000_000n,
      targetChainId: 2,
      nonce: 7n,
    });

    await expect(
      receiver.connect(relayer).receiveRelayedMessage(payload, ethers.keccak256(payload))
    ).to.emit(receiver, "TokensActivated");

    expect(await mintable.balanceOf(recipient.address)).to.equal(500_000_000_000_000_000_000n);
  });

  it("rejects untrusted relayers", async function () {
    const [, , recipient] = await ethers.getSigners();
    const payload = await buildPayload({
      recipient: recipient.address,
      amountBurned: 100_000_000_000n,
      targetChainId: 2,
      nonce: 1n,
    });

    await expect(
      receiver.connect(recipient).receiveRelayedMessage(payload, ethers.keccak256(payload))
    ).to.be.revertedWith("BurnBridgeReceiver: not a trusted relayer");
  });

  it("rejects replayed payloads", async function () {
    const [, relayer, recipient] = await ethers.getSigners();
    const payload = await buildPayload({
      recipient: recipient.address,
      amountBurned: 100_000_000_000n,
      targetChainId: 2,
      nonce: 2n,
    });
    const messageKey = ethers.keccak256(payload);

    await receiver.connect(relayer).receiveRelayedMessage(payload, messageKey);

    await expect(
      receiver.connect(relayer).receiveRelayedMessage(payload, messageKey)
    ).to.be.revertedWith("BurnBridgeReceiver: already processed");
  });

  it("allows broadcast payloads with targetChainId=0", async function () {
    const [, relayer, recipient] = await ethers.getSigners();
    const payload = await buildPayload({
      recipient: recipient.address,
      amountBurned: 1_000_000_000_000n,
      targetChainId: 0,
      nonce: 3n,
    });

    await receiver.connect(relayer).receiveRelayedMessage(payload, ethers.keccak256(payload));

    expect(await mintable.balanceOf(recipient.address)).to.equal(1_000_000_000_000_000_000_000n);
  });
});
