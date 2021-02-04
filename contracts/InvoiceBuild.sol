// SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/payment/escrow/Escrow.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";

// import "hardhat/console.sol";

contract InvoiceBuild is ERC721, Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    Counters.Counter private _tokenIds;

    event InvoiceCreated(uint256 indexed id, uint256 amount, address indexed owner);
    event InvoicePayment(uint256 id, uint256 amount, address indexed payer);
    event InvoiceWithdrawal(uint256 id, uint256 amount, address indexed recipient);
    event InvoicePaid(uint256 id, uint256 amount, uint256 lateFees, address indexed payer);
    event InvoiceAccepted(uint256 id, address acceptedBy);
    event BaseMintFeeUpdated(uint256 baseMintFee);
    event MintFeeBpUpdated(uint256 mintFeeBp);

    struct Invoice {
      uint256 amount; // The total amount to be paid
      uint256 outstanding; // The outstanding balance to be paid off
      address payable recipient; // Who can withdraw any funds deposited
      address acceptedBy; // The client
      uint256 dueAt;
      uint256 overdueInterest; // e.g. 8.5%, In the UK 'statutory interest' is about 8% + BOE base rate (~0.5%)
      uint256 lateFees; // Finanl balance of late fees paid
      bool isPaid;
      Escrow escrow;
    }

    uint256 internal _baseMintFee = 0.1 ether; // ~ $0.10
    uint256 internal _mintFeeBp = 1; // 0.01%

    mapping (uint256 => Invoice) internal _invoices;
    mapping (uint256 => address) internal _invoiceOwner;
    mapping (address => uint256[]) internal _invoicesForOwner;
    mapping (address => uint256) internal _invoiceCountForOwner;
    mapping (address => uint256) internal _repForClient;

    constructor() public ERC721("Invoice", "INV") {}

    function create(
      uint256 amount,
      address payable recipient,
      uint256 dueAt,
      uint256 overdueInterest,
      string memory metaUrl
    ) external payable returns (uint256) {
        require(amount > 0, "Amount too low");
        require(msg.value >= mintFeeFor(amount), "Fee too low");
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        Escrow escrow = new Escrow();

        _invoices[newItemId] = Invoice({
          amount: amount,
          outstanding: amount,
          recipient: recipient,
          dueAt: dueAt,
          overdueInterest: overdueInterest,
          lateFees: 0,
          isPaid: false,
          acceptedBy: address(0),
          escrow: escrow
        });
        _invoiceOwner[newItemId] = msg.sender;
        _invoicesForOwner[msg.sender].push(newItemId);
        _invoiceCountForOwner[msg.sender] = _invoiceCountForOwner[msg.sender].add(1);

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, metaUrl);

        emit InvoiceCreated(newItemId, amount, msg.sender);
        return newItemId;
    }

    function makePayment(uint256 id) external payable {
      uint256 amount = msg.value;
      uint256 outstanding = invoiceOutstanding(id, block.timestamp);

      require(!isPaid(id), "Invoice already paid off");
      require(amount <= outstanding, "Amount greater than remaining balance");

      if (outstanding.sub(amount) == 0) {
        finalize(id);
      } else {
        _invoices[id].outstanding = _invoices[id].outstanding.sub(amount);
      }

      updateReputation(msg.sender, amount);

      _invoices[id].escrow.deposit{ value: msg.value }(_invoices[id].recipient);

      emit InvoicePayment(id, amount, msg.sender);
      if (outstanding.sub(amount) == 0) {
        emit InvoicePaid(id, amount, _invoices[id].lateFees, msg.sender);
      }
    }

    function finalize(uint256 id) private {
      _invoices[id].outstanding = 0;
      _invoices[id].isPaid = true;
      _invoices[id].lateFees = overdueFee(id, block.timestamp);
    }

    function updateReputation(address account, uint256 paymentAmount) private {
      _repForClient[account] = _repForClient[account].add(paymentAmount.div(100000));
    }

    function accept(uint256 id) external {
      require(_invoices[id].acceptedBy == address(0), "Already accepted");

      _invoices[id].acceptedBy = msg.sender;
      emit InvoiceAccepted(id, msg.sender);
    }

    function withdrawBalance(uint256 id) external {
      uint256 balance = invoiceBalance(id);
      require(balance > 0, "Nothing to withdraw");
      require(msg.sender == _invoiceOwner[id], "Caller is not the owner");

      _invoices[id].escrow.withdraw(_invoices[id].recipient);

      emit InvoiceWithdrawal(id, balance, msg.sender);
    }

    function mintFeeFor(uint256 amount) public view returns (uint256) {
      return _baseMintFee.add(amount.mul(_mintFeeBp).div(10000));
    }

    function invoicesForOwner(address account) public view returns (uint256[] memory) {
      return _invoicesForOwner[account];
    }

    function invoiceBalance(uint256 id) public view returns (uint256) {
      return _invoices[id].escrow.depositsOf(_invoices[id].recipient);
    }

    function invoiceOutstanding(uint256 id, uint256 currentTime) public view returns (uint256) {
      return _invoices[id].outstanding + overdueFee(id, currentTime);
    }

    function isPaid(uint256 id) public view returns (bool) {
      return _invoices[id].isPaid;
    }

    function invoiceAmount(uint256 id) public view returns (uint256) {
      return _invoices[id].amount;
    }

    function dueAt(uint256 id) public view returns (uint256) {
      return _invoices[id].dueAt;
    }

    function overdueInterest(uint256 id) public view returns (uint256) {
      return _invoices[id].overdueInterest;
    }

    function lateFees(uint256 id) public view returns (uint256) {
      return _invoices[id].lateFees;
    }

    function isOverdue(uint256 id, uint256 currentTime) public view returns (bool) {
      if (_invoices[id].dueAt == 0) return false;

      return currentTime > _invoices[id].dueAt;
    }

    // Floored hours overdue
    function hoursOverdue(uint256 id, uint256 currentTime) public view returns (uint256) {
      if (!isOverdue(id, currentTime)) return 0;
      uint256 secs = currentTime.sub(_invoices[id].dueAt);
  
      return secs.div(3600).add(1); // Add 1 hour so late fees applied in first hour after dueAt
    }

    function overdueFee(uint256 id, uint256 currentTime) public view returns (uint256) {
      if (_invoices[id].dueAt == 0) return 0;
      uint256 hoursInYear = 8760e18;
      uint256 amount = _invoices[id].amount;
      uint256 interest = _invoices[id].overdueInterest;
      uint256 feePerHour = (amount.mul(interest)).div(hoursInYear);

      return hoursOverdue(id, currentTime).mul(feePerHour);
    }

    function acceptedBy(uint256 id) public view returns (address) {
      return _invoices[id].acceptedBy;
    }

    function isAccepted(uint256 id) public view returns (bool) {
      return _invoices[id].acceptedBy != address(0);
    }

    function reputationFor(address account) public view returns (uint256) {
      return _repForClient[account];
    }

    // function baseMintFee() public view returns (uint256) {
    //   return _baseMintFee;
    // }

    // function setBaseMintFee(uint256 newBaseFee) external onlyOwner {
    //   _baseMintFee = newBaseFee;
    //   emit BaseMintFeeUpdated(newBaseFee);
    // }

    // function mintFeeBp() public view returns (uint256) {
    //   return _mintFeeBp;
    // }

    // function setMintFeeBp(uint256 newFeeBp) external onlyOwner {
    //   _mintFeeBp = newFeeBp;
    //   emit MintFeeBpUpdated(newFeeBp);
    // }
}
