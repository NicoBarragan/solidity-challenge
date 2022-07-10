import { ethers } from "hardhat";
import { ETHPool } from "../../typechain";
const logger = require("pino")();

const { TEAM_ADDRESS, STABLECOIN_ADDRESS, ETH_STABLE_PRICE_FEED } = process.env;

export default async function deployEthPool(
  exaAddress: string
): Promise<ETHPool | undefined> {
  try {
    logger.info(`Deploying the contract...`);

    const ethPoolFactory = await ethers.getContractFactory("ETHPool");
    const ethPool = await ethPoolFactory.deploy(
      `${TEAM_ADDRESS}`,
      exaAddress,
      `${STABLECOIN_ADDRESS}`,
      `${ETH_STABLE_PRICE_FEED}`
    );

    logger.info(`ETHPool contract deployed to: ${ethPool.address}`);
    return ethPool.deployed();
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
}
