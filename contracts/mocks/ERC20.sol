// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract Token is Context, ERC20 {
  // solhint-disable-next-line func-visibility
  constructor() ERC20("Test Tokens", "TOKEN") {
    _mint(_msgSender(), 1000000 * 10**18);
  }
}
