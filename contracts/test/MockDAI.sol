// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/* This is a very basic Mock with the unique purpose of simulating an ERC20 in the unit tests */
contract MockDAI is ERC20 {
    string public constant NAME = "DAI";
    string public constant SYMBOL = "DAI";

    constructor() ERC20(NAME, SYMBOL) {
        _mint(msg.sender, 100000);
    }
}
