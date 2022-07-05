//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IEXA} from "./IEXA.sol";
import "hardhat/console.sol";

error ETHPool_NotLPAmount();
error Error_SenderIsNotTeam();
error Error__AmountIsZero();

contract ETHPool is ReentrancyGuard {
    IEXA public exaToken;
    address private immutable _team;
    uint256 private _poolBalance;

    constructor(address team, address exaTokenAddr) {
        _team = team;
        exaToken = IEXA(exaTokenAddr);
    }

    modifier checkAmount(uint256 amount) {
        if (amount == 0) {
            revert Error__AmountIsZero();
        }
        _;
    }

    function supply() external payable nonReentrant {
        _poolBalance += msg.value;
        exaToken.mint(msg.sender, msg.value);
    }

    function withdraw(uint256 lpAmount)
        external
        payable
        checkAmount(lpAmount)
        nonReentrant
    {
        if (
            0 > exaToken.balanceOf(msg.sender) ||
            lpAmount > exaToken.balanceOf(msg.sender)
        ) {
            revert ETHPool_NotLPAmount();
        }

        uint256 ethPerUnit = exaToken.getEthPerUnit();
        console.log("ethPerUnit", ethPerUnit);
        uint256 ethAmount = lpAmount / ethPerUnit;
        console.log("ethAmount", ethAmount);

        console.log("poolBalance before", _poolBalance);
        _poolBalance -= ethAmount;

        payable(msg.sender).transfer(ethAmount);

        exaToken.burn(msg.sender, lpAmount, ethAmount);
    }

    receive() external payable nonReentrant {
        if (address(msg.sender) != _team) {
            revert Error_SenderIsNotTeam();
        }

        _poolBalance += msg.value;
        exaToken.addEthBalance(msg.value);
    }

    /* view functions */

    function getAmountDeposited() external view returns (uint256) {
        return _poolBalance;
    }

    function getTeam() external view returns (address) {
        return _team;
    }
}
