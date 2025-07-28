// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title LPToken - ERC20 liquidity token with mint and burn functionality
/// @notice Owner (e.g., CrossChainPaymentProcessor) can mint/burn LP tokens as part of payment settlement.
contract LPToken is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC20(name_, symbol_)
        Ownable(initialOwner) 
    {}

    /// @notice Mint LP tokens (only owner can mint)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn LP tokens (only owner can burn)
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}


