// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IInvoiceBuildToken.sol";

contract InvoiceBuildToken is IInvoiceBuildToken, ERC20Upgradeable, OwnableUpgradeable {
  address public override controller;

  function initialize() public initializer {
    __Ownable_init();
    __ERC20_init("Invoice Build Token", "IBT");
  }

  modifier onlyController() {
    require (msg.sender == controller, "Must be controller");
    _;
  }

  function setController(address _controller) external onlyOwner {
    controller = _controller;
  }

  function ctrlMint(address account, uint256 amount) external override onlyController {
    _mint(account, amount);
  }

  function ctrlTransfer(address sender, address recipient, uint256 amount) external override onlyController {
    _transfer(sender, recipient, amount);
  }

  function mint(address account, uint256 amount) external onlyOwner {
    _mint(account, amount);
  }
}
