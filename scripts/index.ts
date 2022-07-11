import deployEthPool from "./eth-pool/deploy-eth-pool";
import getContractBalance from "./utils/get-balance";
import { ethers } from "hardhat";
import { ETHPool, EXA } from "../typechain";
import { expect, use } from "chai";
import "@nomiclabs/hardhat-ethers";
import { waffleChai } from "@ethereum-waffle/chai";
import { BigNumber } from "ethers";
const logger = require("pino")();
use(waffleChai);

const { STABLECOIN_ADDRESS } = process.env;

(async () => {
  try {
    let tx;
    let ethPoolBalance;
    const zero = BigNumber.from("0");

    const [wallet, team] = await ethers.getSigners();

    const stablecoin = await ethers.getContractAt(
      "ERC20",
      `${STABLECOIN_ADDRESS}`
    );

    const ethPool = (await deployEthPool()) as ETHPool;
    logger.info(`ETHPool contract successfully deployed at ${ethPool.address}`);

    const walletBalance = await ethers.provider.getBalance(wallet.address);
    const ethAmountWallet = walletBalance.div(10);
    logger.info(`supplying with ETH from the main wallet...`);
    tx = await ethPool.supply({
      from: wallet.address,
      value: ethAmountWallet,
    });
    await tx.wait();
    logger.info(`supplied with ETH!`);

    const teamBalance = await ethers.provider.getBalance(team.address);
    const ethAmountTeam = walletBalance.div(10);
    logger.info(`Adding ETH from TEAM...`);
    tx = await team.sendTransaction({
      to: ethPool.address,
      value: ethAmountTeam,
    });
    await tx.wait();
    logger.info(`ETH from TEAM added!`);

    const walletStableBalance = await stablecoin.balanceOf(wallet.address);
    const stableAmountTeam = walletStableBalance.div(10);
    logger.info(`supplying with DAI from the main wallet...`);
    tx = await ethPool.supplyWithStable(stableAmountTeam, {
      from: wallet.address,
    });
    await tx.wait();
    logger.info(`supplied with DAI!`);

    const walletExaBalance = await ethPool.balanceOf(wallet.address);
    logger.info(`Withdrawing all from the main wallet...`);
    tx = await ethPool.withdraw(walletExaBalance, { from: wallet.address });
    await tx.wait();
    logger.info(`Successful withdrawal!`);

    ethPoolBalance = await getContractBalance(ethPool.address);
    logger.info(`The ETHPool ETH at the end is ${ethPoolBalance}`);

    logger.info(
      `TX's successfully finished! 
          Here you can see the ETHPool contract tx's: https://etherscan.io/address/${ethPool.address}`
    );

    expect(ethPoolBalance).to.be.equal(zero);
  } catch (err) {
    logger.error(err);
  }
})();
