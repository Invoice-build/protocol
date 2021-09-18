// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IInvoiceLogger.sol";

contract InvoiceLogger is IInvoiceLogger, Initializable, OwnableUpgradeable {
  address public override controller;
  mapping (address => bool) public whitelisted;

  function initialize() public initializer {
    __Ownable_init();
  }

  modifier onlyControllerOrOwner () {
    require(controller == msg.sender || owner() == msg.sender, "Must be controller or owner");
    _;
  }

  modifier onlyWhitelisted () {
    require(whitelisted[msg.sender], "Must be whitelisted");
    _;
  }

  function setController(address _controller) external override onlyOwner {
    controller = _controller;
    whitelisted[controller] = true;
  }

  function register(address addr) external override onlyControllerOrOwner {
    whitelisted[addr] = true;
  }

  function deregister(address addr) external override onlyOwner {
    whitelisted[addr] = false;
  }

  function isRegistered(address addr) external override view onlyOwner returns (bool) {
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
  ) external override onlyWhitelisted {
    emit InvoiceCreated(id, invoiceAddress, amount, recipient, dueAt, overdueInterest, metaUrl, creator);
  }

  function logInvoicePayment(
    uint256 id,
    address invoiceAddress,
    uint256 amount,
    address payer
  ) external override onlyWhitelisted {
    emit InvoicePayment(id, invoiceAddress, amount, payer);
  }

  function logInvoiceFinalized(
    uint256 id,
    address invoiceAddress,
    uint256 amount,
    uint256 lateFees
  ) external override onlyWhitelisted {
    emit InvoiceFinalized(id, invoiceAddress, amount, lateFees);
  }

  function logInvoiceWithdrawal(
    uint256 id,
    address invoiceAddress,
    uint256 amount,
    address recipient
  ) external override onlyWhitelisted {
    emit InvoiceWithdrawal(id, invoiceAddress, amount, recipient);
  }

  function logInvoiceOwnershipChanged(uint256 id, address from, address to) external override onlyWhitelisted {
    emit InvoiceOwnershipChanged(id, from, to);
  }

  function logInvoiceRecipientChanged(uint256 id, address from, address to) external override onlyWhitelisted {
    emit InvoiceRecipientChanged(id, from, to);
  }

  function logInvoiceAccepted(uint256 id, address invoiceAddress, address client) external override onlyWhitelisted {
    emit InvoiceAccepted(id, invoiceAddress, client);
  }
}
