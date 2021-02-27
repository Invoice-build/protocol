// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./interfaces/IInvoiceBuildToken.sol";
import "./interfaces/IInvoiceNFT.sol";
import "./interfaces/ILogger.sol";
import "./InvoiceV1.sol";

contract InvoiceController is Initializable, OwnableUpgradeable {
  using SafeMathUpgradeable for uint256;

  ILogger internal logger;
  IInvoiceBuildToken internal ibToken;
  IInvoiceNFT internal invoiceNFT;

  uint256 public feeBp;

  mapping (uint256 => address payable) public invoices;
  mapping (address => uint256[]) public invoicesForOwner;
  mapping (address => uint256) public invoiceCountForOwner;
  mapping (address => uint256) public invoiceNumberForAccount;
  mapping (uint256 => bool) public feesPaidWithIBT;

  function initialize(address _logger, address _ibToken, address _invoiceNFT) public initializer {
    __Ownable_init();
    logger = ILogger(_logger);
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
  ) external payable returns (uint256, address) {
    require(amount > 0, "Amount to low");

    bool ibtFeePayment = msg.value == 0;
    uint256 fee = feeFor(amount);

    if (ibtFeePayment) {
      ibToken.ctrlTransfer(msg.sender, address(this), fee);
    } else {
      require(msg.value >= fee, "Fee to low");
    }

    uint256 number = invoiceNumberForAccount[msg.sender].add(1);
    
    // Mint INFT (ERC721) token representing invoice ownership
    uint256 tokenId = invoiceNFT.ctrlMint(msg.sender, metaUrl);
    // Deploy invoice logic contract
    InvoiceV1 invoice = new InvoiceV1(tokenId, number, amount, recipient, dueAt, overdueInterest, address(this)); 
    invoice.transferOwnership(msg.sender);
    // Update protocol state
    updateState(tokenId, address(invoice), msg.sender, number, ibtFeePayment);
    // Reward invoice creator with IBT (ERC777) tokens
    if (!ibtFeePayment) ibToken.ctrlMint(msg.sender, fee.div(2));

    logger.logInvoiceCreated(tokenId, address(invoice), amount, recipient, dueAt, overdueInterest, metaUrl, msg.sender);
    return (tokenId, address(invoice));
  }

  function updateState(uint256 id, address payable invoiceAddress, address owner, uint256 number, bool ibtFeePayment) private {
    invoices[id] = invoiceAddress;
    invoicesForOwner[owner].push(id);
    invoiceCountForOwner[owner] = invoiceCountForOwner[owner].add(1);
    invoiceNumberForAccount[owner] = number;
    feesPaidWithIBT[id] = ibtFeePayment;
  }

  function pay(uint256 id) external payable {
    require(invoices[id] != address(0), "Doesn't exist");

    InvoiceV1 invoice = InvoiceV1(invoices[id]);
    invoice.ctrlPay{ value: msg.value }(msg.sender);

    uint256 totalPayerReward = feeFor(invoice.amount()).div(4);
    uint256 fractionalPayerReward = totalPayerReward.div(invoice.amount().div(msg.value));
    ibToken.ctrlMint(msg.sender, fractionalPayerReward);

    logger.logInvoicePayment(id, address(invoice), msg.value, msg.sender);
    if (invoice.isPaid()) {
      if (!feesPaidWithIBT[id]) ibToken.ctrlMint(invoice.owner(), feeFor(invoice.amount()).div(4));
      logger.logInvoicePaid(id, address(invoice), invoice.amount(), invoice.lateFees());
    }
  }

  function accept(uint256 id) external {
    require(invoices[id] != address(0), "Doesn't exist");

    InvoiceV1 invoice = InvoiceV1(invoices[id]);
    invoice.ctrlAccept(msg.sender);

    logger.logInvoiceAccepted(id, address(invoice), msg.sender);
  }

  function changeOwnership(address from, address payable to, uint256 tokenId) external onlyInvoiceNFT {
    // Change ownership of invoice contract
    InvoiceV1 invoice = InvoiceV1(invoices[tokenId]);
    invoice.ctrlTransferOwnership(to);
    // Set invoice.recipient to 'to' address
    invoice.ctrlSetRecipient(to);
    // Update state with new ownership
    uint256 newNumber = invoiceNumberForAccount[to].add(1);
    invoicesForOwner[to].push(tokenId);
    invoiceCountForOwner[to] = invoiceCountForOwner[to].add(1);
    invoiceNumberForAccount[to] = newNumber;
    invoice.ctrlSetNumber(newNumber);
    // Revert state for previous owner
    deleteInvoiceFor(from, tokenId);
    invoiceCountForOwner[from] = invoiceCountForOwner[from].sub(1);
  }

  function deleteInvoiceFor(address account, uint256 id) private {
    uint256[] storage _invoices = invoicesForOwner[account];
    uint256 index = invoiceIndexForOwner(account, id);

    for (uint256 i = index; i < _invoices.length - 1; i++) {
      _invoices[i] = _invoices[i + 1];
    }
    _invoices.pop();
    invoicesForOwner[account] = _invoices;
  }

  function invoiceIndexForOwner(address account, uint256 id) private view returns (uint256) {
    uint256[] storage _invoices = invoicesForOwner[account];

    for (uint256 i = 0; i < _invoices.length - 1; i++) {
      if (_invoices[i] == id) return i;
    }
  }

  function getInvoiceIds(address account) public view returns (uint256[] memory) {
    return invoicesForOwner[account];
  }

  function feeFor(uint256 amount) public view returns (uint256) {
    return amount.mul(feeBp).div(10000);
  }

  function setFeeBp(uint256 newFeeBp) public onlyOwner {
    feeBp = newFeeBp;
  }

  function setLogger(address addr) public onlyOwner {
    logger = ILogger(addr);
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
