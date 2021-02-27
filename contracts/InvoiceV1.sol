// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

contract InvoiceV1 is Ownable {
  using SafeMath for uint256;

  string public version = "1";

  address public controller;
  uint256 public tokenId; // ERC721 Token id
  uint256 public number; // The owner's invoice number reference / index
  uint256 public amount; // The total amount to be paid
  uint256 internal _outstanding; // The outstanding balance to be paid off (not incl. fees)
  address payable public recipient; // Who can withdraw any funds deposited
  address public acceptedBy; // The client
  uint256 public dueAt;
  uint256 public overdueInterest; // e.g. 8.5%
  uint256 public lateFees; // Final balance of late fees paid
  bool public isPaid;

  constructor(
    uint256 _tokenId,
    uint256 _number,
    uint256 _amount,
    address payable _recipient,
    uint256 _dueAt,
    uint256 _overdueInterest,
    address _controller
  ) {
    require(_amount > 0, "Amount too low");

    (tokenId, number, amount, recipient, dueAt, overdueInterest, controller) = (
      _tokenId, _number, _amount, _recipient, _dueAt, _overdueInterest, _controller
    );

    _outstanding = _amount;
    lateFees = 0;
    isPaid = false;
    acceptedBy = address(0);
  }

  event Payment(address from, uint256 amount);
  event Finalized();
  event Accepted(address by);
  event OwnershipChanged(address to);

  modifier onlyRecipientOrOwner () {
    require(msg.sender == recipient || msg.sender == owner());
    _;
  }

  modifier onlyController () {
    require(msg.sender == controller);
    _;
  }

  function ctrlTransferOwnership(address to) external onlyController {
    transferOwnership(to);
    emit OwnershipChanged(to);
  }

  function ctrlSetRecipient(address payable _recipient) external onlyController {
    recipient = _recipient;
  }

  function ctrlSetNumber(uint256 _number) external onlyController {
    number = _number;
  }

  function pay() external payable {
    handlePayment(msg.sender, msg.value);
  }

  function ctrlPay(address from) external payable onlyController {
    handlePayment(from, msg.value);
  }

  receive() external payable {
    handlePayment(msg.sender, msg.value);
  }

  function accept() external {
    handleAcceptance(msg.sender);
  }

  function ctrlAccept(address account) external onlyController {
    handleAcceptance(account);
  }

  function withdraw() external onlyRecipientOrOwner returns (bool) {
    uint256 balance = address(this).balance;
    msg.sender.transfer(balance);
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
    emit Payment(from, msg.value);
  }

  function handleAcceptance(address account) private {
    require(acceptedBy == address(0), "Already accepted");

    acceptedBy = account;
    emit Accepted(account);
  }

  function finalize() private {
    _outstanding = 0;
    isPaid = true;
    lateFees = overdueFee(block.timestamp);
    emit Finalized();
  }

  function outstanding(uint256 currentTime) public view returns (uint256) {
    return _outstanding + overdueFee(currentTime);
  }

  function isOverdue(uint256 currentTime) public view returns (bool) {
    if (dueAt == 0) return false;

    return currentTime > dueAt;
  }

  // Floored hours overdue
  function hoursOverdue(uint256 currentTime) public view returns (uint256) {
    if (!isOverdue(currentTime)) return 0;
    uint256 secs = currentTime.sub(dueAt);

    return secs.div(3600).add(1); // Add 1 hour so late fees applied in first hour after dueAt
  }

  function overdueFee(uint256 currentTime) public view returns (uint256) {
    if (dueAt == 0) return 0;
    uint256 hoursInYear = 8760e18;
    uint256 interest = overdueInterest;
    uint256 feePerHour = (amount.mul(interest)).div(hoursInYear);

    return hoursOverdue(currentTime).mul(feePerHour);
  }

  function isAccepted() public view returns (bool) {
    return acceptedBy != address(0);
  }
}
