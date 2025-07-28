// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CustodialWallet.sol";
import "./HTLCVault.sol";
import "./LPToken.sol";

contract CrossChainPaymentProcessor {
    address public payerVASP;
    CustodialWallet public custodialWallet;
    HTLCVault public payerVault;
    IERC20 public stablecoin;

    struct LPTokenInfo {
        address tokenAddress;
        bytes32 tokenType;
        bytes32 provider;
        uint256 conversionRate;
    }

    struct RiskComplChecksOutcomes {
        bytes32[] checkNames;
        bytes32[] outcomes;
        bytes32 metadataHash;
    }

    struct PaymentInstruction {
        address payerVault;
        bytes32 payerSC;
        uint256 paymentAmount;
        address payeeVASP;
        bytes32 payeeChainNetwork;
        address payeeWallet;
        bytes32 payeeSC;
        LPTokenInfo lpInfo;
        RiskComplChecksOutcomes riskMetadata;
    }

    event OutwardPaymentExecuted(
        uint256 indexed paymentId,
        address indexed payerVASP,
        address indexed payeeVASP,
        uint256 paymentAmount,
        address lpToken,
        bytes32 lpType,
        bytes32 lpProvider,
        uint256 lpRate,
        bytes32 riskReportHash
    );

    event LPTokensMinted(address indexed to, uint256 stableAmount, uint256 lpAmount);
    event LPTokensTransferred(address indexed toVault, uint256 amount);

    modifier onlyPayerVASP() {
        require(msg.sender == payerVASP, "Only Payer VASP allowed");
        _;
    }

    uint256 public paymentCounter;
    mapping(uint256 => PaymentInstruction) public payments;

    constructor(
        address _payerVASP,
        address _custodialWallet,
        address _payerVault,
        address _stablecoin
    ) {
        payerVASP = _payerVASP;
        custodialWallet = CustodialWallet(_custodialWallet);
        payerVault = HTLCVault(_payerVault);
        stablecoin = IERC20(_stablecoin);
    }

    /// ✅ Complete Outward Payment Flow
    function executeOutwardPayment(PaymentInstruction calldata pi) external onlyPayerVASP {
        require(pi.paymentAmount > 0, "Invalid amount");
        require(pi.lpInfo.tokenAddress != address(0), "Invalid LP Token");

        uint256 paymentId = ++paymentCounter;
        payments[paymentId] = pi;

        // 1️⃣ Withdraw funds from CustodialWallet to Processor
        custodialWallet.executeWithdrawalTo(address(this), pi.paymentAmount);

        // 2️⃣ Send funds to Payer HTLCVault
        require(stablecoin.transfer(pi.payerVault, pi.paymentAmount), "USDC transfer to Vault failed");
        HTLCVault(pi.payerVault).notifyDeposit(pi.paymentAmount);

        // 3️⃣ Mint LP tokens to Processor, then transfer to Payee HTLCVault
        uint256 lpAmount = (pi.paymentAmount * pi.lpInfo.conversionRate) / 1e18;
        LPToken(pi.lpInfo.tokenAddress).mint(address(this), lpAmount);
        IERC20(pi.lpInfo.tokenAddress).transfer(pi.payeeVASP, lpAmount); // ✅ aligned with tests
        emit LPTokensMinted(payerVASP, pi.paymentAmount, lpAmount);
        emit LPTokensTransferred(pi.payeeVASP, lpAmount);

        // 4️⃣ Emit final metadata event
        emit OutwardPaymentExecuted(
            paymentId,
            payerVASP,
            pi.payeeVASP,
            pi.paymentAmount,
            pi.lpInfo.tokenAddress,
            pi.lpInfo.tokenType,
            pi.lpInfo.provider,
            pi.lpInfo.conversionRate,
            pi.riskMetadata.metadataHash
        );
    }

    /// ✅ Used later by inward settlement
    function burnLPTokens(address lpToken, address from, uint256 amount) external onlyPayerVASP {
        LPToken(lpToken).burn(from, amount);
    }
}

