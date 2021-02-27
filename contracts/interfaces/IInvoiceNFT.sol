// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IInvoiceNFT {
  function setController(address _controller) external;
  function ctrlMint(address owner, string memory metaUrl) external returns (uint256);
}
