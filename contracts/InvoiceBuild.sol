// SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Burnable.sol";
import "@openzeppelin/contracts/payment/escrow/Escrow.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract InvoiceBuild is ERC721, ERC721Burnable, Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    Counters.Counter private _tokenIds;

    event InvoiceCreated(uint256 indexed id, uint256 amount, address indexed owner);
    event InvoicePayment(uint256 id, uint256 amount, address indexed payer);
    event InvoiceWithdrawal(uint256 id, uint256 amount, address indexed recipient);

    constructor() public ERC721("Invoice", "INV") {}

    struct Invoice {
      uint256 amount; // The total amount to be paid
      uint256 outstanding; // The outstanding balance to be paid off
      address payable recipient; // Who can withdraw any funds deposited
      Escrow escrow;
    }

    mapping (uint256 => Invoice) internal _invoices;
    mapping (uint256 => address) internal _invoiceOwner;
    mapping (address => uint256[]) internal _invoicesForOwner;
    mapping (address => uint256) internal _invoiceCountForOwner;

    function create(uint256 amount, address payable recipient, string memory metaUrl) public returns (uint256) {
        require(amount > 0, "Amount too low");
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        Escrow escrow = new Escrow();

        _invoices[newItemId] = Invoice({ amount: amount, outstanding: amount, recipient: recipient, escrow: escrow });
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
      require(amount <= invoiceOutstanding(id), "Amount greater than remaining balance");
      
      _invoices[id].outstanding = _invoices[id].outstanding.sub(amount);
      _invoices[id].escrow.deposit{ value: msg.value }(_invoices[id].recipient);

      emit InvoicePayment(id, amount, msg.sender);
    }

    function withdrawBalance(uint256 id) public {
      uint256 balance = invoiceBalance(id);
      require(balance > 0, "Nothing to withdraw");
      require(msg.sender == _invoiceOwner[id], "Caller is not the owner");

      _invoices[id].escrow.withdraw(_invoices[id].recipient);

      emit InvoiceWithdrawal(id, balance, msg.sender);
    }

    function invoicesForOwner(address account) public view returns (uint256[] memory) {
      return _invoicesForOwner[account];
    }

    function invoiceBalance(uint256 id) public view returns (uint256) {
      return _invoices[id].escrow.depositsOf(_invoices[id].recipient);
    }

    function invoiceOutstanding(uint256 id) public view returns (uint256) {
      return _invoices[id].outstanding;
    }

    function isPaid(uint256 id) public view returns (bool) {
      return invoiceOutstanding(id) == 0;
    }

    function invoiceAmount(uint256 id) public view returns (uint256) {
      return _invoices[id].amount;
    }
}
