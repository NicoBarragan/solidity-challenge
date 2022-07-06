//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IEXA} from "./IEXA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "hardhat/console.sol";

error Error_NotLPAmount();
error Error_SenderIsNotTeam();
error Error__AmountIsZero();

contract ETHPool is ReentrancyGuard {
    IEXA public exaToken;
    address private _team;

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

    modifier onlyTeam() {
        if (msg.sender != _team) {
            revert Error_SenderIsNotTeam();
        }
        _;
    }

    function supply() external payable nonReentrant {
        exaToken.mint(msg.sender, msg.value);
    }

    function supplyWithDAI() external payable nonReentrant {
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
            revert Error_NotLPAmount();
        }

        uint256 ethPerUnit = exaToken.getEthPerUnit();
        console.log("ethPerUnit", ethPerUnit);
        uint256 ethAmount = lpAmount / ethPerUnit;
        console.log("ethAmount", ethAmount);

        console.log("poolBalance before", address(this).balance);
        payable(msg.sender).transfer(ethAmount);

        exaToken.burn(msg.sender, lpAmount, ethAmount);
    }

    // method for the team to send ETH to the pool, and the pool to update ETH balance in EXA token
    receive() external payable onlyTeam nonReentrant {
        exaToken.addEthBalance(msg.value);
    }

    // function for updating the _team if is necessary
    function updateTeam(address newTeam) external onlyTeam {
        _team = newTeam;
    }

    /* view functions */

    function getTeam() external view returns (address) {
        return _team;
    }
}
