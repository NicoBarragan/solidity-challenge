import { ethers } from "hardhat";
import { EXA } from "../../../typechain";
const logger = require("pino")();

export default async function deployExa(
  ownerAddress: string
): Promise<EXA | undefined> {
  try {
    logger.info(`Deploying the contract...`);
    const exaFactory = await ethers.getContractFactory("EXA");
    const exa = await exaFactory.deploy({ from: ownerAddress });

    logger.info(`EXA contract deployed to: ${exa.address}`);
    return exa.deployed();
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
}
