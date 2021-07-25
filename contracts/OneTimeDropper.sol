// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Gift Win's one-time airdropper smart contract
 */

contract OneTimeDropper {
  ////////////
  // libraries
  ////////////

  //////////
  // storage
  //////////

  mapping(address => bool) public participant;

  IERC20 private token;

  address public admin;

  uint256 public total;
  uint256 public balance;

  //////////////
  // constructor
  //////////////

  // solhint-disable-next-line func-visibility
  constructor() {
    admin = msg.sender;
  }

  /////////
  // events
  /////////

  event NewAdmin(address _admin);
  event Started(address _token, uint256 _total);
  event Airdropped(address _participant, uint256 _amount, uint256 _timestamp);

  ////////////
  // modifiers
  ////////////

  modifier onlyAdmin() {
    require(msg.sender == admin, "Not authorized");
    _;
  }

  ////////////////
  // admin actions
  ////////////////

  function setAdmin(address _admin) public onlyAdmin {
    admin = _admin;
    emit NewAdmin(_admin);
  }

  function start(address _token) public onlyAdmin {
    token = IERC20(_token);
    total = token.balanceOf(address(this));
    balance = total;

    emit Started(_token, total);
  }

  ///////////////
  // user actions
  ///////////////

  function claimDrop(uint256 _amount, bytes calldata _signature) public {
    require(participant[msg.sender] == false, "Already claimed");
    require(balance >= _amount, "Airdrop consumed");

    bytes32 hash = keccak256(abi.encodePacked(msg.sender, _amount));
    bytes32 prefixedHash = ECDSA.toEthSignedMessageHash(hash);

    require(
      ECDSA.recover(prefixedHash, _signature) == admin,
      "Invalid signature"
    );

    participant[msg.sender] = true;
    balance -= _amount;

    token.transfer(msg.sender, _amount);

    emit Airdropped(msg.sender, _amount, block.timestamp);
  }
}
