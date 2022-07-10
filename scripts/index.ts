import deployEthPool from "./eth-pool/deploy-eth-pool";
import deployExa from "./exa/deploy-exa";
import getContractBalance from "./utils/get-balance";
import { ethers } from "hardhat";
import { ETHPool, EXA } from "../typechain";
const logger = require("pino")();

const { STABLECOIN_ADDRESS } = process.env;

(async () => {
  try {
    let tx;
    let ethPoolBalance;

    const [wallet, team] = await ethers.getSigners();

    const stablecoin = await ethers.getContractAt(
      "ERC20",
      `${STABLECOIN_ADDRESS}`
    );

    logger.info(`deploying contracts...`);
    const exaToken = (await deployExa(wallet.address)) as EXA;
    logger.info(`EXA contract successfully deployed at ${exaToken.address}`);
    const ethPool = (await deployEthPool(exaToken.address)) as ETHPool;
    logger.info(`ETHPool contract successfully deployed at ${ethPool.address}`);

    logger.info(
      `transferring ownership of EXA token from main wallet to ETHPool...`
    );
    tx = await exaToken.transferOwnership(ethPool.address, {
      from: wallet.address,
    });
    tx.wait();
    logger.info(`ownership transferred!`);

    const walletBalance = await ethers.provider.getBalance(wallet.address);
    const ethAmountWallet = walletBalance.div(10);
    logger.info(`supplying with ETH from the main wallet...`);
    tx = await ethPool.supply({ from: wallet.address, value: ethAmountWallet });
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

    ethPoolBalance = await getContractBalance(ethPool.address);
    logger.info(`The ETHPool ETH balance in this moment is ${ethPoolBalance}`);

    const walletStableBalance = await stablecoin.balanceOf(wallet.address);
    const stableAmountTeam = walletStableBalance.div(10);
    logger.info(`supplying with DAI from the main wallet...`);
    tx = await ethPool.supplyWithStable(stableAmountTeam, {
      from: wallet.address,
    });
    await tx.wait();
    logger.info(`supplied with DAI!`);

    const walletExaBalance = await exaToken.balanceOf(wallet.address);
    logger.info(`Withdrawing all from the main wallet...`);
    tx = await ethPool.withdraw(walletExaBalance, { from: wallet.address });
    await tx.wait();
    logger.info(`Successful withdrawal!`);

    ethPoolBalance = await getContractBalance(ethPool.address);
    logger.info(`The ETHPool ETH at the end is ${ethPoolBalance}`);

    logger.info(
      `TX's successfully finished! 
      Here you can see the ETHPool contract tx's: https://etherscan.io/address/${ethPool.address}
      And here you can see the EXA token contract tx's: https://etherscan.io/address/${exaToken.address}`
    );
  } catch (err) {
    logger.error(err);
  }
})();
