//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// errors
error Error__NotEnoughAmount(uint256 amountRequested, uint256 balance);
error Error__SenderIsNotTeam();
error Error__AmountIsZero();
error Error__DivFailed(uint256 dividend, uint256 divisor);

contract ETHPool is ERC20, ReentrancyGuard {
    using SafeMath for uint256;

    // events to emit
    event Supply(address indexed sender, uint256 amount);
    event Withdraw(address indexed sender, uint256 amount);
    event TeamAddedETH(address indexed team, uint256 amount);

    // variables and constants
    address private _team;

    // eToken variables and constants
    uint256 private constant _initialMintSupply = 1 * 10**36; // big enough in order to make divisible
    uint256 private _totalEthAmount; // is necessary because balance doesn't update immediately
    uint256 private _totalExaAmount; // is necessary because balance doesn't update immediately
    uint256 private _ethPerUnit;

    constructor(
        address team,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _team = team;
    }

    // modifier for avoid amount in param to be zero
    modifier checkAmount(uint256 amount) {
        if (amount == 0) {
            revert Error__AmountIsZero();
        }
        _;
    }

    // modifier that asserts that sender is the team address
    modifier onlyTeam() {
        if (msg.sender != _team) {
            revert Error__SenderIsNotTeam();
        }
        _;
    }

    // method for supply ETH to the pool and mint EXA tokens to the sender
    function supply() external payable checkAmount(msg.value) nonReentrant {
        uint256 ethAmount = msg.value;
        _totalEthAmount += ethAmount;

        if (_ethPerUnit == 0) {
            _ethPerUnit = (_initialMintSupply / ethAmount);
        }

        uint256 _exaAmount;
        _exaAmount = ethAmount * _ethPerUnit;
        _totalExaAmount += _exaAmount;
        _mintEToken(msg.sender, _exaAmount);

        emit Supply(msg.sender, ethAmount);
    }

    // method for withdraw ETH from the pool and burn EXA tokens from the sender
    function withdraw(uint256 lpAmount)
        external
        payable
        checkAmount(lpAmount)
        nonReentrant
    {
        if (
            super.balanceOf(msg.sender) == 0 ||
            lpAmount > super.balanceOf(msg.sender)
        ) {
            revert Error__NotEnoughAmount(
                lpAmount,
                super.balanceOf(msg.sender)
            );
        }

        (bool success, uint256 ethAmount) = lpAmount.tryDiv(_ethPerUnit);
        if (!success || ethAmount == 0) {
            revert Error__DivFailed(lpAmount, _ethPerUnit);
        }

        uint256 maxTotalEthAmount = _totalEthAmount;
        (, _totalEthAmount) = _totalEthAmount.trySub(ethAmount);
        (, _totalExaAmount) = _totalExaAmount.trySub(lpAmount);

        if (_totalEthAmount == 0) {
            ethAmount = maxTotalEthAmount;
        }

        payable(msg.sender).transfer(ethAmount);

        _burnEtoken(msg.sender, lpAmount);

        emit Withdraw(msg.sender, ethAmount);
    }

    // method for the team to send ETH to the pool, and the pool to update ETH balance in EXA token
    receive() external payable onlyTeam nonReentrant {
        _totalEthAmount += (msg.value);

        /* This is for avoid a division error when addEthBalance() is the
         * first interaction with the contract and _ethPerUnit is equal zero */
        if (_ethPerUnit == 0) {
            _ethPerUnit += (_initialMintSupply / _totalEthAmount);
            emit TeamAddedETH(msg.sender, msg.value);
            return;
        }
        _updateBalance();

        emit TeamAddedETH(msg.sender, msg.value);
    }

    /* eToken methods */

    // method for mint EXA tokens and execute update ethPerUnit and totalEthAmount
    function _mintEToken(address _to, uint256 _exaAmount) internal {
        _updateBalance();
        _mint(_to, _exaAmount);
    }

    // method for burn EXA tokens and update ethPerUnit and totalEthAmount
    function _burnEtoken(address _from, uint256 exaAmount) internal {
        _updateBalance();
        _burn(_from, exaAmount);
    }

    // method for update ethPerUnit
    function _updateBalance() internal {
        // this is for avoid a division error
        if (_totalExaAmount == 0 && _totalEthAmount == 0) {
            _ethPerUnit = 0;
            return;
        }

        bool success;
        (success, _ethPerUnit) = _totalExaAmount.tryDiv(_totalEthAmount);
        if (!success) {
            revert Error__DivFailed(_totalExaAmount, _totalEthAmount);
        }
    }

    // function for updating the _team if necessary
    function updateTeam(address newTeam) external onlyTeam {
        _team = newTeam;
    }

    /* view functions */

    function getEthPerUnit() external view returns (uint256) {
        return _ethPerUnit;
    }

    function getTotalEthAmount() external view returns (uint256) {
        return _totalEthAmount;
    }

    function getTotalExaAmount() external view returns (uint256) {
        return _totalExaAmount;
    }

    function getTeam() external view returns (address) {
        return _team;
    }

    function getInitialMintSupply() external pure returns (uint256) {
        return _initialMintSupply;
    }
}
