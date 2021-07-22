
const { keys } = require('../../accounts.json')
const { expect } = require('chai')
const { provider } = waffle

const privateKeys = {
  admin1: keys[0],
  creator1: keys[1],
  creator2: keys[2],
  user1: keys[3],
  user2: keys[4]
}

const randomNum = (min = 20, max = 50) => Math.floor(Math.random() * (max - min)) + min

const SantaSigner = new ethers.utils.SigningKey(privateKeys.admin1)
const UserSigner = new ethers.utils.SigningKey(privateKeys.user1)

const nullAddress = '0x0000000000000000000000000000000000000000'

// '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
const nullHash = ethers.utils.solidityKeccak256(['string'], [''])

const fastForwardTime = async (days = 1) => {
  await ethers.provider.send('evm_increaseTime', [days * 24 * 60 * 60])
  await ethers.provider.send('evm_mine')
}

const signature = (admin, ...args) => {
  const hash = ethers.utils.solidityKeccak256(
    ['uint256', 'address', 'uint256', 'bytes32', 'address', 'uint256', 'uint256', 'uint256'],
    [...args]
  )

  const prefixedHash = ethers.utils.solidityKeccak256(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', hash]
  )

  const auth = admin ? SantaSigner : UserSigner
  return ethers.utils.joinSignature(auth.signDigest(prefixedHash))
}

const nullGiftCode = ''
const nullGiftSignature = '0x'
const redeemCode = 'FEELING_LUCKY'

