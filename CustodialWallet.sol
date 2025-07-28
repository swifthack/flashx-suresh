
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CustodialWallet {
    address public stablecoin;
    address public vasp;
    address public owner;

    mapping(address => bool) public authorizedProcessors;

    event Deposit(address indexed from, uint256 amount);
    event WithdrawalRequested(address indexed requester, uint256 amount);
    event WithdrawalApproved(address indexed approver, uint256 amount);
    event WithdrawalExecuted(address indexed to, uint256 amount);
    event ProcessorAuthorizationUpdated(address indexed processor, bool status);

    modifier onlyVASP() {
        require(msg.sender == vasp, "Only VASP allowed");
        _;
    }

    constructor(address _stablecoin, address _vasp, address _owner) {
        stablecoin = _stablecoin;
        vasp = _vasp;
        owner = _owner;
    }

    function setAuthorizedProcessor(address processor, bool status) external onlyVASP {
        authorizedProcessors[processor] = status;
        emit ProcessorAuthorizationUpdated(processor, status);
    }

    function deposit(uint256 amount) external {
        require(IERC20(stablecoin).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit Deposit(msg.sender, amount);
    }

    function requestWithdrawal(uint256 amount) external {
        require(msg.sender == owner, "Only owner can request");
        emit WithdrawalRequested(msg.sender, amount);
    }

    function approveWithdrawal(uint256 amount) external onlyVASP {
        emit WithdrawalApproved(msg.sender, amount);
    }

    function executeWithdrawalTo(address to, uint256 amount) external {
        require(
            msg.sender == vasp || authorizedProcessors[msg.sender],
            "Only VASP or authorized processor can execute"
        );
        require(IERC20(stablecoin).transfer(to, amount), "Transfer failed");
        emit WithdrawalExecuted(to, amount);
    }

    function getBalance() external view returns (uint256) {
        return IERC20(stablecoin).balanceOf(address(this));
    }
}