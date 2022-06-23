//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IEXA} from "./IEXA.sol";

error ETHPool_InsufficientBalance();
error ETHPool_NotLPAmount();

contract ETHPool is ReentrancyGuard {
    IEXA public exaToken;
    address private immutable _team;
    uint256 private _poolBalance;

    constructor(address team, address exaTokenAddr) {
        _team = team;
        exaToken = IEXA(exaTokenAddr);
    }

    function supply() external payable nonReentrant {
        if (address(msg.sender).balance < msg.value) {
            revert ETHPool_InsufficientBalance();
        }

        _poolBalance += msg.value;
        exaToken.mint(msg.sender, msg.value);
    }

    function withdraw(uint256 lpAmount) external payable nonReentrant {
        if (
            exaToken.balanceOf(msg.sender) > 0 ||
            exaToken.balanceOf(msg.sender) < lpAmount
        ) {
            revert ETHPool_NotLPAmount();
        }

        _poolBalance -= msg.value;
        exaToken.burn(msg.sender, msg.value);
    }

    /* view functions */

    function getTeam() external view returns (address) {
        return _team;
    }

    function getAmountDeposited() external view returns (uint256) {
        return _poolBalance;
    }
}
