# Smart Contract Challenge

## Solution

I came up with the solution with ``ETHPool``: a pool contract that inherits from ``ERC20`` standard that calculates balances, and mints and burns lp tokens based on the ETH amount received. Also it calculates balance when the team sends ETH to the pool (only the team can).

You can find an exported function for getting the contract balance in ``get-balance.ts``, and you can run the script ``get-eth-pool-balance`` for getting the ETH balance of the pool from the console.

It has a script for making multiple interactions with the contract in ``index.ts``

The contract is successfully tested with 35 unit tests, and an integration test.

Bonus: I added a function for being able to supply to the contract with an stablecoin, calculating ETH amount using Chainlink Data Feeds Oracles. In my case I used DAI.

------------------------------------
## Stack

I solved the challenge using Solidity for developing the smart contracts, Hardhat as a framework, and Typescript for developing the scripts and testing (using Waffle too).

-------------------------------------

## How to use

Firstly, you have to setup a ``.env`` file for every network that you are going to use.
For example, ``.env.rinkeby`` and ``.env.ropsten`` would have the same variables, but with different values each. You can find the variables in ``.env.example`` file.

This, in my opinion, is better because you have different ``.env`` files for different networks. So you minimize the risk of revealing a sinlge ``.env`` with all the data (that would be a SPF). Also, it makes easier coding because is not necessary to hardcode the network name in the variables read from the ``.env`` file, since all of this files have the same variables, but with different data.

### Tests

``yarn hardhat test`` for running all the unit tests. The result is the following:

<img width="139" alt="image" src="https://user-images.githubusercontent.com/71539596/178199489-bba3c996-1672-47c7-8941-55c0dcf83078.png">


``yarn hardhat test --network <network-name>`` for running the integration test. The result is the following:

### Scripts

``yarn hardhat run scripts/jobs/get-eth-pool-balance.ts`` for running the script that gets the ``ETHPool`` contract balance.

``yarn hardhat run scripts/utils/verify-eth-pool.ts`` for verifying the ``ETHPool`` contract from the console.

------------------------------------


