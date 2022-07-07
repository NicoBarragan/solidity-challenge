import { EXA, IEXA, ETHPool } from "../typechain";
import { expect, use } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { waffleChai } from "@ethereum-waffle/chai";
import { BigNumber, Signer } from "ethers";
const logger = require("pino")();
use(waffleChai);

describe("ETHPool", () => {
  let owner: Signer;
  let user: Signer;
  let ownerAddress: string;
  let userAddress: string;

  let exaToken: EXA;
  let initialSupply: BigNumber;

  beforeEach(async () => {
    // prepare (signers) ownerWallet and userWallet
    [owner, user] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();

    const exaFactory = await ethers.getContractFactory("EXA");
    exaToken = (await exaFactory.deploy()) as EXA;

    // await exaToken.transferOwnership(ethPool.address, { from: ownerAddress });

    initialSupply = await exaToken.totalSupply();
    logger.info(`initialSupply: ${initialSupply}`);
  });

  describe("constructor", () => {
    it("should deploy and intialize the variables correctly", async () => {
      const exaSupply = await exaToken.totalSupply();
      const ethPerUnit = await exaToken.getEthPerUnit();
      const getTotalEthAmount = await exaToken.getTotalEthAmount();
      const zero = BigNumber.from(0);
      const name = await exaToken.name();
      const symbol = await exaToken.symbol();
      const owner = await exaToken.owner();

      expect(exaSupply).to.be.equal(initialSupply);
      expect(ethPerUnit).to.be.equal(zero);
      expect(getTotalEthAmount).to.be.equal(zero);
      expect(name).to.be.equal("Exactly Token");
      expect(symbol).to.be.equal("EXA");
      expect(owner).to.be.equal(ownerAddress);
    });
  });

  describe("mint", () => {
    it("should revert if amount is zero", async () => {
      const zero = BigNumber.from(0);
      const ethAmount = zero;

      await expect(exaToken.mint(ownerAddress, ethAmount)).to.be.revertedWith(
        "Error__AmountIsZero()"
      );
    });

    it("should revert if _to param is equal to address zero", async () => {
      const ethAmount = ethers.utils.parseEther("0.5");
      const zeroAddress = ethers.constants.AddressZero;

      await expect(
        exaToken.connect(user).mint(zeroAddress, ethAmount)
      ).to.be.revertedWith("Error__AddressZero()");
    });

    it("should mint to the address and update the totalEthAmount and ethPerUnit correctly when is the first mint", async () => {
      const ethAmount = ethers.utils.parseEther("0.5");
      const initialMintSupply = ethers.utils.parseEther("1");
      const ethPerUnit = initialMintSupply.div(ethAmount);
      const exaAmount = ethAmount.mul(ethPerUnit);

      const mintTx = await exaToken.mint(userAddress, ethAmount);
      const totalEthAmount = await exaToken.getTotalEthAmount();
      const totalSupply = await exaToken.totalSupply();
      const ethPerUnitContract = await exaToken.getEthPerUnit();

      expect(mintTx).to.changeTokenBalance(exaToken, user, exaAmount);
      expect(totalEthAmount).to.be.equal(ethAmount);
      expect(totalSupply).to.be.equal(exaAmount);
      expect(ethPerUnit).to.be.equal(ethPerUnitContract);
    });

    it("should mint to the address and update the totalEthAmount and ethPerUnit correctly when is not the first mint", async () => {
      let ethAmount = ethers.utils.parseEther("0.5");
      const initialMintSupply = ethers.utils.parseEther("1");
      let ethPerUnit = initialMintSupply.div(ethAmount);
      let exaAmount = ethAmount.mul(ethPerUnit);

      await exaToken.mint(userAddress, ethAmount);

      const secondMintTx = await exaToken.mint(userAddress, ethAmount);
      const totalEthAmount = await exaToken.getTotalEthAmount();
      const totalSupply = await exaToken.totalSupply();
      const ethPerUnitContract = await exaToken.getEthPerUnit();

      ethAmount = ethAmount.mul(2);
      logger.info(ethAmount);
      ethPerUnit = totalSupply.div(ethAmount);
      exaAmount = exaAmount.mul(2);

      expect(secondMintTx).to.changeTokenBalance(exaToken, user, exaAmount);
      expect(totalEthAmount).to.be.equal(ethAmount);
      logger.info(1);
      expect(totalSupply).to.be.equal(exaAmount);
      logger.info(2);
      expect(ethPerUnit).to.be.equal(ethPerUnitContract);
    });

    // TODO: test if mints correctly with multiple mints and a burn
  });

  describe("burn", () => {
    it("should revert if burn amount is zero", async () => {
      const exaAmount = ethers.utils.parseEther("0.5");
      const zero = BigNumber.from("0");
      const ethAmount = zero;

      await expect(
        exaToken.burn(userAddress, exaAmount, ethAmount)
      ).to.be.revertedWith("Error__AmountIsZero()");
    });

    it("should burn and update totalEthAmount and ethPerUnit correctly", async () => {
      const ethAmount = ethers.utils.parseEther("0.5");
      const initialMintSupply = ethers.utils.parseEther("1");
      const ethPerUnit = initialMintSupply.div(ethAmount);
      const exaAmount = ethAmount.mul(ethPerUnit);
      const zero = BigNumber.from("0");

      await exaToken.mint(userAddress, ethAmount);
      const tx = await exaToken.burn(userAddress, exaAmount, ethAmount);

      const totalEthAmount = await exaToken.getTotalEthAmount();
      const totalSupply = await exaToken.totalSupply();
      const ethPerUnitContract = await exaToken.getEthPerUnit();

      expect(tx).to.changeTokenBalance(exaToken, user, -exaAmount);
      expect(totalSupply).to.be.equal(zero);
      expect(totalEthAmount).to.be.equal(zero);
      expect(ethPerUnitContract).to.be.equal(zero);
    });
  });

  describe("addEthBalance", () => {
    it("should revert if amount is zero", async () => {
      const zero = BigNumber.from("0");
      const amount = zero;

      await expect(exaToken.addEthBalance(amount)).to.be.revertedWith(
        "Error__AmountIsZero()"
      );
    });

    it("should update totalEthAmount and ethPerUnit correctly", async () => {
      const ethAmount = ethers.utils.parseEther("0.4");
      const initialMintSupply = ethers.utils.parseEther("1");
      const ethPerUnit = initialMintSupply.div(ethAmount);

      await exaToken.addEthBalance(ethAmount);

      const totalEthAmount = await exaToken.getTotalEthAmount();
      const ethPerUnitContract = await exaToken.getEthPerUnit();

      expect(totalEthAmount).to.be.equal(ethAmount);
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);
    });
  });

  describe("_updateBalance", () => {});
});
