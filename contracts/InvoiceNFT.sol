// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./interfaces/IInvoiceController.sol";

contract InvoiceNFT is ERC721Upgradeable, OwnableUpgradeable {
  IInvoiceController internal controller;
  using SafeMathUpgradeable for uint256;

  using CountersUpgradeable for CountersUpgradeable.Counter;
  CountersUpgradeable.Counter private _tokenIds;

  function initialize() public initializer {
    __Ownable_init();
    __ERC721_init("InvoiceToken", "INFT");
  }

  modifier onlyController() {
    require (msg.sender == address(controller), "Must be controller");
    _;
  }

  function setController(address _controller) external onlyOwner {
    controller = IInvoiceController(_controller);
  }

  function ctrlMint(address owner, string memory metaUrl) external onlyController returns (uint256) {
    _tokenIds.increment();
    uint256 newTokenId = _tokenIds.current();

    _mint(owner, newTokenId);
    _setTokenURI(newTokenId, metaUrl);

    return newTokenId;
  }

  function _beforeTokenTransfer(address from, address payable to, uint256 tokenId) internal virtual {
    super._beforeTokenTransfer(from, to, tokenId);
    controller.changeOwnership(from, to, tokenId);
  }
}
