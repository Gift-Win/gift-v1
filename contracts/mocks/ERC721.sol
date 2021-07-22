// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFT is ERC721 {
  // solhint-disable-next-line func-visibility
  constructor() ERC721("Test NFT", "NFT") {}

  function mint(address _to, uint256 _id) public {
    _mint(_to, _id);
  }
}
