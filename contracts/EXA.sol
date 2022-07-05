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
error Error_InvalidAddress(address invalidAddress);
error Error_SenderIsNotTeam();

contract EXA is IEXA, ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // token variables and constants
    uint256 private _totalEthAmount;
    uint256 private _ethPerUnit;
    string public constant NAME = "Exactly Token";
    string public constant SYMBOL = "EXA";
    uint256 private constant _initialSupply = 1 * 10**18; // SUPPLY EXA = SUPPLY ETH

    // user variables
    uint256 private _exaAmount;

    constructor() ERC20(NAME, SYMBOL) {
        _totalEthAmount = 0;
        _ethPerUnit = 0; // TODO: 1? for avoid an error when updating and dividing
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
            revert Error_InvalidAddress(_to);
        }

        if (_ethPerUnit == 0) {
            _ethPerUnit += (_initialSupply / _ethAmount);
        }

        // need _mint here for updating totalSupply before calculating ethPerUnit
        _exaAmount = _ethAmount * _ethPerUnit;
        _mint(_to, _exaAmount);

        _totalEthAmount += _ethAmount;
        _updateBalance();
    }

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
        _updateBalance();
    }

    function _updateBalance() internal {
        uint256 _totalSupply2 = super.totalSupply();
        console.log("_totalSupply2", _totalSupply2);
        console.log("total eth amount from exa token", _totalEthAmount);
        (, _ethPerUnit) = _totalSupply2.tryDiv(_totalEthAmount);
        console.log("ethPerUnit (0)", _ethPerUnit);
    }

    function getEthPerUnit() external view returns (uint256) {
        console.log("ethPerUnit", _ethPerUnit);
        return _ethPerUnit;
    }
}
