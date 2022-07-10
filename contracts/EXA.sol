// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IEXA} from "./IEXA.sol";

// errors
error Error__AmountIsZero();
error Error__AddressZero();
error Error__DivFailed(uint256 dividend, uint256 divisor);
error Error__NotEnoughAmount(
    uint256 amountRequested,
    uint256 senderBalance,
    uint256 totalSupply
);

contract EXA is IEXA, ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // token variables and constants
    string public constant NAME = "Exactly Token";
    string public constant SYMBOL = "EXA";

    uint256 private constant _initialMintSupply = 1 * 10**18;
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

    // method for mint EXA tokens and execute update ethPerUnit and totalEthAmount
    function mint(address _to, uint256 _ethAmount)
        external
        checkAmount(_ethAmount)
        nonReentrant
    {
        if (_to == address(0)) {
            revert Error__AddressZero();
        }

        _totalEthAmount += _ethAmount;

        /* This is for avoid a division error when mint() is the
         * first interaction with the contract and _ethPerUnit is equal zero */
        if (_ethPerUnit == 0) {
            _ethPerUnit = (_initialMintSupply / _totalEthAmount);
        }

        _exaAmount = _ethAmount * _ethPerUnit;
        _mint(_to, _exaAmount);

        _updateBalance();
    }

    // method for burn EXA tokens and update ethPerUnit and totalEthAmount
    function burn(
        address _from,
        uint256 exaAmount,
        uint256 _ethAmount // is calculated on ETHPool so is cheaper insert it as parameter and not calculate again
    ) external checkAmount(_ethAmount) {
        if (_from == address(0)) {
            revert Error__AddressZero();
        }

        if (
            super.totalSupply() < exaAmount ||
            super.balanceOf(_from) < exaAmount
        ) {
            revert Error__NotEnoughAmount(
                exaAmount,
                super.balanceOf(_from),
                super.totalSupply()
            );
        }
        (, _totalEthAmount) = _totalEthAmount.trySub(_ethAmount);
        _burn(_from, exaAmount);

        _updateBalance();
    }

    // method for the team to add ETH and update ethPerUnit and totalEthAmount
    function addEthBalance(uint256 _ethAmount)
        external
        onlyOwner
        checkAmount(_ethAmount)
    {
        _totalEthAmount += _ethAmount;

        /* This is for avoid a division error when addEthBalance() is the
         * first interaction with the contract and _ethPerUnit is equal zero */
        if (_ethPerUnit == 0) {
            _ethPerUnit += (_initialMintSupply / _totalEthAmount);
            return;
        }

        _updateBalance();
    }

    // method for update ethPerUnit
    function _updateBalance() internal {
        uint256 _totalSupply = super.totalSupply();

        // this is for avoid a division error
        if (_totalSupply == 0 && _totalEthAmount == 0) {
            _ethPerUnit = 0;
            return;
        }

        bool success;
        (success, _ethPerUnit) = _totalSupply.tryDiv(_totalEthAmount);
        if (!success) {
            revert Error__DivFailed(_totalSupply, _totalEthAmount);
        }
    }

    /* View functions */

    function getEthPerUnit() external view returns (uint256) {
        return _ethPerUnit;
    }

    function getTotalEthAmount() external view returns (uint256) {
        return _totalEthAmount;
    }

    function getInitialMintSupply() external pure returns (uint256) {
        return _initialMintSupply;
    }
}
