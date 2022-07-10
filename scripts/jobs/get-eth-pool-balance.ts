import { BigNumber } from "ethers";
import getContractBalance from "../utils/get-balance";
const logger = require("pino")();

const { ETHPOOL_ADDRESS } = process.env;

(async (): Promise<BigNumber> => {
  const ethPoolBalance = await getContractBalance(`${ETHPOOL_ADDRESS}`);
  logger.info(`The ETHPool contract balance is ${ethPoolBalance}`);
  return ethPoolBalance;
})();
