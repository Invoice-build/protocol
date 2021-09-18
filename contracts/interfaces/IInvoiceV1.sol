// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IInvoiceV1 {
  function version() external view returns (string memory);
  function controller() external view returns (address);
  function tokenId() external view returns (uint256);
  function amount() external view returns (uint256);
  function recipient() external view returns (address payable);
  function acceptedBy() external view returns (address);
  function dueAt() external view returns (uint256);
  function overdueInterest() external view returns (uint256);
  function lateFees() external view returns (uint256);
  function isPaid() external view returns (bool);

  function ctrlTransferOwnership(address to) external;
  function ctrlSetRecipient(address payable _recipient) external;

  function pay() external payable;
  function ctrlPay(address from) external payable;

  function accept() external;
  function ctrlAccept(address account) external;

  function withdraw() external returns (bool);

  function outstanding(uint256 currentTime) external view returns (uint256);

  function isOverdue(uint256 currentTime) external view returns (bool);

  function hoursOverdue(uint256 currentTime) external view returns (uint256);

  function overdueFee(uint256 currentTime) external view returns (uint256);

  function isAccepted() external view returns (bool);
}