describe('Gift contract', function () {
  let gift, token, nft, admin1, creator1, creator2, user1, user2
  let gasGiftId1, gasGiftId2, gasGiftId3, gasGiftId4, gasGiftId5, gasGiftId6, gasGiftId7, tokenGiftId, nftGiftId

  before(async () => {
    [admin1, creator1, creator2, user1, user2] = await ethers.getSigners()

    const Gift = await ethers.getContractFactory('GiftV1')
    gift = await Gift.deploy(admin1.address)

    const Token = await ethers.getContractFactory('Token')
    token = await Token.deploy()

    const NFT = await ethers.getContractFactory('NFT')
    nft = await NFT.deploy()
  })

  describe('CREATE tests', function () {
    /*
    createGift(
      Kind _kind, address _artifact, uint256 _value, bytes32 _hash, address _beneficiary,
      uint256 _activation, uint256 _expiry, uint256 _marker, bytes callData _signature
    )
    */

    it('users cannot create a gift when paused', async function () {
      await expect(gift.connect(admin1).pause()).to.emit(gift, 'Paused')

      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      const sendGasValue = ethers.utils.parseEther(String(randomNum()))
      const params = [0, nullAddress, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Pausable: paused')

      await expect(gift.connect(admin1).unpause()).to.emit(gift, 'Unpaused')
    })

    it('users cannot create a gift with invalid fee', async function () {
      const initialFee = (await gift.fee())
      const newFee = initialFee.add(ethers.utils.parseEther(String(randomNum())))
      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      await expect(gift.connect(admin1).setFee(newFee)).to.be.emit(gift, 'NewFee')

      const sendGasValue = newFee.sub(1)
      const params = [0, nullAddress, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Invalid fee')
    })

    it('users cannot create a gift with invalid expiry', async function () {
      const giftFee = (await gift.fee())
      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      const sendGasValue = giftFee.add(1)
      const params = [0, nullAddress, 0, nullHash, user1.address, 20, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Invalid activation or expiry')
    })

    it('users cannot create a gift with invalid signature', async function () {
      const giftFee = (await gift.fee())
      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      const sendGasValue = giftFee.add(1)
      const params = [0, nullAddress, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(false, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Invalid signature')
    })

    it('users can only create a GAS gift with right params', async function () {
      await expect(await gift.giftGas()).to.equal(0)
      await expect(await gift.count()).to.equal(0)
      await expect(await gift.userCreatedGiftsCount(creator1.address)).to.equal(0)

      const kind = 0
      const initialFee = (await gift.fee())
      const newFee = initialFee.add(ethers.utils.parseEther(String(randomNum())))
      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      await expect(gift.connect(admin1).setFee(newFee)).to.be.emit(gift, 'NewFee')

      const giftGasValue = randomNum()
      const sendGasValue = newFee.add(giftGasValue)

      const params = [kind, nullAddress, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      await expect(await gift.count()).to.equal(1)
      await expect((await gift.gifts(1)).creator).to.equal(creator1.address)

      await expect(await gift.giftGas()).to.equal(giftGasValue)

      await expect(await gift.userCreatedGiftsCount(creator1.address)).to.equal(1)
      await expect(await gift.getUserCreatedGift(creator1.address, 0)).to.equal(1)
      await expect(await gift.isUserCreatedGift(creator1.address, 1)).to.equal(true)

      // data integrity

      gasGiftId1 = await gift.count()
      const giftData = await gift.gifts(gasGiftId1)

      await expect(await gift.userGiftMarker(creator1.address, userGiftCount)).to.equal(gasGiftId1)

      expect(giftData.creator).to.equal(creator1.address)
      expect(giftData.kind).to.equal(kind)
      expect(giftData.artifact).to.equal(nullAddress)
      expect(giftData.value).to.equal(sendGasValue.sub(newFee))
      expect(giftData.hash).to.equal(nullHash)
      expect(giftData.beneficiary).to.equal(user1.address)
      expect(+giftData.expiry).to.be.greaterThan(+giftData.activation)
      expect(giftData.state).to.equal(0)
    })

    it('users cannot re-use their marker to create gift', async function () {
      await expect(await gift.userCreatedGiftsCount(creator2.address)).to.equal(0)

      const giftFee = (await gift.fee())
      const sendGasValue = giftFee.add(randomNum())
      const userGiftCount = (await gift.userCreatedGiftsCount(creator1.address)).sub(1)

      const params = [0, nullAddress, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Used marker')
    })

    it("creating gift for a user increases user's meant gift", async function () {
      const initialUserMeantGiftsCount = await gift.userMeantGiftsCount(user1.address)
      const expectedUserMeantGiftsCount = initialUserMeantGiftsCount.add(1)

      await expect(await gift.userCreatedGiftsCount(creator2.address)).to.equal(0)

      const giftFee = (await gift.fee())
      const sendGasValue = giftFee.add(randomNum())
      const userGiftCount = await gift.userCreatedGiftsCount(creator2.address)

      const params = [0, nullAddress, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      await expect(await gift.count()).to.equal(2)
      await expect((await gift.gifts(2)).creator).to.equal(creator2.address)
      await expect(await gift.userCreatedGiftsCount(creator2.address)).to.equal(1)

      // data integrity
      gasGiftId2 = await gift.count()
      await expect(await gift.userGiftMarker(creator2.address, userGiftCount)).to.equal(gasGiftId2)

      // user meant integrity
      const finalUserMeantGiftsCount = await gift.userMeantGiftsCount(user1.address)
      await expect(finalUserMeantGiftsCount).to.equal(expectedUserMeantGiftsCount)

      const newUserMeantGiftId = await gift.getUserMeantGift(user1.address, finalUserMeantGiftsCount.sub(1))
      await expect(newUserMeantGiftId).to.equal(gasGiftId2)

      await expect(await gift.isUserMeantGift(user1.address, gasGiftId2)).to.equal(true)
    })

    it('users cannot create gift with both beneficiary and redeem code', async function () {
      const giftFee = (await gift.fee())
      const sendGasValue = giftFee.add(randomNum())

      const userGiftCount = await gift.userCreatedGiftsCount(creator2.address)

      const hash = ethers.utils.solidityKeccak256(['string'], [redeemCode])
      const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

      const params = [0, nullAddress, 0, prefixedHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Cannot have both beneficiary and code')
    })

    it('users can create gift redeemable by code', async function () {
      const giftFee = (await gift.fee())
      const sendGasValue = giftFee.add(randomNum())

      const userGiftCount = await gift.userCreatedGiftsCount(creator2.address)

      const hash = ethers.utils.solidityKeccak256(['string'], [redeemCode])
      const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

      const params = [0, nullAddress, 0, prefixedHash, nullAddress, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      // data integrity
      gasGiftId7 = await gift.count()
      await expect(await gift.userGiftMarker(creator2.address, userGiftCount)).to.equal(gasGiftId7)
    })

    it('users cannot create gift redeemable by USED code', async function () {
      const giftFee = (await gift.fee())
      const sendGasValue = giftFee.add(randomNum())

      const userGiftCount = await gift.userCreatedGiftsCount(creator2.address)

      const hash = ethers.utils.solidityKeccak256(['string'], [redeemCode])
      const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

      const params = [0, nullAddress, 0, prefixedHash, nullAddress, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.be.revertedWith('Used secret')
    })

    it('users can create more than one gift', async function () {
      const giftFee = (await gift.fee())
      const sendGasValue = giftFee.add(randomNum())

      // new gift
      let userGiftCount = await gift.userCreatedGiftsCount(creator2.address)
      let params = [0, nullAddress, 0, nullHash, user2.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      await expect(await gift.count()).to.equal(4)
      await expect((await gift.gifts(2)).creator).to.equal(creator2.address)

      gasGiftId3 = await gift.count()
      await expect(await gift.userGiftMarker(creator2.address, userGiftCount)).to.equal(gasGiftId3)

      // new gift
      userGiftCount = await gift.userCreatedGiftsCount(creator2.address)
      params = [0, nullAddress, 0, nullHash, user2.address, 0, 2, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      gasGiftId4 = await gift.count()
      await expect(await gift.userGiftMarker(creator2.address, userGiftCount)).to.equal(gasGiftId4)

      // new gift
      userGiftCount = await gift.userCreatedGiftsCount(creator2.address)
      params = [0, nullAddress, 0, nullHash, user2.address, 5, 10, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      gasGiftId5 = await gift.count()
      await expect(await gift.userGiftMarker(creator2.address, userGiftCount)).to.equal(gasGiftId5)

      // new gift
      userGiftCount = await gift.userCreatedGiftsCount(creator2.address)
      params = [0, nullAddress, 0, nullHash, user2.address, 0, 7, userGiftCount]

      await expect(
        gift
          .connect(creator2)
          .createGift(...params, signature(true, ...params), { value: sendGasValue })
      ).to.emit(gift, 'NewGift')

      gasGiftId6 = await gift.count()
      await expect(await gift.userGiftMarker(creator2.address, userGiftCount)).to.equal(gasGiftId6)
    })

    it('users can only create a TOKEN gift with right params', async function () {
      await expect(await gift.userCreatedGiftsCount(creator1.address)).to.equal(1)

      const kind = 1
      const initialContractTokenBalance = await token.balanceOf(gift.address)

      const tokenAmount = ethers.utils.parseEther(String(randomNum()))
      const creatorTokenBalance = tokenAmount.mul(2)

      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      // invalid fee

      let params = [kind, token.address, tokenAmount, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: 0 })
      ).to.be.revertedWith('Invalid fee')

      // invalid token amount

      params = [kind, token.address, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: 0 })
      ).to.be.revertedWith('Invalid value')

      // invalid token address

      params = [kind, nullAddress, tokenAmount, nullHash, user1.address, 0, 10, userGiftCount]
      const giftFee = (await gift.fee())

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.be.revertedWith('Address: call to non-contract')

      // invalid allowance

      params = [kind, token.address, tokenAmount, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance')

      // invalid balance

      params = [kind, token.address, tokenAmount, nullHash, user1.address, 0, 10, userGiftCount]
      await expect(token.connect(creator1).approve(gift.address, tokenAmount)).to.emit(token, 'Approval')

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance')

      // all good

      params = [kind, token.address, tokenAmount, nullHash, user1.address, 0, 10, userGiftCount]
      await expect(token.connect(admin1).transfer(creator1.address, creatorTokenBalance)).to.emit(token, 'Transfer')

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.emit(gift, 'NewGift')

      await expect(await gift.count()).to.equal(8)

      await expect(await token.balanceOf(gift.address)).to.equal(initialContractTokenBalance.add(tokenAmount))
      await expect(await token.balanceOf(creator1.address)).to.equal(creatorTokenBalance.sub(tokenAmount))

      // data integrity

      tokenGiftId = await gift.count()
      const giftData = await gift.gifts(tokenGiftId)

      await expect(await gift.userGiftMarker(creator1.address, userGiftCount)).to.equal(tokenGiftId)

      expect(giftData.creator).to.equal(creator1.address)
      expect(giftData.kind).to.equal(kind)
      expect(giftData.artifact).to.equal(token.address)
      expect(giftData.value).to.equal(tokenAmount)
      expect(giftData.hash).to.equal(nullHash)
      expect(giftData.beneficiary).to.equal(user1.address)
      expect(+giftData.expiry).to.be.greaterThan(+giftData.activation)
      expect(giftData.state).to.equal(0)
    })

    it('users can only create an NFT gift with right params', async function () {
      await expect(await gift.userCreatedGiftsCount(creator1.address)).to.equal(2)

      const kind = 2
      const nftId = randomNum()

      const userGiftCount = await gift.userCreatedGiftsCount(creator1.address)

      // invalid fee

      let params = [kind, nft.address, nftId, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: 0 })
      ).to.be.revertedWith('Invalid fee')

      // invalid nft id

      params = [kind, nft.address, 0, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: 0 })
      ).to.be.revertedWith('Invalid value')

      // invalid nft address

      const giftFee = (await gift.fee())
      params = [kind, nullAddress, nftId, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.be.revertedWith('function call to a non-contract account')

      // invalid nft

      params = [kind, nft.address, nftId, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.be.revertedWith('ERC721: operator query for nonexistent token')

      // invalid approval

      params = [kind, nft.address, nftId, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(nft.mint(admin1.address, nftId)).to.emit(nft, 'Transfer')

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.be.revertedWith('ERC721: transfer caller is not owner nor approved')

      // all good

      params = [kind, nft.address, nftId, nullHash, user1.address, 0, 10, userGiftCount]

      await expect(nft.connect(admin1).transferFrom(admin1.address, creator1.address, nftId)).to.emit(nft, 'Transfer')
      await expect(nft.connect(creator1).approve(gift.address, nftId)).to.emit(nft, 'Approval')

      await expect(
        gift
          .connect(creator1)
          .createGift(...params, signature(true, ...params), { value: giftFee })
      ).to.emit(gift, 'NewGift')

      await expect(await gift.count()).to.equal(9)

      await expect(await nft.ownerOf(nftId)).to.equal(gift.address)

      // data integrity

      nftGiftId = await gift.count()
      const giftData = await gift.gifts(nftGiftId)

      await expect(await gift.userGiftMarker(creator1.address, userGiftCount)).to.equal(nftGiftId)

      expect(giftData.creator).to.equal(creator1.address)
      expect(giftData.kind).to.equal(kind)
      expect(giftData.artifact).to.equal(nft.address)
      expect(giftData.value).to.equal(nftId)
      expect(giftData.hash).to.equal(nullHash)
      expect(giftData.beneficiary).to.equal(user1.address)
      expect(+giftData.expiry).to.be.greaterThan(+giftData.activation)
      expect(giftData.state).to.equal(0)
    })
  })

  describe('CANCEL tests', function () {
    it('users cannot cancel a gift when paused', async function () {
      await expect(gift.connect(admin1).pause()).to.emit(gift, 'Paused')

      await expect(
        gift.connect(creator2).cancelGift(gasGiftId2)
      ).to.be.revertedWith('Pausable: paused')

      await expect(gift.connect(admin1).unpause()).to.emit(gift, 'Unpaused')
    })

    it('only creators of a gift can cancel it', async function () {
      await expect(await gift.userClaimedGiftsCount(creator2.address)).to.equal(0)

      const initialGiftData = await gift.gifts(gasGiftId2)

      await expect(initialGiftData.state).to.equal(0)
      await expect(initialGiftData.beneficiary).to.equal(user1.address)

      const giftMeantUser = initialGiftData.beneficiary
      await expect(giftMeantUser).to.not.equal(nullAddress)

      const initialBeneficiaryMeantCount = await gift.userMeantGiftsCount(giftMeantUser)
      const expectedBeneficiaryMeantCount = initialBeneficiaryMeantCount.sub(1)

      await expect(await gift.isUserMeantGift(giftMeantUser, gasGiftId2)).to.equal(true)

      await expect(
        gift.connect(creator1).cancelGift(gasGiftId2)
      ).to.be.revertedWith('Not creator')

      await expect(
        gift.connect(creator2).cancelGift(gasGiftId2)
      ).to.emit(gift, 'GiftCancelled')

      await expect(await gift.userClaimedGiftsCount(creator2.address)).to.equal(1)
      await expect((await gift.gifts(gasGiftId2)).state).to.equal(1)
      await expect((await gift.gifts(gasGiftId2)).beneficiary).to.equal(creator2.address)

      await expect(await gift.userMeantGiftsCount(giftMeantUser)).to.equal(expectedBeneficiaryMeantCount)
      await expect(await gift.isUserMeantGift(user1.address, gasGiftId2)).to.equal(false)
    })

    it('only creators of an expired gift can cancel it', async function () {
      await fastForwardTime(3)

      await expect(
        gift.connect(user2).claimGift(gasGiftId4, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Not active or expired')

      await expect(await gift.userClaimedGiftsCount(creator2.address)).to.equal(1)
      await expect((await gift.gifts(gasGiftId4)).state).to.equal(0)
      await expect((await gift.gifts(gasGiftId4)).beneficiary).to.equal(user2.address)

      await expect(
        gift.connect(creator1).cancelGift(gasGiftId4)
      ).to.be.revertedWith('Not creator')

      await expect(
        gift.connect(creator2).cancelGift(gasGiftId4)
      ).to.emit(gift, 'GiftCancelled')

      await expect(await gift.userClaimedGiftsCount(creator2.address)).to.equal(2)
      await expect((await gift.gifts(gasGiftId4)).state).to.equal(1)
      await expect((await gift.gifts(gasGiftId4)).beneficiary).to.equal(creator2.address)
    })

    it('users cannot cancel already cancelled gift', async function () {
      await expect(
        gift.connect(creator2).cancelGift(gasGiftId2)
      ).to.be.revertedWith('Already claimed')
    })

    it('users cannot cancel an already claimed gift', async function () {
      await expect(
        gift.connect(user2).claimGift(gasGiftId3, nullGiftCode, nullGiftSignature)
      ).to.emit(gift, 'GiftClaimed')

      await expect(
        gift.connect(creator2).cancelGift(gasGiftId3)
      ).to.be.revertedWith('Already claimed')
    })

    it('users cannot cancel non-existent gift', async function () {
      await expect(
        gift.connect(creator1).cancelGift(randomNum())
      ).to.be.revertedWith('Gift does not exist')
    })
  })

  describe('CLAIM tests', function () {
    it('users cannot claim cancelled gift', async function () {
      await expect(
        gift.connect(user1).claimGift(gasGiftId2, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Already claimed')
    })

    it('users cannot claim valid gift which is not yet active', async function () {
      await expect(
        gift.connect(user2).claimGift(gasGiftId5, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Not active or expired')
    })

    it('users cannot claim valid gift when paused', async function () {
      await expect(gift.connect(admin1).pause()).to.emit(gift, 'Paused')

      await expect(
        gift.connect(user1).claimGift(gasGiftId1, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Pausable: paused')

      await expect(gift.connect(admin1).unpause()).to.emit(gift, 'Unpaused')
    })

    it('users can only claim valid code-based gift valid code and with valid signature', async function () {
      await expect((await gift.gifts(gasGiftId7)).beneficiary).to.equal(nullAddress)

      await expect(
        gift.connect(user1).claimGift(gasGiftId7, redeemCode, nullGiftSignature)
      ).to.be.revertedWith('ECDSA: invalid signature length')

      const codeHash = ethers.utils.solidityKeccak256(['string'], [redeemCode])
      const hash = ethers.utils.solidityKeccak256(['address', 'bytes32', 'uint256'], [user1.address, codeHash, gasGiftId7])
      const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

      const userSigner = new ethers.utils.SigningKey(privateKeys.user2)
      const invalidSignature = ethers.utils.joinSignature(userSigner.signDigest(prefixedHash))

      await expect(
        gift.connect(user1).claimGift(gasGiftId7, redeemCode, invalidSignature)
      ).to.be.revertedWith('Invalid signature')

      const santaSigner = new ethers.utils.SigningKey(privateKeys.admin1)
      const validSignature = ethers.utils.joinSignature(santaSigner.signDigest(prefixedHash))

      await expect(
        gift.connect(user1).claimGift(gasGiftId7, redeemCode, validSignature)
      ).to.emit(gift, 'GiftClaimed')

      await expect((await gift.gifts(gasGiftId7)).beneficiary).to.equal(user1.address)
    })

    it('users can only claim valid gift they are beneficiary of', async function () {
      await expect(await gift.userClaimedGiftsCount(user1.address)).to.equal(1)
      await expect((await gift.gifts(gasGiftId1)).state).to.equal(0)

      const giftMeantUser = (await gift.gifts(gasGiftId1)).beneficiary
      const initialGiftMeantUserMeantCount = await (gift.userMeantGiftsCount(giftMeantUser))
      const expectedGiftMeantUserCount = initialGiftMeantUserMeantCount.sub(1)

      await expect(await gift.isUserMeantGift(giftMeantUser, gasGiftId1)).to.equal(true)

      await expect(
        gift.connect(user2).claimGift(gasGiftId1, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Not yours')

      await expect(
        gift.connect(user2).claimGift(gasGiftId1.add(randomNum()), nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Gift does not exist')

      await expect(
        gift.connect(user1).claimGift(gasGiftId1, nullGiftCode, nullGiftSignature)
      ).to.emit(gift, 'GiftClaimed')

      await expect(await gift.userClaimedGiftsCount(user1.address)).to.equal(2)
      await expect((await gift.gifts(gasGiftId1)).state).to.equal(1)

      await expect(await gift.userMeantGiftsCount(giftMeantUser)).to.equal(expectedGiftMeantUserCount)
      await expect(await gift.isUserMeantGift(user1.address, gasGiftId1)).to.equal(false)
    })

    it('users can only claim valid TOKEN gift they are beneficiary of', async function () {
      await expect(await gift.userClaimedGiftsCount(user1.address)).to.equal(2)
      await expect((await gift.gifts(tokenGiftId)).state).to.equal(0)

      await expect(
        gift.connect(user2).claimGift(tokenGiftId, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Not yours')

      await expect(
        gift.connect(user2).claimGift(tokenGiftId.add(randomNum()), nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Gift does not exist')

      await expect(
        gift.connect(user1).claimGift(tokenGiftId, nullGiftCode, nullGiftSignature)
      ).to.emit(gift, 'GiftClaimed')

      await expect(await gift.userClaimedGiftsCount(user1.address)).to.equal(3)
      await expect((await gift.gifts(tokenGiftId)).state).to.equal(1)
    })

    it('users can only claim valid NFT gift they are beneficiary of', async function () {
      await expect(await gift.userClaimedGiftsCount(user1.address)).to.equal(3)
      await expect((await gift.gifts(nftGiftId)).state).to.equal(0)

      await expect(
        gift.connect(user2).claimGift(nftGiftId, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Not yours')

      await expect(
        gift.connect(user2).claimGift(nftGiftId.add(randomNum()), nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Gift does not exist')

      await expect(
        gift.connect(user1).claimGift(nftGiftId, nullGiftCode, nullGiftSignature)
      ).to.emit(gift, 'GiftClaimed')

      await expect(await gift.userClaimedGiftsCount(user1.address)).to.equal(4)
      await expect((await gift.gifts(nftGiftId)).state).to.equal(1)
    })

    it('users cannot claim an already claimed gift', async function () {
      await expect(
        gift.connect(user2).claimGift(nftGiftId, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Already claimed')
    })

    it('users cannot claim valid gift which is expired', async function () {
      await fastForwardTime(8)

      await expect(
        gift.connect(user1).claimGift(gasGiftId6, nullGiftCode, nullGiftSignature)
      ).to.be.revertedWith('Not active or expired')
    })
  })

  describe('WITHDRAW tests', function () {
    it('users cannot withdraw gift when paused', async function () {
      await expect(gift.connect(admin1).pause()).to.emit(gift, 'Paused')

      await expect(
        gift.connect(user1).withdrawGift(gasGiftId1)
      ).to.be.revertedWith('Pausable: paused')

      await expect(gift.connect(admin1).unpause()).to.emit(gift, 'Unpaused')
    })

    it('users can withdraw cancelled gift', async function () {
      await expect(
        gift.connect(creator2).withdrawGift(gasGiftId4)
      ).to.emit(gift, 'GiftWithdrawn')
    })

    it('users can only withdraw valid GAS gift they own', async function () {
      await expect((await gift.gifts(gasGiftId1)).state).to.equal(1)

      await expect(
        gift.connect(user2).withdrawGift(gasGiftId1)
      ).to.be.revertedWith('Not yours')

      await expect(
        gift.connect(user2).withdrawGift(gasGiftId1 * randomNum())
      ).to.be.revertedWith('Gift does not exist')

      const initialUser1GasBalance = await provider.getBalance(user1.address)
      const giftGasBalance = (await gift.gifts(gasGiftId1)).value

      const contractGasBalance = await provider.getBalance(gift.address)
      const expectedContractBalance = contractGasBalance.sub(giftGasBalance)

      const expectedUser1GasBalance = initialUser1GasBalance.add(giftGasBalance)

      await expect(gift.connect(user1).withdrawGift(gasGiftId1, { gasPrice: 0 })).to.emit(gift, 'GiftWithdrawn')
      // await expect(await gift.connect(user1).withdrawGift(gasGiftId1, { gasPrice: 0 })).to.changeBalance(user1, giftGasBalance)

      await expect(await provider.getBalance(user1.address)).to.equal(expectedUser1GasBalance)
      await expect(await provider.getBalance(gift.address)).to.equal(expectedContractBalance)
      await expect((await gift.gifts(gasGiftId1)).state).to.equal(2)
    })

    it('users can only withdraw valid TOKEN gift they own', async function () {
      await expect((await gift.gifts(tokenGiftId)).state).to.equal(1)
      await expect(
        gift.connect(user2).withdrawGift(tokenGiftId)
      ).to.be.revertedWith('Not yours')

      await expect(
        gift.connect(user2).withdrawGift(tokenGiftId * randomNum())
      ).to.be.revertedWith('Gift does not exist')

      const initialContractTokenBalance = await token.balanceOf(gift.address)
      const initialUserTokenBalance = await token.balanceOf(user1.address)
      const tokenAmount = (await gift.gifts(tokenGiftId)).value

      await expect(gift.connect(user1).withdrawGift(tokenGiftId)).to.emit(gift, 'GiftWithdrawn')

      await expect(await token.balanceOf(gift.address)).to.equal(initialContractTokenBalance.sub(tokenAmount))
      await expect(await token.balanceOf(user1.address)).to.equal(initialUserTokenBalance.add(tokenAmount))
      await expect((await gift.gifts(tokenGiftId)).state).to.equal(2)
    })

    it('users can only withdraw valid NFT gift they own', async function () {
      const nftId = (await gift.gifts(nftGiftId)).value
      await expect(await nft.ownerOf(nftId)).to.equal(gift.address)

      await expect((await gift.gifts(nftGiftId)).state).to.equal(1)
      await expect(
        gift.connect(user2).withdrawGift(nftGiftId)
      ).to.be.revertedWith('Not yours')

      await expect(
        gift.connect(user2).withdrawGift(nftGiftId * randomNum())
      ).to.be.revertedWith('Gift does not exist')

      await expect(gift.connect(user1).withdrawGift(nftGiftId)).to.emit(gift, 'GiftWithdrawn')

      await expect(await nft.ownerOf(nftId)).to.equal(user1.address)
      await expect((await gift.gifts(nftGiftId)).state).to.equal(2)
    })
  })
})
