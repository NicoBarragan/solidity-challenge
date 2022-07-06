import { ETHPool, EXA, MockV3Aggregator, MockDAI } from "../typechain";
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
  let daiToken: MockDAI;
  let mockV3Aggregator: MockV3Aggregator;
  let ethDaiPrice: BigNumber;
  let initialSupply: BigNumber;
  let userDaiBalance: BigNumber;
  let ownerDaiBalance: BigNumber;

  beforeEach(async () => {
    // prepare (signers) ownerWallet and userWallet
    [owner, user, team] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();
    teamAddress = await team.getAddress();

    const exaFactory = await ethers.getContractFactory("EXA");
    exaToken = (await exaFactory.deploy()) as EXA;

    // getethDaiPrice and set decimals, for MOCKVAgg contract, and for testing purpose
    ethDaiPrice = ethers.utils.parseEther("0.001");
    logger.info(`ethDaiPrice: ${ethDaiPrice}`);
    const decimals = BigNumber.from("18");

    // define token mock contract (DAI token for testing)
    const mockDAITokenFactory = await ethers.getContractFactory("MockDAI");
    daiToken = (await mockDAITokenFactory.deploy()) as MockDAI;

    // get and deploy MockV3Aggregator contract (returns gas price)
    const mockAggFactory = await ethers.getContractFactory("MockV3Aggregator");
    mockV3Aggregator = (await mockAggFactory.deploy(
      decimals,
      ethDaiPrice
    )) as MockV3Aggregator;

    const ethPoolFactory = await ethers.getContractFactory("ETHPool");
    ethPool = (await ethPoolFactory.deploy(
      teamAddress,
      exaToken.address,
      daiToken.address,
      mockV3Aggregator.address
    )) as ETHPool;
    await ethPool.deployed();

    await exaToken.transferOwnership(ethPool.address, { from: ownerAddress });

    initialSupply = await exaToken.totalSupply();
    logger.info(`initialSupply: ${initialSupply}`);

    // mint DAI tokens
    await daiToken.transfer(userAddress, BigNumber.from("3000"));
    userDaiBalance = await daiToken.balanceOf(userAddress);
    ownerDaiBalance = await daiToken.balanceOf(ownerAddress);
  });

  describe("constructor", () => {
    it("should initialize the contract with the variables correctly", async () => {
      const exaTokenContract = await ethPool.getExaToken();
      const exaOwner = await exaToken.owner();
      const team = await ethPool.getTeam();
      const ethDaiPriceContract = await ethPool.getEthDaiPrice();
      const stablecoin = await ethPool.stablecoin();
      const priceFeedAgg = await ethPool.priceFeedV3Aggregator();

      expect(exaTokenContract).to.equal(exaToken.address);
      expect(team).to.equal(teamAddress);
      expect(exaOwner).to.eq(ethPool.address);
      expect(ethDaiPriceContract.toString()).to.equal(ethDaiPrice.toString());
      expect(stablecoin).to.equal(daiToken.address);
      expect(priceFeedAgg).to.equal(mockV3Aggregator.address);
    });
  });

  describe("supply", () => {
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

      const totalBalance = await ethers.provider.getBalance(ethPool.address);
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
      ).to.revertedWith("Error__NotLPAmount()");
    });

    it("should revert if the sender EXA amount is equal 0", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const exaUserBalance = await exaToken.balanceOf(userAddress);

      expect(exaUserBalance).to.equal(BigNumber.from(0));
      await expect(
        ethPool.connect(user).withdraw(amount, { from: userAddress })
      ).to.revertedWith("Error__NotLPAmount()");
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
      logger.info(
        `First ETH balance: ${await ethers.provider.getBalance(
          ethPool.address
        )}`
      );
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await exaToken.balanceOf(userAddress);
      await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      const totalBalance = await ethers.provider.getBalance(ethPool.address);
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
      ).to.revertedWith("Error__SenderIsNotTeam()");
    });

    it("should receive the ETH and update the pool balance correctly", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await team.sendTransaction({ to: ethPool.address, value: amount });

      const poolEthBalance = await ethers.provider.getBalance(ethPool.address);
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

  describe("updateTeam", () => {
    it("should update the team address correctly", async () => {
      const newteam = ethers.Wallet.createRandom();
      const newteamAddress = newteam.address;

      await ethPool.connect(team).updateTeam(newteamAddress, {
        from: teamAddress,
      });

      expect(await ethPool.getTeam()).to.eq(newteamAddress);
    });
  });

  /* View functions tests */
  describe("getTeam", () => {
    it("should return the team address correctly", async () => {
      expect(await ethPool.getTeam()).to.eq(teamAddress);
    });
  });

  describe("getEthDaiPrice", () => {
    it("should return the ETH/DAI price correctly", async () => {
      const ethDaiPriceContract = await ethPool.getEthDaiPrice();
      expect(ethDaiPriceContract).to.eq(BigNumber.from(ethDaiPrice));
    });
  });

  describe("getExaToken", () => {
    it("should return the EXA token address correctly", async () => {
      expect(await ethPool.getExaToken()).to.eq(exaToken.address);
    });
  });
});
