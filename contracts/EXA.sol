// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IEXA} from "./IEXA.sol";
import "hardhat/console.sol";

// errors
error Error__AmountIsZero();
error Error__AddressZero();
error Error__DivFailed(uint256 dividend, uint256 divisor);

contract EXA is IEXA, ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // token variables and constants
    string public constant NAME = "Exactly Token";
    string public constant SYMBOL = "EXA";

    uint256 private constant _initialMintSupply = 1 * 10**18; // SUPPLY EXA = SUPPLY ETH
    uint256 private _totalEthAmount;
    uint256 private _ethPerUnit;

    // user variables
    uint256 private _exaAmount;

    constructor() ERC20(NAME, SYMBOL) {
        _totalEthAmount = 0;
        _ethPerUnit = 0;
    }

    modifier checkAmount(uint256 amount) {
        if (amount == 0) {
            revert Error__AmountIsZero();
        }
        _;
    }

    function mint(address _to, uint256 _ethAmount)
        external
        checkAmount(_ethAmount)
        nonReentrant
    {
        if (_to == address(0)) {
            revert Error__AddressZero();
        }

        _totalEthAmount += _ethAmount;

        if (_ethPerUnit == 0) {
            _ethPerUnit = (_initialMintSupply / _totalEthAmount);
        }

        _exaAmount = _ethAmount * _ethPerUnit;
        _mint(_to, _exaAmount);

        _updateBalance();
    }

    // is already asserted that user has enough EXA to burn in ETHPool
    function burn(
        address _from,
        uint256 exaAmount,
        uint256 _ethAmount // is calculated on ETHPool so is cheaper insert it as parameter and not calculate again
    ) external checkAmount(_ethAmount) {
        (, _totalEthAmount) = _totalEthAmount.trySub(_ethAmount);
        _burn(_from, exaAmount);
        _updateBalance();
    }

    function addEthBalance(uint256 _ethAmount)
        external
        onlyOwner
        checkAmount(_ethAmount)
    {
        _totalEthAmount += _ethAmount;

        if (_ethPerUnit == 0) {
            console.log("here");
            _ethPerUnit += (_initialMintSupply / _totalEthAmount);
            return;
        }

        _updateBalance();
    }

    function _updateBalance() internal {
        uint256 _totalSupply = super.totalSupply();
        console.log("_totalSupply", _totalSupply);
        console.log("total eth amount from exa token", _totalEthAmount);

        if (_totalSupply == 0 && _totalEthAmount == 0) {
            _ethPerUnit = 0;
            return;
        }

        // divResult if avoid shadowing _totalEthAmount
        (bool success, uint256 divResult) = _totalSupply.tryDiv(
            _totalEthAmount
        );
        if (!success) {
            revert Error__DivFailed(_totalSupply, _totalEthAmount);
        }
        _ethPerUnit = divResult;
        console.log("ethPerUnit (0)", _ethPerUnit);
    }

    function getEthPerUnit() external view returns (uint256) {
        console.log("ethPerUnit", _ethPerUnit);
        return _ethPerUnit;
    }

    function getTotalEthAmount() external view returns (uint256) {
        return _totalEthAmount;
    }

    function getInitialMintSupply() external pure returns (uint256) {
        return _initialMintSupply;
    }
}
