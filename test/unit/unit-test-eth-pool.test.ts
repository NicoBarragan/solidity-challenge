import { ETHPool, MockV3Aggregator, MockDAI } from "../../typechain";
import { expect, use } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { waffleChai } from "@ethereum-waffle/chai";
import { BigNumber, logger, Signer } from "ethers";
use(waffleChai);

describe("ETHPool", () => {
  let owner: Signer;
  let user: Signer;
  let team: Signer;
  let ownerAddress: string;
  let userAddress: string;
  let teamAddress: string;

  let ethPool: ETHPool;
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

    // getethDaiPrice and set decimals, for MOCKVAgg contract, and for testing purpose
    ethDaiPrice = ethers.utils.parseEther("0.001");
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
      daiToken.address,
      mockV3Aggregator.address,
      "Exactly LP Token",
      "EXA"
    )) as ETHPool;
    await ethPool.deployed();

    initialSupply = await ethPool.totalSupply();

    // mint DAI tokens
    await daiToken.transfer(userAddress, BigNumber.from("3000"));
  });

  describe("constructor", () => {
    it("should initialize the contract with the variables correctly", async () => {
      const team = await ethPool.getTeam();
      const ethDaiPriceContract = await ethPool.getEthStablePrice();
      const stablecoin = await ethPool.stablecoin();
      const priceFeedAgg = await ethPool.priceFeedV3Aggregator();

      expect(team).to.equal(teamAddress);
      expect(ethDaiPriceContract.toString()).to.equal(ethDaiPrice.toString());
      expect(stablecoin).to.equal(daiToken.address);
      expect(priceFeedAgg).to.equal(mockV3Aggregator.address);
    });
  });

  describe("supply", () => {
    it("should revert if amount supplied is zero", async () => {
      const zero = BigNumber.from(0);
      const ethAmount = zero;

      await expect(
        ethPool.supply({ from: ownerAddress, value: ethAmount })
      ).to.be.revertedWith("Error__AmountIsZero()");
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

      const exaUserBalance = await ethPool.balanceOf(userAddress);
      const amountToWithdraw = exaUserBalance.add(1);
      await expect(
        ethPool.connect(user).withdraw(amountToWithdraw, { from: userAddress })
      ).to.revertedWith(
        `Error__NotEnoughAmount(${amountToWithdraw}, ${exaUserBalance})`
      );
    });

    it("should revert if the sender EXA amount is equal 0", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const exaUserBalance = await ethPool.balanceOf(userAddress);

      expect(exaUserBalance).to.equal(BigNumber.from(0));
      await expect(
        ethPool.connect(user).withdraw(amount, { from: userAddress })
      ).to.revertedWith(`Error__NotEnoughAmount(${amount}, ${exaUserBalance})`);
    });

    it("should withdraw the correct amount of EXA", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await ethPool.balanceOf(userAddress);

      const withdraw = await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      expect(withdraw).to.changeEtherBalance(userAddress, amountToWithdraw);
      expect(withdraw).to.changeEtherBalance(
        ethPool.address,
        -amountToWithdraw
      );
    });

    it("should withdraw the correct amount of EXA, from different supply with different senders and amounts", async () => {
      let amountUser = ethers.utils.parseEther("0.5");
      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: amountUser });

      const amountOwner = ethers.utils.parseEther("0.6");
      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: amountOwner });

      amountUser = ethers.utils.parseEther("0.7");
      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: amountUser });

      const amountToWithdrawOwner = await ethPool.balanceOf(ownerAddress);
      const withdrawOwner = await ethPool
        .connect(owner)
        .withdraw(amountToWithdrawOwner, {
          from: ownerAddress,
        });

      const amountToWithdrawUser = await ethPool.balanceOf(userAddress);
      const exaSupply = await ethPool.totalSupply();
      const withdrawUser = await ethPool
        .connect(user)
        .withdraw(amountToWithdrawUser, {
          from: userAddress,
        });

      expect(withdrawOwner).to.changeEtherBalance(
        ownerAddress,
        amountToWithdrawOwner
      );
      expect(withdrawOwner).to.changeEtherBalance(
        ethPool.address,
        -amountToWithdrawOwner
      );

      expect(withdrawUser).to.changeEtherBalance(
        userAddress,
        amountToWithdrawUser
      );
      expect(withdrawUser).to.changeEtherBalance(
        ethPool.address,
        -amountToWithdrawUser
      );
    });

    it("should update the total ETH balance after withdraw", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await ethPool.balanceOf(userAddress);
      await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      const totalBalance = await ethers.provider.getBalance(ethPool.address);
      expect(totalBalance).to.eq(BigNumber.from(0));
    });

    it("should emit Withdraw event correctly", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const amountToWithdraw = await ethPool.balanceOf(userAddress);
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

      const initialMintSupply = await ethPool.getInitialMintSupply();
      const ethPerUnit = initialMintSupply.div(ethAmount);
      const ethPerUnitContract = await ethPool.getEthPerUnit();

      expect(ethPerUnitContract).to.eq(ethPerUnit);
    });

    it("should receive the ETH and update the ETH balance in EXA token correctly after a supply from user and ETH sent from the team", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      await team.sendTransaction({ to: ethPool.address, value: amount });

      const exaSupply = await ethPool.totalSupply();
      const exaEthPerUnit = await ethPool.getEthPerUnit();

      expect(exaEthPerUnit).to.eq(exaSupply.div(amount.mul(2)));
    });

    it("should receive the ETH and update the ETH balance in EXA token correctly after multiples supply from different users and ETH sent from the team", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: amount });

      await team.sendTransaction({ to: ethPool.address, value: amount });

      const exaSupply = await ethPool.totalSupply();
      const exaEthPerUnit = await ethPool.getEthPerUnit();

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

  describe("_updateBalance", () => {
    it("should update ethPerUnit correctly after a mint, an addEthBalance and a burn on every phase", async () => {
      let ethAmount = ethers.utils.parseEther("0.3");
      const initialMintSupply = await ethPool.getInitialMintSupply();

      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: ethAmount });
      let ethPerUnit = initialMintSupply.div(ethAmount);
      let ethPerUnitContract = await ethPool.getEthPerUnit();
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);

      await team.sendTransaction({
        to: ethPool.address,
        value: ethAmount,
      });

      ethAmount = ethAmount.add(ethAmount);
      let totalSupply = await ethPool.totalSupply();
      ethPerUnit = totalSupply.div(ethAmount);
      ethPerUnitContract = await ethPool.getEthPerUnit();
      expect(ethPerUnitContract).to.be.equal(ethPerUnit);

      const ownerExaBalance = await ethPool.balanceOf(ownerAddress);
      await ethPool
        .connect(owner)
        .withdraw(ownerExaBalance, { from: ownerAddress });

      totalSupply = await ethPool.totalSupply();
      ethPerUnit = totalSupply.div(ethAmount);
      ethPerUnitContract = await ethPool.getEthPerUnit();

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

      await ethPool
        .connect(owner)
        .supply({ from: ownerAddress, value: ethAmountOne });
      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: ethAmountTwo });

      totalEthAmount = ethAmountOne.add(ethAmountTwo);
      totalSupply = await ethPool.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      userExaBalance = await ethPool.balanceOf(userAddress);
      ethToWithdraw = userExaBalance.div(ethPerUnit);
      await ethPool.connect(user).withdraw(userExaBalance, {
        from: userAddress,
      });

      totalEthAmount = totalEthAmount.sub(ethToWithdraw);
      totalSupply = await ethPool.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      await team.sendTransaction({
        to: ethPool.address,
        value: ethAmountThree,
      });

      totalEthAmount = totalEthAmount.add(ethAmountThree);
      ethPerUnit = totalSupply.div(totalEthAmount);

      await ethPool
        .connect(user)
        .supply({ from: userAddress, value: ethAmountFour });

      totalEthAmount = totalEthAmount.add(ethAmountFour);
      totalSupply = await ethPool.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      const ownerExaBalance = await ethPool.balanceOf(ownerAddress);
      ethToWithdraw = ownerExaBalance.div(ethPerUnit);
      await ethPool
        .connect(owner)
        .withdraw(ownerExaBalance, { from: ownerAddress });

      totalEthAmount = totalEthAmount.sub(ethToWithdraw);
      totalSupply = await ethPool.totalSupply();
      ethPerUnit = totalSupply.div(totalEthAmount);

      userExaBalance = await ethPool.balanceOf(userAddress);
      ethToWithdraw = userExaBalance.div(ethPerUnit);
      await ethPool.connect(user).withdraw(userExaBalance, {
        from: userAddress,
      });

      const ethPerUnitContract = await ethPool.getEthPerUnit();
      const totalEthAmountContract = await ethPool.getTotalEthAmount();

      expect(ethPerUnitContract).to.be.equal(zero);
      expect(totalEthAmountContract).to.be.equal(zero);
    });
  });

  describe("_mintEToken", () => {
    it("should mint the eToken to the sender after a supply()", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const senderBalanceBefore = await ethPool.balanceOf(userAddress);
      await ethPool.connect(user).supply({
        from: userAddress,
        value: amount,
      });

      const senderBalanceAfter = await ethPool.balanceOf(userAddress);
      expect(senderBalanceAfter).to.be.gt(senderBalanceBefore);
    });

    it("should mint correctly to the user that used and stablecoin in supplyWithStable for supplying liquidity", async () => {
      const daiAmount = BigNumber.from("1000");
      const userBalanceBefore = await ethPool.balanceOf(userAddress);

      await daiToken
        .connect(user)
        .approve(ethPool.address, daiAmount, { from: userAddress });
      await ethPool.connect(user).supplyWithStable(daiAmount, {
        from: userAddress,
      });

      const userBalanceAfter = await ethPool.balanceOf(userAddress);
      expect(userBalanceAfter).to.be.gt(userBalanceBefore);
    });
  });

  describe("_burnEToken", () => {
    it("should burn correctly the EXA withdrawn amount", async () => {
      const amount = ethers.utils.parseEther("0.5");
      await ethPool.connect(user).supply({ from: userAddress, value: amount });

      const exaSupplyBefore = await ethPool.totalSupply();
      const amountToWithdraw = await ethPool.balanceOf(userAddress);

      await ethPool.connect(user).withdraw(amountToWithdraw, {
        from: userAddress,
      });

      const exaSupplyAfter = await ethPool.totalSupply();
      expect(exaSupplyAfter).to.be.lt(exaSupplyBefore);
      expect(exaSupplyAfter).to.be.eq(initialSupply);
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

  describe("getEthStablePrice", () => {
    it("should return the ETH/DAI price correctly", async () => {
      const ethDaiPriceContract = await ethPool.getEthStablePrice();
      expect(ethDaiPriceContract).to.eq(BigNumber.from(ethDaiPrice));
    });
  });

  describe("getEthPerUnit", () => {
    it("should return the ethPerUnit correctly", async () => {
      const zero = BigNumber.from("0");
      const ethPerUnitContract = await ethPool.getEthPerUnit();

      expect(ethPerUnitContract).to.be.equal(zero);
    });
  });

  describe("getTotalEthAmount", () => {
    it("should return the totalEthAmount correctly", async () => {
      const zero = BigNumber.from("0");
      const ethPerUnitContract = await ethPool.getTotalEthAmount();

      expect(ethPerUnitContract).to.be.equal(zero);
    });
  });

  describe("getInitialMintSupply", () => {
    it("should return correctly the initialMintSupply", async () => {
      const initialMintSupply = BigNumber.from(`${10 ** 18}`);
      const initialMintSupplContract = await ethPool.getInitialMintSupply();

      // if I write 10 ** 36 directly it overflows and fails
      expect(initialMintSupplContract).to.be.equal(initialMintSupply.pow(2));
    });
  });

  describe("getTotalExaAmount", () => {
    it("should return the totalExaAmount correctly", async () => {
      const zero = BigNumber.from(0);
      const totalExaAmountContract = await ethPool.getTotalExaAmount();

      expect(totalExaAmountContract).to.be.equal(zero);
    });
  });
});
