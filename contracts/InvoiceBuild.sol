// SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract InvoiceBuild is ERC721, ERC721Burnable, Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    Counters.Counter private _tokenIds;

    event InvoiceCreated(uint256 indexed id, uint256 amount, address indexed owner);
    event InvoicePayment(uint256 id, uint256 amount, address indexed payer);

    constructor() public ERC721("Invoice", "INV") {}

    struct Invoice {
      uint256 amount;
      uint256 balance;
    }

    mapping (uint256 => Invoice) internal _invoices;
    mapping (address => uint256[]) internal _invoicesForOwner;
    mapping (address => uint256) internal _invoiceCountForOwner;

    function create(uint256 amount, string memory metaUrl) public returns (uint256) {
        require(amount > 0, "Amount too low");
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();

        _invoices[newItemId] = Invoice({ amount: amount, balance: amount });
        _invoicesForOwner[msg.sender].push(newItemId);
        _invoiceCountForOwner[msg.sender] = _invoiceCountForOwner[msg.sender].add(1);

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, metaUrl);

        emit InvoiceCreated(newItemId, amount, msg.sender);
        return newItemId;
    }

    function payInvoice(uint256 id) external payable {
      require(msg.value <= invoiceBalance(id), "Amount greater than remaining balance");

      _invoices[id].balance = _invoices[id].balance.sub(msg.value);

      emit InvoicePayment(id, msg.value, msg.sender);
    }

    function invoicesForOwner(address account) public view returns (uint256[] memory) {
      return _invoicesForOwner[account];
    }

    function invoiceBalance(uint256 id) public view returns (uint256) {
      return _invoices[id].balance;
    }

    function invoiceAmount(uint256 id) public view returns (uint256) {
      return _invoices[id].amount;
    }
}
