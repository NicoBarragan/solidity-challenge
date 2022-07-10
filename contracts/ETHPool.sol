//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// errors
error Error__NotEnoughAmount(uint256 amountRequested, uint256 balance);
error Error__SenderIsNotTeam();
error Error__AmountIsZero();
error Error__DivFailed(uint256 dividend, uint256 divisor);

contract ETHPool is ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // events to emit
    event Supply(address indexed sender, uint256 amount);
    event Withdraw(address indexed sender, uint256 amount);
    event TeamAddedETH(address indexed team, uint256 amount);

    // variables and constants
    address private _team;
    IERC20 public immutable stablecoin;
    AggregatorV3Interface public immutable priceFeedV3Aggregator;

    // eToken variables and constants
    uint256 private constant _initialMintSupply = 1 * 10**18;
    uint256 private _totalEthAmount = 0;
    uint256 private _ethPerUnit = 0;

    constructor(
        address team,
        address stablecoinAddress,
        address ethStablePriceFeed,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _team = team;
        priceFeedV3Aggregator = AggregatorV3Interface(ethStablePriceFeed);
        stablecoin = IERC20(stablecoinAddress);
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
    function supply() external payable nonReentrant {
        _mintEToken(msg.sender, msg.value);

        emit Supply(msg.sender, msg.value);
    }

    // method for supply DAI to the pool, convert to ETH amount and mint EXA tokens to the sender
    function supplyWithStable(uint256 stableAmount)
        external
        checkAmount(stableAmount)
        nonReentrant
    {
        if (
            stablecoin.balanceOf(msg.sender) == 0 ||
            stableAmount > stablecoin.balanceOf(msg.sender)
        ) {
            revert Error__NotEnoughAmount(
                stableAmount,
                stablecoin.balanceOf(msg.sender)
            );
        }

        uint256 ethStablePrice = getEthStablePrice();
        (bool success, uint256 ethAmount) = (stableAmount * 10**18).tryDiv(
            uint256(ethStablePrice) // for keeping with 18 decimals
        );
        if (!success || ethAmount == 0) {
            revert Error__DivFailed(stableAmount, uint256(ethStablePrice));
        }

        stablecoin.transferFrom(msg.sender, address(this), stableAmount);
        _mintEToken(msg.sender, ethAmount);

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

        payable(msg.sender).transfer(ethAmount);
        _burnEtoken(msg.sender, lpAmount, ethAmount);

        emit Withdraw(msg.sender, ethAmount);
    }

    // method for the team to send ETH to the pool, and the pool to update ETH balance in EXA token
    receive() external payable onlyTeam nonReentrant {
        _updateBalance();

        emit TeamAddedETH(msg.sender, msg.value);
    }

    /* eToken methods */

    // method for mint EXA tokens and execute update ethPerUnit and totalEthAmount
    function _mintEToken(address _to, uint256 _ethAmount)
        internal
        checkAmount(_ethAmount)
        nonReentrant
    {
        /* This is for avoid a division error when mint() is the
         * first interaction with the contract and _ethPerUnit is equal zero */
        if (_ethPerUnit == 0) {
            uint256 totalEthAmount = address(this).balance;
            _ethPerUnit = (_initialMintSupply / totalEthAmount);
        }

        uint256 _exaAmount;
        _exaAmount = _ethAmount * _ethPerUnit;
        _mint(_to, _exaAmount);

        _updateBalance();
    }

    // method for burn EXA tokens and update ethPerUnit and totalEthAmount
    function _burnEtoken(
        address _from,
        uint256 exaAmount,
        uint256 _ethAmount // is calculated on ETHPool so is cheaper insert it as parameter and not calculate again
    ) internal checkAmount(_ethAmount) {
        if (
            super.totalSupply() < exaAmount ||
            super.balanceOf(_from) < exaAmount
        ) {
            revert Error__NotEnoughAmount(exaAmount, super.balanceOf(_from));
        }
        _burn(_from, exaAmount);

        _updateBalance();
    }

    // method for update ethPerUnit
    function _updateBalance() internal {
        uint256 totalSupply = super.totalSupply();
        uint256 totalEthAmount = address(this).balance;

        // this is for avoid a division error
        if (totalSupply == 0 && totalEthAmount == 0) {
            _ethPerUnit = 0;
            return;
        }

        bool success;
        (success, _ethPerUnit) = totalSupply.tryDiv(totalEthAmount);
        if (!success) {
            revert Error__DivFailed(totalSupply, totalEthAmount);
        }
    }

    // function for updating the _team if is necessary
    function updateTeam(address newTeam) external onlyTeam {
        _team = newTeam;
    }

    /* view functions */

    function getEthPerUnit() external view returns (uint256) {
        return _ethPerUnit;
    }

    function getInitialMintSupply() external pure returns (uint256) {
        return _initialMintSupply;
    }

    function getEthStablePrice() public view returns (uint256) {
        (, int256 ethStablePrice, , , ) = priceFeedV3Aggregator
            .latestRoundData();
        return uint256(ethStablePrice);
    }

    function getTeam() external view returns (address) {
        return _team;
    }
}
