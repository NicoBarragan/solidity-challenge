import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

const found = process.argv.indexOf("--network");
const networkName = process.argv[found + 1];
if (!networkName) {
  throw new Error("invalid network name");
}

console.log("network", networkName);
dotenv.config({
  path: `.env.${networkName}`,
});
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const balance = await hre.ethers.provider.getBalance(taskArgs.account);

    console.log(
      `The ETH balance of ${
        taskArgs.account
      } address is: ${hre.ethers.utils.formatEther(balance)}`
    );
  });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
      },
      { version: "0.8.0" },
      {
        version: "0.7.0",
      },
    ],
  },
  networks: {
    rposten: {
      url: process.env.URL || "",
      accounts: [
        process.env.USER_A_PRIVATE_KEY ||
          "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
        process.env.TEAM_PRIVATE_KEY ||
          "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
        process.env.USER_B_PRIVATE_KEY ||
          "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
      ],
    },
    rinkeby: {
      url: process.env.URL || "",
      accounts: [
        process.env.USER_A_PRIVATE_KEY ||
          "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
        process.env.TEAM_PRIVATE_KEY ||
          "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
        process.env.USER_B_PRIVATE_KEY ||
          "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
      ],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
