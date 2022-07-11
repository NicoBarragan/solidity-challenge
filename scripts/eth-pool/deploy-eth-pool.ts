import { ethers } from "hardhat";
import { ETHPool } from "../../typechain";
const logger = require("pino")();

export default async function deployEthPool(): Promise<ETHPool | undefined> {
  try {
    const [_, team] = await ethers.getSigners();
    logger.info(`Deploying the contract...`);

    const ethPoolFactory = await ethers.getContractFactory("ETHPool");
    const ethPool = await ethPoolFactory.deploy(
      team.address,
      "Exactly LP Token",
      "EXA"
    );

    logger.info(`ETHPool contract deployed to: ${ethPool.address}`);
    return ethPool.deployed();
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
}
