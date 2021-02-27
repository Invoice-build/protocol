// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IInvoiceBuildToken {
  function controller() external view returns (address);

  function ctrlMint(address account, uint256 amount) external;

  function ctrlTransfer(address sender, address recipient, uint256 amount) external;
}
