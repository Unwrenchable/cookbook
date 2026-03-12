import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying TokenForge contracts on network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ─── 1. Deploy template implementations ───────────────────────────────────
  console.log("Deploying template implementations...");

  const StandardERC20Factory = await ethers.getContractFactory("StandardERC20");
  const standardImpl = await StandardERC20Factory.deploy();
  await standardImpl.waitForDeployment();
  console.log(`  StandardERC20    → ${await standardImpl.getAddress()}`);

  const TaxableERC20Factory = await ethers.getContractFactory("TaxableERC20");
  const taxableImpl = await TaxableERC20Factory.deploy();
  await taxableImpl.waitForDeployment();
  console.log(`  TaxableERC20     → ${await taxableImpl.getAddress()}`);

  const DeflationaryERC20Factory = await ethers.getContractFactory("DeflationaryERC20");
  const deflationaryImpl = await DeflationaryERC20Factory.deploy();
  await deflationaryImpl.waitForDeployment();
  console.log(`  DeflationaryERC20 → ${await deflationaryImpl.getAddress()}`);

  const ReflectionERC20Factory = await ethers.getContractFactory("ReflectionERC20");
  const reflectionImpl = await ReflectionERC20Factory.deploy();
  await reflectionImpl.waitForDeployment();
  console.log(`  ReflectionERC20  → ${await reflectionImpl.getAddress()}`);

  const BondingCurveFactory = await ethers.getContractFactory("BondingCurveToken");
  const bondingCurveImpl = await BondingCurveFactory.deploy();
  await bondingCurveImpl.waitForDeployment();
  console.log(`  BondingCurveToken → ${await bondingCurveImpl.getAddress()}`);

  // ─── 2. Deploy the factory ────────────────────────────────────────────────
  console.log("\nDeploying TokenFactory...");

  // 0.001 ETH launch fee (adjust per chain)
  const launchFee    = ethers.parseEther("0.001");
  const feeRecipient = deployer.address; // replace with your treasury wallet

  const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
  const factory = await TokenFactoryContract.deploy(
    await standardImpl.getAddress(),
    await taxableImpl.getAddress(),
    await deflationaryImpl.getAddress(),
    await reflectionImpl.getAddress(),
    await bondingCurveImpl.getAddress(),
    launchFee,
    feeRecipient
  );
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log(`  TokenFactory      → ${factoryAddress}`);
  console.log(`  Launch fee        : ${ethers.formatEther(launchFee)} ETH`);
  console.log(`  Fee recipient     : ${feeRecipient}`);

  // ─── 3. Summary ───────────────────────────────────────────────────────────
  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify({
    network:          network.name,
    deployer:         deployer.address,
    tokenFactory:     factoryAddress,
    implementations: {
      standard:      await standardImpl.getAddress(),
      taxable:       await taxableImpl.getAddress(),
      deflationary:  await deflationaryImpl.getAddress(),
      reflection:    await reflectionImpl.getAddress(),
      bondingCurve:  await bondingCurveImpl.getAddress(),
    },
  }, null, 2));

  console.log("\nAdd the factory address to frontend/src/lib/chains.ts and you're live!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
