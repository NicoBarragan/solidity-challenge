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

    it("should emit the Supply event correctly", async () => {
      const amount = ethers.utils.parseEther("0.3");
      const supply = await ethPool.connect(user).supply({
        from: userAddress,
        value: amount,
      });
      await expect(supply)
        .to.emit(ethPool, "Supply")
        .withArgs(userAddress, amount);
    });
  });

  describe("supplyWithStable", () => {
    it("should revert if amount sent is zero", async () => {
      const daiAmount = BigNumber.from("0");

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmount, { from: userAddress });
      await expect(
        ethPool.connect(user).supplyWithStable(daiAmount, {
          from: userAddress,
        })
      ).to.be.revertedWith("Error__AmountIsZero()");
    });

    it("should revert if sender has not enough amount", async () => {
      const daiAmountUser = await daiToken.balanceOf(userAddress);
      const daiAmountReq = daiAmountUser.add(BigNumber.from("1"));

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmountReq, { from: userAddress });

      await expect(
        ethPool.connect(user).supplyWithStable(daiAmountReq, {
          from: userAddress,
        })
      ).to.be.revertedWith(
        `Error__NotEnoughAmount(${daiAmountReq}, ${daiAmountUser})`
      );
    });

    it("should revert if sender eth/stable gas feed fails and returns 0", async () => {
      const daiAmount = await daiToken.balanceOf(userAddress);
      const zero = BigNumber.from("0");
      await mockV3Aggregator.updateAnswer(zero);

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmount, { from: userAddress });

      await expect(
        ethPool.connect(user).supplyWithStable(daiAmount, {
          from: userAddress,
        })
      ).to.be.revertedWith(`Error__DivFailed(${daiAmount}, ${zero})`);
    });

    it("should supply correctly using DAI", async () => {
      const daiAmount = BigNumber.from("1000");
      const ethAmount = daiAmount.mul(ethDaiPrice);

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmount, { from: userAddress });
      const tx = await ethPool.connect(user).supplyWithStable(daiAmount, {
        from: userAddress,
      });

      expect(tx).to.changeTokenBalance(
        daiToken.address,
        userAddress,
        -daiAmount
      );
      expect(tx).to.changeTokenBalance(ethPool.address, userAddress, ethAmount);
    });

    it("should mint correctly to the user that used DAI to supply", async () => {
      const daiAmount = BigNumber.from("1000");
      const userBalanceBefore = await exaToken.balanceOf(userAddress);

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmount, { from: userAddress });
      await ethPool.connect(user).supplyWithStable(daiAmount, {
        from: userAddress,
      });

      const userBalanceAfter = await exaToken.balanceOf(userAddress);
      expect(userBalanceAfter).to.be.gt(userBalanceBefore);
    });

    it("should emit the event correctly with other value for ethDaiPriceFeed", async () => {
      const daiAmount = BigNumber.from("2000");
      const newEthDaiPrice = BigNumber.from("2300");

      await mockV3Aggregator.updateAnswer(newEthDaiPrice);
      const ethAmount = daiAmount
        .mul(ethers.utils.parseEther("1"))
        .div(newEthDaiPrice);

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmount, { from: userAddress });
      const tx = await ethPool.connect(user).supplyWithStable(daiAmount, {
        from: userAddress,
      });

      await expect(tx)
        .to.emit(ethPool, "Supply")
        .withArgs(userAddress, ethAmount);
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
      ).to.revertedWith(
        `Error__NotEnoughAmount(${amountToWithdraw}, ${exaUserBalance})`
      );
    });

    it("should revert if the sender EXA amount is equal 0", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const exaUserBalance = await exaToken.balanceOf(userAddress);

      expect(exaUserBalance).to.equal(BigNumber.from(0));
      await expect(
        ethPool.connect(user).withdraw(amount, { from: userAddress })
      ).to.revertedWith(`Error__NotEnoughAmount(${amount}, ${exaUserBalance})`);
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

    it("should emit Withdraw event correctly", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await exaToken.balanceOf(userAddress);
      const tx = await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      await expect(tx)
        .to.emit(ethPool, "Withdraw")
        .withArgs(userAddress, amount);
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
      const ethAmount = ethers.utils.parseEther("0.5");
      await team.sendTransaction({ to: ethPool.address, value: ethAmount });

      const initialMintSupply = await exaToken.getInitialMintSupply();
      const ethPerUnit = initialMintSupply.div(ethAmount);
      const exaEthPerUnit = await exaToken.getEthPerUnit();

      expect(exaEthPerUnit).to.eq(ethPerUnit);
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

    it("should emit TeamAddedETH event correctly", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const tx = await team.sendTransaction({
        to: ethPool.address,
        value: amount,
      });

      await expect(tx)
        .to.emit(ethPool, "TeamAddedETH")
        .withArgs(teamAddress, amount);
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
