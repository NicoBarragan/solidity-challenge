// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// errors
error Error__AmountIsZero();
error Error_InvalidAddress(address invalidAddress);

contract EXA is ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // token variables and constants
    uint256 private _totalEthAmount;
    uint256 private _ethPerUnit;
    uint256 private _totalSupply;
    string public constant NAME = "Exactly Token";
    string public constant SYMBOL = "EXA";

    // user variables
    uint256 private _exaAmount;

    constructor() ERC20(NAME, SYMBOL) {
        _totalEthAmount = 0;
        _ethPerUnit = 0;
        _totalSupply = 1 * 10**18;
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
            _ethPerUnit += (_totalSupply / _ethAmount);
        }

        _exaAmount = _ethAmount * _ethPerUnit;
        _totalEthAmount += _ethAmount;
        _mint(_to, _exaAmount);
        _updateBalance();
    }

    function burn(address _from, uint256 _ethAmount)
        external
        checkAmount(_ethAmount)
        nonReentrant
    {
        (, _totalEthAmount) = _totalEthAmount.trySub(_ethAmount);
        _updateBalance();
        _burn(_from, _ethAmount);
    }

    function addEthBalance()
        external
        payable
        onlyOwner
        checkAmount(msg.value)
        nonReentrant
    {
        _totalEthAmount += msg.value;
        _updateBalance();
    }

    function _updateBalance() internal {
        _totalSupply = totalSupply();
        (, _ethPerUnit) = _totalSupply.tryDiv(_totalEthAmount);
    }
}
