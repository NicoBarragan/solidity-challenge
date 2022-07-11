import deployEthPool from "../../scripts/eth-pool/deploy-eth-pool";
import getContractBalance from "../../scripts/utils/get-balance";
import { ethers } from "hardhat";
import { ETHPool, ERC20 } from "../../typechain";
import { expect, use } from "chai";
import "@nomiclabs/hardhat-ethers";
import { waffleChai } from "@ethereum-waffle/chai";
import { BigNumber, ContractTransaction, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const logger = require("pino")();
use(waffleChai);

const { DAI_ADDRESS } = process.env;
const found = process.argv.indexOf("--network");
const networkName = process.argv[found + 1]; // this for check after in etherscscan
const GAS_LIMIT = 2074040;

describe("integration-ETHPool", () => {
  let userA: SignerWithAddress;
  let team: SignerWithAddress;
  let userB: SignerWithAddress;
  let userAInitialBalance: BigNumber;
  let teamInitialBalance: BigNumber;
  let userBInitialBalance: BigNumber;
  let ethPool: ETHPool;
  let ethPoolInitialBalance: BigNumber;
  let tx: ContractTransaction;
  let zero: BigNumber;

  beforeEach(async () => {
    [userA, team, userB] = await ethers.getSigners();

    logger.info(`userA address: ${userA.address}`);
    logger.info(`team address: ${team.address}`);
    logger.info(`userB address: ${userB.address}`);

    ethPool = (await deployEthPool()) as ETHPool;
    logger.info(`ETHPool contract successfully deployed at ${ethPool.address}`);

    userAInitialBalance = await ethers.provider.getBalance(userA.address);
    teamInitialBalance = await ethers.provider.getBalance(team.address);
    userBInitialBalance = await ethers.provider.getBalance(userB.address);
    ethPoolInitialBalance = await getContractBalance(ethPool.address);
    zero = BigNumber.from("0");
  });

  it("should complete the challenge proposed correctly", async function (done) {
    this.timeout(20000); // for giving enough time for the tx to be completed

    try {
      const userAEthAmount = userAInitialBalance.div(10);
      logger.info(`supplying with ETH from the userA...`);
      tx = await ethPool.supply({
        from: userA.address,
        value: userAEthAmount,
        gasLimit: GAS_LIMIT,
      });
      await tx.wait();
      logger.info(`supplied with ETH with userA!`);

      const teamBalance = await ethers.provider.getBalance(team.address);
      logger.info(`team balance: ${teamBalance}`);
      const ethAmountTeam = teamBalance.div(10);
      logger.info(`ethAmountTeam: ${ethAmountTeam}`);
      logger.info(`Adding ETH from TEAM...`);
      tx = await team.sendTransaction({
        to: ethPool.address,
        value: ethAmountTeam,
        gasLimit: GAS_LIMIT,
      });
      await tx.wait();
      logger.info(`ETH from TEAM added!`);

      const userBEthAmount = userBInitialBalance.div(10);
      logger.info(`userBEthAmount: ${userBEthAmount}`);
      logger.info(`supplying with ETH from the userB...`);
      tx = await ethPool.supply({
        from: userB.address,
        value: userBEthAmount,
        gasLimit: GAS_LIMIT,
      });
      await tx.wait();
      logger.info(`supplied with ETH with userB!`);

      const userAExaBalance = await ethPool.balanceOf(userA.address);
      logger.info(`Withdrawing all from the userA...`);
      const userAWithdrawTx = await ethPool.withdraw(userAExaBalance, {
        from: userA.address,
        gasLimit: GAS_LIMIT,
      });
      await tx.wait();
      logger.info(`Successful withdrawal of userA!`);

      const userBExaBalance = await ethPool.balanceOf(userB.address);
      logger.info(`Withdrawing all from the userB...`);
      const userBWithdrawTx = await ethPool.withdraw(userBExaBalance, {
        from: userB.address,
        gasLimit: GAS_LIMIT,
      });
      await tx.wait();
      logger.info(`Successful withdrawal of userB!`);

      const ethPoolFinalBalance = await getContractBalance(ethPool.address);
      logger.info(`The ETHPool ETH at the end is ${ethPoolFinalBalance}`);

      logger.info(
        `TX's successfully finished! 
        Here you can see the ETHPool contract tx's: https://${networkName}.etherscan.io/address/${ethPool.address}`
      );

      expect(ethPoolFinalBalance).to.be.equal(ethPoolInitialBalance);
      expect(ethPoolFinalBalance).to.be.equal(zero);
      expect(userAWithdrawTx).to.changeEtherBalance(
        userA.address,
        userAEthAmount.add(ethAmountTeam)
      );
      expect(userBWithdrawTx).to.changeEtherBalance(
        userB.address,
        userBEthAmount
      );
    } catch (err) {
      logger.eror(err);
    }
    done();
  });
});
