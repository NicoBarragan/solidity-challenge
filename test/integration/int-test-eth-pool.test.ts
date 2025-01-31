import deployEthPool from "../../scripts/eth-pool/deploy-eth-pool";
import getBalance from "../../scripts/utils/get-balance";
import { ETHPool } from "../../typechain";
import { expect, use } from "chai";
import "@nomiclabs/hardhat-ethers";
import { waffleChai } from "@ethereum-waffle/chai";
import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const logger = require("pino")();
use(waffleChai);

const found = process.argv.indexOf("--network");
const networkName = process.argv[found + 1]; // this for check after in etherscscan
const TIMEOUT = 1000 * 60 * 3; // 3 minutes
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

    ethPoolInitialBalance = await ethPool.balanceOf(userA.address);
    userAInitialBalance = await ethers.provider.getBalance(userA.address);
    teamInitialBalance = await ethers.provider.getBalance(team.address);
    userBInitialBalance = await ethers.provider.getBalance(userB.address);
    zero = ethers.utils.parseEther("0");
  });

  it("should complete the challenge proposed correctly", function (done) {
    this.timeout(TIMEOUT);

    (async () => {
      try {
        const userAEthAmount = userAInitialBalance.div(10);
        logger.info(`userAInitialBalance:   ${userAInitialBalance}`);
        logger.info(`userAEthAmount:        ${userAEthAmount}`);
        logger.info(`supplying with ETH from the userA...`);
        tx = await ethPool.supply({
          from: userA.address,
          value: userAEthAmount,
          gasLimit: GAS_LIMIT,
        });
        await tx.wait();
        logger.info(`supplied with ETH with userA!`);

        const teamBalance = teamInitialBalance;
        const ethAmountTeam = teamBalance.div(10);
        logger.info(`team balance:   ${teamBalance}`);
        logger.info(`ethAmountTeam:  ${ethAmountTeam}`);
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
        tx = await ethPool.connect(userB).supply({
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
        });
        await userAWithdrawTx.wait();
        logger.info(`Successful withdrawal of userA!`);

        const userBExaBalance = await ethPool.balanceOf(userB.address);
        logger.info(`Withdrawing all from the userB...`);
        const userBWithdrawTx = await ethPool
          .connect(userB)
          .withdraw(userBExaBalance, {
            from: userB.address,
          });
        await userBWithdrawTx.wait();
        logger.info(`Successful withdrawal of userB!`);

        logger.info(
          `TX's successfully finished! 
        Here you can see the ETHPool contract tx's: https://${networkName}.etherscan.io/address/${ethPool.address}`
        );

        const ethPoolFinalBalance = await getBalance(ethPool.address);

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
        done();
      } catch (err) {
        logger.error(err);
      }
    })();
  });
});
