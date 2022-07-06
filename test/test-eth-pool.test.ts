import { ETHPool, EXA } from "../typechain";
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
  let team: Signer;
  let ownerAddress: string;
  let userAddress: string;
  let teamAddress: string;

  let ethPool: ETHPool;
  let exaToken: EXA;
  let initialSupply: BigNumber;

  beforeEach(async () => {
    // prepare (signers) ownerWallet and userWallet
    [owner, user, team] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();
    teamAddress = await team.getAddress();

    const exaFactory = await ethers.getContractFactory("EXA");
    exaToken = (await exaFactory.deploy()) as EXA;

    const ethPoolFactory = await ethers.getContractFactory("ETHPool");
    ethPool = (await ethPoolFactory.deploy(
      teamAddress,
      exaToken.address
    )) as ETHPool;
    await ethPool.deployed();
    await exaToken.transferOwnership(ethPool.address, { from: ownerAddress });
    initialSupply = await exaToken.totalSupply();
    logger.info(`initialSupply: ${initialSupply}`);
  });

  describe("constructor", () => {
    it("should initialize the contract with the variables correctly", async () => {
      const exaTokenContract = await ethPool.exaToken();
      const team = await ethPool.getTeam();

      expect(exaTokenContract).to.equal(exaToken.address);
      expect(team).to.equal(teamAddress);
      expect(await exaToken.owner()).to.eq(ethPool.address);
    });
  });

  describe("supply", () => {
    it.skip("should revert if the sender hasn't enough ETH amount", async () => {
      const userBalance = await ethers.provider.getBalance(userAddress);
      const amount = userBalance.add(1);
      await expect(
        ethPool.connect(user).supply({ from: userAddress, value: amount })
      ).to.reverted;
    });

    it("should supply the ethPool with the correct amount of eth", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const supply = await ethPool.connect(user).supply({
        from: userAddress,
        value: amount,
      });
      expect(supply).to.changeEtherBalance(ethPool.address, amount);
      expect(supply).to.changeEtherBalance(userAddress, -amount);
    });

    it("should mint the EXA token to the sender", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const senderBalanceBefore = await exaToken.balanceOf(userAddress);
      await ethPool.connect(user).supply({
        from: userAddress,
        value: amount,
      });

      const senderBalanceAfter = await exaToken.balanceOf(userAddress);
      expect(senderBalanceAfter).to.be.gt(senderBalanceBefore);
    });

    it("should update the total ETH amount deposited after supply", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({
        from: userAddress,
        value: amount,
      });

      const totalBalance = await ethPool.getAmountDeposited();
      expect(totalBalance).to.eq(amount);
    });
  });

  describe("withdraw", () => {
    it("should revert if the sender hasn't enough EXA amount", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const exaUserBalance = await exaToken.balanceOf(userAddress);
      const amountToWithdraw = exaUserBalance.add(1);
      await expect(
        ethPool.connect(user).withdraw(amountToWithdraw, { from: userAddress })
      ).to.revertedWith("ETHPool_NotLPAmount()");
    });

    it("should revert if the sender EXA amount is equal 0", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const exaUserBalance = await exaToken.balanceOf(userAddress);

      expect(exaUserBalance).to.equal(BigNumber.from(0));
      await expect(
        ethPool.connect(user).withdraw(amount, { from: userAddress })
      ).to.revertedWith("ETHPool_NotLPAmount()");
    });

    it("should withdraw the correct amount of EXA", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await exaToken.balanceOf(userAddress);

      logger.info(`amountToWithdraw: ${amountToWithdraw}`);

      const withdraw = await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      logger.info("here");

      expect(withdraw).to.changeEtherBalance(userAddress, amountToWithdraw);
      expect(withdraw).to.changeEtherBalance(
        ethPool.address,
        -amountToWithdraw
      );
    });

    it("should withdraw the correct amount of EXA, from different supply with different senders and amounts", async () => {
      const amountOne = ethers.utils.parseEther("0.5");
      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: amountOne });

      const amountTwo = ethers.utils.parseEther("0.6");
      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: amountTwo });

      const amountThree = ethers.utils.parseEther("0.7");
      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: amountThree });

      const amountToWithdrawOne = await exaToken.balanceOf(ownerAddress);
      const withdrawOne = await ethPool
        .connect(owner)
        .withdraw(amountToWithdrawOne, {
          from: ownerAddress,
        });

      const amountToWithdrawTwo = await exaToken.balanceOf(userAddress);
      const withdrawTwo = await ethPool
        .connect(user)
        .withdraw(amountToWithdrawTwo, {
          from: userAddress,
        });

      expect(withdrawOne).to.changeEtherBalance(
        userAddress,
        amountToWithdrawOne
      );
      expect(withdrawOne).to.changeEtherBalance(
        ethPool.address,
        -amountToWithdrawOne
      );

      expect(withdrawTwo).to.changeEtherBalance(
        userAddress,
        amountToWithdrawTwo
      );
      expect(withdrawTwo).to.changeEtherBalance(
        ethPool.address,
        -amountToWithdrawTwo
      );
    });

    it("should update the total ETH balance after withdraw", async () => {
      logger.info(`First ETH balance: ${await ethPool.getAmountDeposited()}`);
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await exaToken.balanceOf(userAddress);
      await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      const totalBalance = await ethPool.getAmountDeposited();
      expect(totalBalance).to.eq(BigNumber.from(0));
    });

    it("should burn correctly the EXA withdrawn amount", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const exaSupplyBefore = await exaToken.totalSupply();
      const amountToWithdraw = await exaToken.balanceOf(userAddress);

      await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      const exaSupplyAfter = await exaToken.totalSupply();
      expect(exaSupplyAfter).to.be.lt(exaSupplyBefore);
      expect(exaSupplyAfter).to.be.eq(initialSupply);
    });

    it("should burn correctly the EXA withdrawn amount, after multiple withdrawns", async () => {
      const amountOne = ethers.utils.parseEther("0.5");
      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: amountOne });

      const amountTwo = ethers.utils.parseEther("0.6");
      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: amountTwo });

      const exaSupplyZero = await exaToken.totalSupply();

      const amountToWithdrawOne = await exaToken.balanceOf(userAddress);
      await ethPool.connect(user).withdraw(amountToWithdrawOne, {
        from: userAddress,
      });

      const amountToWithdrawTwo = await exaToken.balanceOf(ownerAddress);
      await ethPool.connect(owner).withdraw(amountToWithdrawTwo, {
        from: ownerAddress,
      });

      const exaSupplyOne = await exaToken.totalSupply();
      expect(exaSupplyOne).to.be.lt(exaSupplyZero);
      expect(exaSupplyOne).to.be.eq(initialSupply);
    });
  });

  describe("receive", () => {
    it("should revert if the sender is not the team", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await expect(
        user.sendTransaction({ to: ethPool.address, value: amount })
      ).to.revertedWith("Error_SenderIsNotTeam()");
    });

    it("should receive the ETH and update the pool balance correctly", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await team.sendTransaction({ to: ethPool.address, value: amount });

      const poolEthBalance = await ethPool.getAmountDeposited();
      expect(poolEthBalance).to.eq(amount);
    });

    it("should receive the ETH and update the ETH balance in EXA token correctly only after the ETH sent from the team", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await team.sendTransaction({ to: ethPool.address, value: amount });

      const exaSupply = await exaToken.totalSupply();
      const exaEthPerUnit = await exaToken.getEthPerUnit();

      logger.info(exaSupply.toString());
      logger.info(amount.toString());
      expect(exaEthPerUnit).to.eq(exaSupply.div(amount));
    });

    it("should receive the ETH and update the ETH balance in EXA token correctly after a supply from user and ETH sent from the team", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      await team.sendTransaction({ to: ethPool.address, value: amount });

      const exaSupply = await exaToken.totalSupply();
      const exaEthPerUnit = await exaToken.getEthPerUnit();

      logger.info(exaSupply.toString());
      logger.info(amount.toString());
      expect(exaEthPerUnit).to.eq(exaSupply.div(amount.mul(2)));
    });

    it("should receive the ETH and update the ETH balance in EXA token correctly after multiples supply from different users and ETH sent from the team", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: amount });

      await team.sendTransaction({ to: ethPool.address, value: amount });

      const exaSupply = await exaToken.totalSupply();
      const exaEthPerUnit = await exaToken.getEthPerUnit();

      logger.info(exaSupply.toString());
      logger.info(amount.toString());
      expect(exaEthPerUnit).to.eq(exaSupply.div(amount.mul(3)));
    });
  });
});
