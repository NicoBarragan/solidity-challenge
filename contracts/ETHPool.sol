//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IEXA} from "./IEXA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error Error__NotEnoughAmount(uint256 amountRequested, uint256 balance);
error Error__SenderIsNotTeam();
error Error__AmountIsZero();
error Error__DivFailed(uint256 dividend, uint256 divisor);
error Error__InvalidToken();

contract ETHPool is ReentrancyGuard {
    using SafeMath for uint256;

    event Supply(address indexed sender, uint256 amount);
    event Withdraw(address indexed sender, uint256 amount);
    event TeamAddedETH(address indexed team, uint256 amount);

    IEXA private _exaToken;
    address private _team;
    IERC20 public immutable stablecoin;
    AggregatorV3Interface public immutable priceFeedV3Aggregator;

    constructor(
        address team,
        address exaAddress,
        address stablecoinAddress, // TODO: request a list with addresses of tokens
        address ethStablePriceFeed
    ) {
        _team = team;
        _exaToken = IEXA(exaAddress);
        priceFeedV3Aggregator = AggregatorV3Interface(ethStablePriceFeed);
        stablecoin = IERC20(stablecoinAddress);
    }

    modifier checkAmount(uint256 amount) {
        if (amount == 0) {
            revert Error__AmountIsZero();
        }
        _;
    }

    modifier onlyTeam() {
        if (msg.sender != _team) {
            revert Error__SenderIsNotTeam();
        }
        _;
    }

    function supply() external payable nonReentrant {
        _exaToken.mint(msg.sender, msg.value);

        emit Supply(msg.sender, msg.value);
    }

    function supplyWithStable(uint256 stableAmount)
        external
        checkAmount(stableAmount)
        nonReentrant
    {
        if (
            stablecoin.balanceOf(msg.sender) == 0 ||
            stablecoin.balanceOf(msg.sender) < stableAmount
        ) {
            revert Error__NotEnoughAmount(
                stableAmount,
                stablecoin.balanceOf(msg.sender)
            );
        }

        (, int256 ethDaiPrice, , , ) = priceFeedV3Aggregator.latestRoundData();
        (bool success, uint256 ethAmount) = (stableAmount * 10**18).tryDiv(
            uint256(ethDaiPrice) // for keeping with 18 decimals
            // TODO: check why this is the correct way to do it
        );
        if (!success || ethAmount == 0) {
            revert Error__DivFailed(stableAmount, uint256(ethDaiPrice));
        }

        stablecoin.transferFrom(msg.sender, address(this), stableAmount);
        _exaToken.mint(msg.sender, ethAmount);

        emit Supply(msg.sender, ethAmount);
    }

    function withdraw(uint256 lpAmount)
        external
        payable
        checkAmount(lpAmount)
        nonReentrant
    {
        if (
            0 > _exaToken.balanceOf(msg.sender) ||
            lpAmount > _exaToken.balanceOf(msg.sender)
        ) {
            revert Error__NotEnoughAmount(
                lpAmount,
                _exaToken.balanceOf(msg.sender)
            );
        }

        uint256 ethPerUnit = _exaToken.getEthPerUnit();

        (bool success, uint256 ethAmount) = lpAmount.tryDiv(ethPerUnit);
        if (!success || ethAmount == 0) {
            revert Error__DivFailed(lpAmount, ethPerUnit);
        }

        payable(msg.sender).transfer(ethAmount);
        _exaToken.burn(msg.sender, lpAmount, ethAmount);

        emit Withdraw(msg.sender, ethAmount);
    }

    // method for the team to send ETH to the pool, and the pool to update ETH balance in EXA token
    receive() external payable onlyTeam nonReentrant {
        _exaToken.addEthBalance(msg.value);

        emit TeamAddedETH(msg.sender, msg.value);
    }

    // function for updating the _team if is necessary
    function updateTeam(address newTeam) external onlyTeam {
        _team = newTeam;
    }

    /* view functions */

    function getTeam() external view returns (address) {
        return _team;
    }

    function getEthDaiPrice() external view returns (uint256) {
        (, int256 ethDaiPrice, , , ) = priceFeedV3Aggregator.latestRoundData();
        return uint256(ethDaiPrice);
    }

    function getExaToken() external view returns (address) {
        return address(_exaToken);
    }
}
