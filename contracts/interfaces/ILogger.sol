// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface ILogger {
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

  function logInvoicePayment(uint256 id, address invoiceAddress, uint256 amount, address payer) external;

  function logInvoicePaid(uint256 id, address invoiceAddress, uint256 amount, uint256 lateFees) external;

  function logInvoiceAccepted(uint256 id, address invoiceAddress, address client) external;
}
