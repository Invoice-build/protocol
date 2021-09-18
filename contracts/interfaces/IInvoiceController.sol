// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IInvoiceController {
  function invoices(uint256 id) external view returns (address payable);
  function feesPaidWithIBT(uint256 id) external view returns (bool);

  function create(
    uint256 amount,
    address payable recipient,
    uint256 dueAt,
    uint256 overdueInterest,
    string memory metaUrl
  ) external payable returns (uint256, address);

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

  function pay(uint256 id) external payable;

  function accept(uint256 id) external;

  function changeOwnership(address from, address payable to, uint256 tokenId) external;

  function feeFor(uint256 amount) external view returns (uint256);
}
