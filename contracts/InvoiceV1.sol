// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "./interfaces/IInvoiceV1.sol";
import "./interfaces/IInvoiceLogger.sol";

contract InvoiceV1 is IInvoiceV1, Ownable {
  using SafeMath for uint256;

  string public override version = "1";

  IInvoiceLogger internal logger;

  address public override         controller;
  uint256 public override         tokenId; // ERC721 Token id
  uint256 public override         amount; // The total amount to be paid
  uint256 internal                _outstanding; // The outstanding balance to be paid off (not incl. fees)
  address payable public override recipient; // Who can withdraw any funds deposited
  address public override         acceptedBy; // The client
  uint256 public override         dueAt;
  uint256 public override         overdueInterest; // e.g. 8.5%
  uint256 public override         lateFees; // Final balance of late fees paid
  bool    public override         isPaid;

  constructor(
    uint256 _tokenId,
    uint256 _amount,
    address payable _recipient,
    uint256 _dueAt,
    uint256 _overdueInterest,
    address _controller,
    address _logger
  ) {
    require(_amount > 0, "Amount too low");

    (tokenId, amount, recipient, dueAt, overdueInterest, controller) = (
      _tokenId, _amount, _recipient, _dueAt, _overdueInterest, _controller
    );

    _outstanding = _amount;
    lateFees = 0;
    isPaid = false;
    acceptedBy = address(0);
    logger = IInvoiceLogger(_logger);
  }

  modifier onlyRecipient () {
    require(msg.sender == recipient, "Must be recipient");
    _;
  }

  modifier onlyController () {
    require(msg.sender == controller, "Must be controller");
    _;
  }

  function ctrlTransferOwnership(address to) external override onlyController {
    address from = owner();
    transferOwnership(to);
    logger.logInvoiceOwnershipChanged(tokenId, from, to);
  }

  function ctrlSetRecipient(address payable _recipient) external override onlyController {
    address from = recipient;
    recipient = _recipient;
    logger.logInvoiceRecipientChanged(tokenId, from, recipient);
  }

  function pay() external override payable {
    handlePayment(msg.sender, msg.value);
  }

  function ctrlPay(address from) external override payable onlyController {
    handlePayment(from, msg.value);
  }

  receive() external payable {
    handlePayment(msg.sender, msg.value);
  }

  function accept() external override {
    handleAcceptance(msg.sender);
  }

  function ctrlAccept(address account) external override onlyController {
    handleAcceptance(account);
  }

  function withdraw() external override onlyRecipient returns (bool) {
    uint256 balance = address(this).balance;
    msg.sender.transfer(balance);
    logger.logInvoiceWithdrawal(tokenId, address(this), balance, msg.sender);
    return true;
  }

  function handlePayment(address from, uint256 _amount) private {
    uint256 _currentOutstanding = outstanding(block.timestamp);

    require(!isPaid, "Already paid off");
    require(_amount <= _currentOutstanding, "Amount greater than outstanding");

    if (_currentOutstanding.sub(_amount) == 0) {
      finalize();
    } else {
      _outstanding = _outstanding.sub(_amount);
    }
    logger.logInvoicePayment(tokenId, address(this), _amount, from);
  }

  function handleAcceptance(address account) private {
    require(acceptedBy == address(0), "Already accepted");

    acceptedBy = account;
    logger.logInvoiceAccepted(tokenId, address(this), account);
  }

  function finalize() private {
    _outstanding = 0;
    isPaid = true;
    lateFees = overdueFee(block.timestamp);
    logger.logInvoiceFinalized(tokenId, address(this), amount, lateFees);
  }

  function outstanding(uint256 currentTime) public override view returns (uint256) {
    return _outstanding + overdueFee(currentTime);
  }

  function isOverdue(uint256 currentTime) public override view returns (bool) {
    if (dueAt == 0) return false;

    return currentTime > dueAt;
  }

  // Floored hours overdue
  function hoursOverdue(uint256 currentTime) public override view returns (uint256) {
    if (!isOverdue(currentTime)) return 0;
    uint256 secs = currentTime.sub(dueAt);

    return secs.div(3600).add(1); // Add 1 hour so late fees applied in first hour after dueAt
  }

  function overdueFee(uint256 currentTime) public override view returns (uint256) {
    if (dueAt == 0) return 0;
    uint256 hoursInYear = 8760e18;
    uint256 interest = overdueInterest;
    uint256 feePerHour = (amount.mul(interest)).div(hoursInYear);

    return hoursOverdue(currentTime).mul(feePerHour);
  }

  function isAccepted() public override view returns (bool) {
    return acceptedBy != address(0);
  }
}
