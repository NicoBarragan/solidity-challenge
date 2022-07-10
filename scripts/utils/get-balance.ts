import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

export default async function getContractBalance(
  contractAddress: string
): Promise<BigNumber> {
  const balance = await ethers.provider.getBalance(contractAddress);
  return balance;
}
