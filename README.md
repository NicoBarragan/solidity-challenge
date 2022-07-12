# Smart Contract Challenge

## Solution

I came up with the solution via `ETHPool`: a pool contract that inherits from `ERC20` standard that calculates balances, and mints and burns lp tokens based on the ETH amount received. Also it calculates balance when the team sends ETH to the pool (only the team can).

You can find an exported function for getting the contract balance in `get-balance.ts`, and you can run the script `get-eth-pool-balance` for getting the ETH balance of the pool from the console.

The contract is successfully tested with 35 unit tests, and an integration test.

It is already verified.

You can check all the tx of the contract that I deployed in etherscan with this link: `https://rinkeby.etherscan.io/address/0xFE82183892199845Fe171C23D6904247493A4779`

---

## Stack

I solved the challenge using Solidity for developing the smart contracts, Hardhat as a framework, and Typescript for developing the scripts and testing (using Waffle too).

---

## How to use

### Install dependencies
Firstly, you have to install the packages. I used _yarn_ as package manager, but you could you _npm_ or any other. The command is:

`yarn install`

### Setup .env files

You will need to setup a `.env` file for every network that you are going to use.
For example, `.env.rinkeby` and `.env.ropsten` would have the same variables, but with different values each. You can find the variables in `.env.example` file.

Why?

In my opinion, is better because you have different `.env` files for different networks. So you minimize the risk of revealing a sinlge `.env` with all the data (that would be a SPF). Also, it makes easier coding because is not necessary to hardcode the network name in the variables read from the `.env` file, since all of this files have the same variables, but with different data.

### Tests

`yarn hardhat test --grep "unit-ETHPool"` for running all the unit tests. The result is the following:

<img width="148" alt="image" src="https://user-images.githubusercontent.com/71539596/178418423-52f6ef5e-ecef-415c-9e7d-c8b09a88ab43.png">


`yarn hardhat --network <network-name> test --grep "integration-ETHPool"` for running the integration test. The result is the following:

<img width="494" alt="image" src="https://user-images.githubusercontent.com/71539596/178420325-70deaed6-d4dd-4c77-adf8-8870e02f18e3.png">

### Tasks

`yarn hardhat balance --account <account-address>` for running the task that gets the contract balance. This is an example of result:

<img width="576" alt="image" src="https://user-images.githubusercontent.com/71539596/178421954-f294e241-716a-4396-be13-22d29f3b2dcb.png">


### Verify

You can verify the deployed contract by running the following Hardhat task:

`yarn hardhat verify --network rinkeby <CONTRACT_ADDRESS> "<TEAM_ADDRESS>" "<TOKEN_NAME>" "<TOKEN_SYMBOL>"`

---
