// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IInvoiceLogger {
  function controller() external view returns (address);

  function setController(address _controller) external;

  function register(address addr) external;

  function deregister(address addr) external;

  function isRegistered(address addr) external view returns (bool);

  function logInvoiceCreated(
    uint256 id,
    address invoiceAddress,
    uint256 amount,
    address recipient,
    uint256 dueAt,
    uint256 overdueInterest,
    string memory metaUrl,
    address creator
  ) external;
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

  function logInvoicePayment(uint256 id, address invoiceAddress, uint256 amount, address payer) external;
  event InvoicePayment(
    uint256 indexed id,
    address indexed invoiceAddress,
    uint256         amount,
    address indexed payer
  );

  function logInvoiceFinalized(uint256 id, address invoiceAddress, uint256 amount, uint256 lateFees) external;
  event InvoiceFinalized(
    uint256 indexed id,
    address indexed invoiceAddress,
    uint256         amount,
    uint256         lateFees
  );

  function logInvoiceWithdrawal(uint256 id, address invoiceAddress, uint256 amount, address recipient) external;
  event InvoiceWithdrawal(uint256 indexed id, address indexed invoiceAddress, uint256 amount, address recipient);

  function logInvoiceOwnershipChanged(uint256 id, address from, address to) external;
  event InvoiceOwnershipChanged(uint256 indexed id, address indexed from, address indexed to);

  function logInvoiceRecipientChanged(uint256 id, address from, address to) external;
  event InvoiceRecipientChanged(uint256 indexed id, address indexed from, address indexed to);

  function logInvoiceAccepted(uint256 id, address invoiceAddress, address client) external;
  event InvoiceAccepted(uint256 indexed id, address indexed invoiceAddress, address indexed client);
}
