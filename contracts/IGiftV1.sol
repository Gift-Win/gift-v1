// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title Gift Win's smart artifact v1 interface
 */

interface IGiftV1 {
  //////////
  // storage
  //////////

  enum Kind {
    GAS,
    TOKEN,
    NFT
  }
  enum State {
    UNCLAIMED,
    CLAIMED,
    SPENT
  }

  /////////
  // events
  /////////

  event NewFee(uint256 _fee);
  event NewKeeper(address _santa);
  event GasWithdrawn(address _admin, address _to, uint256 _balance);

  event NewGift(address _creator, uint256 _count);
  event GiftClaimed(address _beneficiary, uint256 _id);
  event GiftCancelled(address _creator, uint256 _id);
  event GiftWithdrawn(address _beneficiary, uint256 _id);

  ////////////////
  // admin actions
  ////////////////

  function pause() external;

  function unpause() external;

  function setFee(uint256 _fee) external;

  function setKeeper(address _santa) external;

  function addAdmin(address _admin) external;

  function removeAdmin(address _admin) external;

  function renounceAdmin() external;

  function withdrawGas(address _to) external;

  ///////////////
  // user actions
  ///////////////

  function createGift(
    Kind _kind,
    address _artifact,
    uint256 _value,
    bytes32 _hash,
    address _beneficiary,
    uint256 _activation,
    uint256 _expiry,
    uint256 _marker,
    bytes calldata _signature
  ) external payable;

  function claimGift(
    uint256 _id,
    string memory _code,
    bytes calldata _signature
  ) external;

  function cancelGift(uint256 _id) external;

  function withdrawGift(uint256 _id) external;

  ///////////////
  // view actions
  ///////////////

  // admin views

  function adminCount() external returns (uint256);

  function isAdmin(address _admin) external returns (bool);

  function getAdmin(uint256 _admin) external returns (address);

  // user's created gifts views

  function userCreatedGiftsCount(address _user) external returns (uint256);

  function isUserCreatedGift(address _user, uint256 _id)
    external
    returns (bool);

  function getUserCreatedGift(address _user, uint256 _id)
    external
    returns (uint256);

  // user's owned gifts views

  function userClaimedGiftsCount(address _user) external returns (uint256);

  function isUserClaimedGift(address _user, uint256 _id)
    external
    returns (bool);

  function getUserClaimedGift(address _user, uint256 _id)
    external
    returns (uint256);

  // gifts meant for user's views

  function userMeantGiftsCount(address _user) external returns (uint256);

  function isUserMeantGift(address _user, uint256 _id) external returns (bool);

  function getUserMeantGift(address _user, uint256 _id)
    external
    returns (uint256);

  // user's spent gifts views

  function userSpentGiftsCount(address _user) external returns (uint256);

  function isUserSpentGift(address _user, uint256 _id) external returns (bool);

  function getUserSpentGift(address _user, uint256 _id)
    external
    returns (uint256);

  /////////////////
  // meta functions
  /////////////////
}
