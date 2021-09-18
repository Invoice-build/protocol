// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./interfaces/IInvoiceController.sol";
import "./interfaces/IInvoiceBuildToken.sol";
import "./interfaces/IInvoiceNFT.sol";
import "./interfaces/IInvoiceLogger.sol";
import "./InvoiceV1.sol";

contract InvoiceController is IInvoiceController, Initializable, OwnableUpgradeable {
  using SafeMathUpgradeable for uint256;

  IInvoiceLogger internal logger;
  IInvoiceBuildToken internal ibToken;
  IInvoiceNFT internal invoiceNFT;

  uint256 public feeBp;

  mapping (uint256 => address payable) public override invoices;
  mapping (uint256 => bool) public override feesPaidWithIBT;

  function initialize(address _logger, address _ibToken, address _invoiceNFT) public initializer {
    __Ownable_init();
    logger = IInvoiceLogger(_logger);
    ibToken = IInvoiceBuildToken(_ibToken);
    invoiceNFT = IInvoiceNFT(_invoiceNFT);
    feeBp = 5; // 0.05%
  }

  modifier onlyInvoiceNFT() {
    require (msg.sender == address(invoiceNFT), "Must be invoiceNFT");
    _;
  }

  function create(
    uint256 amount,
    address payable recipient,
    uint256 dueAt,
    uint256 overdueInterest,
    string memory metaUrl
  ) external override payable returns (uint256, address) {
    require(amount > 0, "Amount to low");

    bool ibtFeePayment = msg.value == 0;
    uint256 fee = feeFor(amount);

    if (ibtFeePayment) {
      ibToken.ctrlTransfer(msg.sender, address(this), fee);
    } else {
      require(msg.value >= fee, "Fee to low");
    }
    
    // Mint INFT (ERC721) token representing invoice ownership
    uint256 tokenId = invoiceNFT.ctrlMint(msg.sender, metaUrl);
    // Deploy invoice logic contract
    InvoiceV1 invoice = new InvoiceV1(
      tokenId,
      amount,
      recipient,
      dueAt,
      overdueInterest,
      address(this),
      address(logger)
    );
    invoice.transferOwnership(msg.sender);
    // Update state
    invoices[tokenId] = address(invoice);
    feesPaidWithIBT[tokenId] = ibtFeePayment;
    // Reward invoice creator with IBT (ERC20) tokens
    if (!ibtFeePayment) ibToken.ctrlMint(msg.sender, fee.div(2));

    logger.register(address(invoice));
    logger.logInvoiceCreated(tokenId, address(invoice), amount, recipient, dueAt, overdueInterest, metaUrl, msg.sender);
    return (tokenId, address(invoice));
  }

  function pay(uint256 id) external override payable {
    require(invoices[id] != address(0), "Doesn't exist");

    InvoiceV1 invoice = InvoiceV1(invoices[id]);
    invoice.ctrlPay{ value: msg.value }(msg.sender);

    uint256 totalPayerReward = feeFor(invoice.amount()).div(4);
    uint256 fractionalPayerReward = totalPayerReward.div(invoice.amount().div(msg.value));
    ibToken.ctrlMint(msg.sender, fractionalPayerReward);

    if (invoice.isPaid()) {
      if (!feesPaidWithIBT[id]) ibToken.ctrlMint(invoice.owner(), feeFor(invoice.amount()).div(4));
    }
  }

  function accept(uint256 id) external override {
    require(invoices[id] != address(0), "Doesn't exist");

    InvoiceV1 invoice = InvoiceV1(invoices[id]);
    invoice.ctrlAccept(msg.sender);
  }

  function changeOwnership(address from, address payable to, uint256 tokenId) external override onlyInvoiceNFT {
    // Change ownership of invoice contract
    InvoiceV1 invoice = InvoiceV1(invoices[tokenId]);
    invoice.ctrlTransferOwnership(to);
    // Set invoice.recipient to 'to' address
    invoice.ctrlSetRecipient(to);
  }

  function feeFor(uint256 amount) public override view returns (uint256) {
    return amount.mul(feeBp).div(10000);
  }

  function setFeeBp(uint256 newFeeBp) public onlyOwner {
    feeBp = newFeeBp;
  }

  function setLogger(address addr) public onlyOwner {
    logger = IInvoiceLogger(addr);
  }

  function loggerAddress() external view returns (address) {
    return address(logger);
  }

  function erc20Address() external view returns (address) {
    return address(ibToken);
  }

  function erc721Address() external view returns (address) {
    return address(invoiceNFT);
  }

  function claimBalance() public onlyOwner {
    uint256 balance = address(this).balance;
    msg.sender.transfer(balance);
  }
}
