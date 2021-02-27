// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IInvoiceController {
  function invoices(uint256 id) external view returns (address);
  function invoicesForOwner(address owner) external view returns (uint256[] memory);
  function invoiceCountForOwner(address owner) external view returns (uint256);
  function invoiceNumberForAccount(address account) external view returns (uint256);
  function feesPaidWithIBT(uint256 id) external view returns (bool);

  function create(
    uint256 amount,
    address payable recipient,
    uint256 dueAt,
    uint256 overdueInterest,
    string memory metaUrl
  ) external payable returns (uint256, address);

  function pay(uint256 id) external payable;

  function accept(uint256 id) external;

  function changeOwnership(address from, address payable to, uint256 tokenId) external;

  function feeFor(uint256 amount) external view returns (uint256);
}
