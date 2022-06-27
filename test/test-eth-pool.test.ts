// eslint-disable-next-line camelcase
import { ETHPool, EXA, IEXA } from "../typechain";
import { assert, expect, use } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { waffleChai } from "@ethereum-waffle/chai";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { BigNumber, Signer } from "ethers";
import { promises } from "dns";
const logger = require("pino")();
use(waffleChai);

describe("ETHPool", () => {
  let owner: Signer;
  let user: Signer;
  let team: Signer;
  let ownerAddress: string;
  let userAddress: string;
  let teamAddress: string;

  let ethPool: ETHPool;
  let exaToken: EXA;

  beforeEach(async () => {
    // prepare (signers) ownerWallet and userWallet
    [owner, user, team] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();
    teamAddress = await team.getAddress();

    // send 1 eth from signer(0) to random ownerWallet and userWallet
    await owner.sendTransaction({
      to: ownerAddress,
      value: ethers.utils.parseEther("1.0"),
    });

    await owner.sendTransaction({
      to: userAddress,
      value: ethers.utils.parseEther("1.0"),
    });

    const exaFactory = await ethers.getContractFactory("EXA__Factory");
    exaToken = (await exaFactory.deploy({ from: ownerAddress })) as EXA;

    const ethPoolFactory = await ethers.getContractFactory("ETHPool__Factory");
    ethPool = (await ethPoolFactory.deploy(teamAddress, exaToken.address, {
      from: ownerAddress,
    })) as ETHPool;
    await ethPool.deployed();

    await exaToken.transferOwnership(ethPool.address, { from: ownerAddress });

    logger.info(`EXA token owner: ${exaToken.owner}`);
  });
});
