// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title HTLCVault - Holds stablecoins for Payer VASP with processor control and burn capability
contract HTLCVault {
    address public owner;        // VASP controlling this vault
    address public processor;    // Trusted payment processor
    IERC20 public stablecoin;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ProcessorSet(address indexed processor);
    event Burned(uint256 amount);

    modifier onlyOwnerOrProcessor() {
        require(msg.sender == owner || msg.sender == processor, "Not authorized");
        _;
    }

    constructor(address _stablecoin) {
        owner = msg.sender;
        stablecoin = IERC20(_stablecoin);
    }

    /// ✅ Set trusted processor (Bank system contract)
    function setProcessor(address _processor) external {
        require(msg.sender == owner, "Only VASP owner");
        require(_processor != address(0), "Invalid address");
        processor = _processor;
        emit ProcessorSet(_processor);
    }

    /// ✅ Called after stablecoins are transferred to this vault
    function notifyDeposit(uint256 amount) external {
        require(amount > 0, "Zero amount");
        emit Deposited(msg.sender, amount);
    }

    /// ✅ Withdraw to another address (VASP or processor only)
    function withdrawTo(address to, uint256 amount) external onlyOwnerOrProcessor {
        require(stablecoin.transfer(to, amount), "Transfer failed");
        emit Withdrawn(to, amount);
    }

    /// ✅ Burn wrapped stablecoins (Processor will call this when payment is settled)
    function burn(uint256 amount) external onlyOwnerOrProcessor {
        require(stablecoin.balanceOf(address(this)) >= amount, "Insufficient balance to burn");
        // Burn by sending to address(0)
        require(stablecoin.transfer(address(0), amount), "Burn transfer failed");
        emit Burned(amount);
    }

    /// ✅ Returns stablecoin balance
    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}

