import { EXA } from "../typechain";
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
      const initialMintSupply = await exaToken.getInitialMintSupply();
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
      const initialMintSupply = await exaToken.getInitialMintSupply();
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

    it("should revert if there is no EXA minted", async () => {
      const zero = BigNumber.from("0");
      const ownerExaBalance = await exaToken.balanceOf(ownerAddress); // equal 0
      const ethAmount = ethers.utils.parseEther("0.1");
      const exaAmount = ethAmount;
      const exaSupply = await exaToken.totalSupply();

      expect(ownerExaBalance).to.be.equal(zero);
      expect(exaSupply).to.be.equal(zero);
      await expect(
        exaToken.burn(ownerAddress, exaAmount, ethAmount)
      ).to.be.revertedWith(
        `Error__NotEnoughAmount(${exaAmount}, ${ownerExaBalance}, ${exaSupply})`
      );
    });

    it("should revert if sender has not enough EXA amount", async () => {
      const zero = BigNumber.from("0");
      const ethAmount = ethers.utils.parseEther("0.6");
      const exaAmount = ethAmount;

      await exaToken
        .connect(owner)
        .mint(ownerAddress, ethAmount, { from: ownerAddress });

      const userExaBalance = await exaToken.balanceOf(userAddress);
      const exaSupply = await exaToken.totalSupply();

      expect(userExaBalance).to.be.equal(zero);
      await expect(
        exaToken
          .connect(user)
          .burn(userAddress, exaAmount, ethAmount, { from: userAddress })
      ).to.be.revertedWith(
        `Error__NotEnoughAmount(${exaAmount}, ${userExaBalance}, ${exaSupply})`
      );
    });

    it("should burn and update totalEthAmount and ethPerUnit correctly", async () => {
      const ethAmount = ethers.utils.parseEther("0.5");
      const initialMintSupply = await exaToken.getInitialMintSupply();
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
      const initialMintSupply = await exaToken.getInitialMintSupply();
      const ethPerUnit = initialMintSupply.div(ethAmount);

      await exaToken.addEthBalance(ethAmount);

      const totalEthAmount = await exaToken.getTotalEthAmount();
      const ethPerUnitContract = await exaToken.getEthPerUnit();

      expect(totalEthAmount).to.be.equal(ethAmount);
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);
    });
  });

  describe("_updateBalance", () => {
    it("should update ethPerUnit correctly after a mint, an addEthBalance and a burn on every phase", async () => {
      let ethAmount = ethers.utils.parseEther("0.3");
      const initialMintSupply = await exaToken.getInitialMintSupply();

      await exaToken.mint(userAddress, ethAmount);
      let ethPerUnit = initialMintSupply.div(ethAmount);
      let ethPerUnitContract = await exaToken.getEthPerUnit();
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);

      await exaToken.addEthBalance(ethAmount);
      ethAmount = ethAmount.add(ethAmount);
      let totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(ethAmount);
      ethPerUnitContract = await exaToken.getEthPerUnit();
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);

      const ownerExaBalance = await exaToken.balanceOf(userAddress);
      const ethToWithdraw = ownerExaBalance.div(ethPerUnit);
      expect(ethToWithdraw).to.be.gt(ethAmount.div(2)); // this checks that user receive the rewards
      await exaToken.burn(userAddress, ethToWithdraw, ownerExaBalance);

      ethAmount = ethAmount.sub(ethToWithdraw);
      totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(ethAmount);
      ethPerUnitContract = await exaToken.getEthPerUnit();
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);
    });

    it("should update ethPerunit after multiple mints, addEthBalance and burns of different addresses", async () => {
      const ethAmountOne = ethers.utils.parseEther("0.1");
      const ethAmountTwo = ethers.utils.parseEther("0.3");
      const ethAmountThree = ethers.utils.parseEther("0.7");
      const ethAmountFour = ethers.utils.parseEther("0.5");
      const zero = BigNumber.from("0");
      let totalEthAmount;
      let totalSupply;
      let ethPerUnit;
      let userExaBalance;
      let ethToWithdraw;

      await exaToken.mint(ownerAddress, ethAmountOne);
      await exaToken
        .connect(user)
        .mint(userAddress, ethAmountTwo, { from: userAddress });

      totalEthAmount = ethAmountOne.add(ethAmountTwo);
      totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      userExaBalance = await exaToken.balanceOf(userAddress);
      ethToWithdraw = userExaBalance.div(ethPerUnit);
      await exaToken
        .connect(user)
        .burn(userAddress, userExaBalance, ethToWithdraw, {
          from: userAddress,
        });

      totalEthAmount = totalEthAmount.sub(ethToWithdraw);
      totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      await exaToken.addEthBalance(ethAmountThree);

      totalEthAmount = totalEthAmount.add(ethAmountThree);
      ethPerUnit = totalSupply.div(totalEthAmount);

      await exaToken
        .connect(user)
        .mint(userAddress, ethAmountFour, { from: userAddress });

      totalEthAmount = totalEthAmount.add(ethAmountFour);
      totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      const ownerExaBalance = await exaToken.balanceOf(ownerAddress);
      ethToWithdraw = ownerExaBalance.div(ethPerUnit);
      await exaToken.burn(ownerAddress, ownerExaBalance, ethToWithdraw);

      totalEthAmount = totalEthAmount.sub(ethToWithdraw);
      totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      userExaBalance = await exaToken.balanceOf(userAddress);
      ethToWithdraw = userExaBalance.div(ethPerUnit);
      await exaToken
        .connect(user)
        .burn(userAddress, userExaBalance, ethToWithdraw, {
          from: userAddress,
        });

      totalEthAmount = totalEthAmount.sub(ethToWithdraw);
      totalSupply = await exaToken.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      const ethPerUnitContract = await exaToken.getEthPerUnit();
      const totalEthAmountContract = await exaToken.getTotalEthAmount();

      expect(ethPerUnitContract).to.be.equal(ethPerUnit);
      expect(totalEthAmountContract).to.be.equal(zero);
    });
  });

  /* View functions tests */
  describe("getEthPerUnit", () => {
    it("should return the ethPerUnit correctly", async () => {
      const zero = BigNumber.from("0");
      const ethPerUnitContract = await exaToken.getEthPerUnit();

      expect(ethPerUnitContract).to.be.equal(zero);
    });
  });

  describe("getTotalEthAmount", () => {
    it("should return the totalEthAmount correctly", async () => {
      const zero = BigNumber.from("0");
      const ethPerUnitContract = await exaToken.getTotalEthAmount();

      expect(ethPerUnitContract).to.be.equal(zero);
    });
  });

  describe("getInitialMintSupply", () => {
    it("should return correctly the initialMintSupply", async () => {
      const initialMintSupply = BigNumber.from(`${10 ** 18}`);
      const initialMintSupplContract = await exaToken.getInitialMintSupply();

      expect(initialMintSupplContract).to.be.equal(initialMintSupply);
    });
  });
});
