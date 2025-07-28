
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CustodialWallet.sol";

contract CustodialWalletFactory {
    address public vasp;
    address[] public allWallets;
    mapping(address => address) public ownerToWallet;
    mapping(address => bool) public isWallet;

    event WalletCreated(address indexed wallet, address indexed owner, address stablecoin);

    modifier onlyVASP() {
        require(msg.sender == vasp, "Only VASP allowed");
        _;
    }

    constructor(address _vasp) {
        require(_vasp != address(0), "Invalid VASP");
        vasp = _vasp;
    }

    function createWallet(address stablecoin, address owner) external onlyVASP returns (address) {
        require(owner != address(0), "Invalid owner");
        require(stablecoin != address(0), "Invalid token");
        require(ownerToWallet[owner] == address(0), "Wallet already exists");

        CustodialWallet wallet = new CustodialWallet(stablecoin, vasp, owner);
        address walletAddr = address(wallet);

        allWallets.push(walletAddr);
        ownerToWallet[owner] = walletAddr;
        isWallet[walletAddr] = true;

        emit WalletCreated(walletAddr, owner, stablecoin);
        return walletAddr;
    }

    function getWallets() external view returns (address[] memory) {
        return allWallets;
    }

    function getWalletByOwner(address owner) external view returns (address) {
        return ownerToWallet[owner];
    }

    function isDeployedWallet(address addr) external view returns (bool) {
        return isWallet[addr];
    }
}