// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Logger is Initializable, OwnableUpgradeable {
  address public controller;
  mapping (address => bool) public whitelisted;

  function initialize() public initializer {
    __Ownable_init();
  }

  event InvoiceCreated(
    uint256 indexed id,
    address         invoiceAddress,
    uint256         amount,
    address indexed recipient,
    uint256         dueAt,
    uint256         overdueInterest,
    string          metaUrl,
    address indexed creator
  );
  event InvoicePayment(
    uint256 indexed id,
    address indexed invoiceAddress,
    uint256         amount,
    address indexed payer
  );
  event InvoicePaid(
    uint256 indexed id,
    address indexed invoiceAddress,
    uint256         amount,
    uint256         lateFees
  );
  event InvoiceAccepted(
    uint256 indexed id,
    address indexed invoiceAddress,
    address indexed client
  );

  modifier onlyControllerOrOwner () {
    require(controller == msg.sender || owner() == msg.sender);
    _;
  }

  modifier onlyWhitelisted () {
    require(whitelisted[msg.sender]);
    _;
  }

  function setController(address _controller) external onlyOwner {
    controller = _controller;
    whitelisted[controller] = true;
  }

  function register(address addr) external onlyControllerOrOwner {
    whitelisted[addr] = true;
  }

  function deregister(address addr) external onlyOwner {
    whitelisted[addr] = false;
  }

  function isRegistered(address addr) external view onlyOwner returns (bool) {
    return whitelisted[addr];
  }

  function logInvoiceCreated(
    uint256 id,
    address invoiceAddress,
    uint256 amount,
    address recipient,
    uint256 dueAt,
    uint256 overdueInterest,
    string memory metaUrl,
    address creator
  ) external onlyWhitelisted {
    emit InvoiceCreated(id, invoiceAddress, amount, recipient, dueAt, overdueInterest, metaUrl, creator);
  }

  function logInvoicePayment(uint256 id, address invoiceAddress, uint256 amount, address payer) external onlyWhitelisted {
    emit InvoicePayment(id, invoiceAddress, amount, payer);
  }

  function logInvoicePaid(uint256 id, address invoiceAddress, uint256 amount, uint256 lateFees) external onlyWhitelisted {
    emit InvoicePaid(id, invoiceAddress, amount, lateFees);
  }

  function logInvoiceAccepted(uint256 id, address invoiceAddress, address client) external onlyWhitelisted {
    emit InvoiceAccepted(id, invoiceAddress, client);
  }
}
