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

contract ETHPool is ReentrancyGuard {
    using SafeMath for uint256;

    // events to emit
    event Supply(address indexed sender, uint256 amount);
    event Withdraw(address indexed sender, uint256 amount);
    event TeamAddedETH(address indexed team, uint256 amount);

    // variables and constants
    address private _team;
    IERC20 public immutable stablecoin;
    AggregatorV3Interface public immutable priceFeedV3Aggregator;

    uint256 private constant _initialMintSupply = 1 * 10**18;
    uint256 private _totalEthAmount;
    uint256 private _totalShares;
    uint256 private _ethPerUnit;

    struct Shares {
        uint256 shares;
        uint256 ethDeposited;
        uint256 stableDeposited;
    }

    mapping(address => Shares) private _shares;

    constructor(
        address team,
        address stablecoinAddress,
        address ethStablePriceFeed
    ) {
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
        _totalEthAmount += msg.value;
        _shares[msg.sender].ethDeposited += msg.value;

        _updateShares(msg.sender, msg.value);
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
        );
        if (!success || ethAmount == 0) {
            revert Error__DivFailed(stableAmount, uint256(ethDaiPrice));
        }

        _shares[msg.sender].stableDeposited += stableAmount;
        _updateShares(msg.sender, ethAmount);

        stablecoin.transferFrom(msg.sender, address(this), stableAmount);
        emit Supply(msg.sender, ethAmount);
    }

    // method for withdraw ETH from the pool and burn EXA tokens from the sender
    function withdraw(uint256 sharesAmm)
        external
        payable
        checkAmount(sharesAmm)
        nonReentrant
    {
        if (
            0 > _shares[msg.sender].ethDeposited ||
            _shares[msg.sender].ethDeposited < sharesAmm
        ) {
            revert Error__NotEnoughAmount(
                sharesAmm,
                _shares[msg.sender].ethDeposited
            );
        }

        uint256 ethPerUnit = getEthPerUnit();

        (bool success, uint256 ethAmount) = sharesAmm.tryDiv(ethPerUnit);
        if (!success || ethAmount == 0) {
            revert Error__DivFailed(sharesAmm, ethPerUnit);
        }

        _shares[msg.sender].ethDeposited -= sharesAmm;
        payable(msg.sender).transfer(ethAmount);

        emit Withdraw(msg.sender, ethAmount);
    }

    // function withdrawStable(uint256 sharesAmm)
    //     external
    //     payable
    //     checkAmount(sharesAmm)
    //     nonReentrant
    // {
    //     if (
    //         0 > _shares[msg.sender].shares ||
    //         _shares[msg.sender].shares < sharesAmm
    //     ) {
    //         revert Error__NotEnoughAmount(
    //             sharesAmm,
    //             _shares[msg.sender].stableDeposited
    //         );
    //     }

    //     // uint256 stablePerUnit = getStablePerEth();

    //     (bool success, uint256 stableAmount) = sharesAmm.tryDiv(stablePerUnit);
    //     if (!success || stableAmount == 0) {
    //         revert Error__DivFailed(sharesAmm, stablePerUnit);
    //     }

    //     _shares[msg.sender].stableDeposited -= sharesAmm;
    //     payable(msg.sender).transfer(stableAmount);

    //     emit Withdraw(msg.sender, stableAmount);
    // }

    // method for the team to send ETH to the pool, and the pool to update ETH balance in EXA token
    receive() external payable onlyTeam nonReentrant {
        _totalEthAmount += msg.value;
        _updateEthPerUnit();

        emit TeamAddedETH(msg.sender, msg.value);
    }

    // method for update ethPerUnit
    function _updateShares(address sender, uint256 ethAmount) internal {}

    function _updateEthPerUnit() internal {
        // this is for avoid a division error
        if (_totalEthAmount == 0 && _totalEthAmount == 0) {
            _ethPerUnit = 0;
            return;
        }

        bool success;
        (success, _ethPerUnit) = _totalEthAmount.tryDiv(_totalEthAmount);
        if (!success) {
            revert Error__DivFailed(_totalEthAmount, _totalEthAmount);
        }
    }

    /* View functions */

    function getEthPerUnit() public view returns (uint256) {
        return _ethPerUnit;
    }

    function getTotalEthAmount() external view returns (uint256) {
        return _totalEthAmount;
    }

    function getInitialMintSupply() external pure returns (uint256) {
        return _initialMintSupply;
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
}
