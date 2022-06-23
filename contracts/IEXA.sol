// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEXA is IERC20 {
    function mint(address _to, uint256 _ethAmount) external;

    function burn(
        address _from,
        uint256 _exaAmount,
        uint256 _ethAmount
    ) external;

    function addEthBalance() external payable;

    function getEthPerUnit() external view returns (uint256);
}
