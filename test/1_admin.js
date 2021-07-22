
const { keys } = require('../../accounts.json')

const privateKeys = {
  admin1: keys[0]
}

const { expect } = require('chai')
const { provider } = waffle

const nullAddress = '0x0000000000000000000000000000000000000000'
const nullHash = ethers.utils.solidityKeccak256(['string'], [''])

const nullGiftCode = ''
const nullGiftSignature = '0x'

const signature = (...args) => {
  const hash = ethers.utils.solidityKeccak256(
    ['uint256', 'address', 'uint256', 'bytes32', 'address', 'uint256', 'uint256', 'uint256'],
    [...args]
  )

  const prefixedHash = ethers.utils.solidityKeccak256(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', hash]
  )

  const signer = new ethers.utils.SigningKey(privateKeys.admin1)
  const sig = ethers.utils.joinSignature(signer.signDigest(prefixedHash))

  return sig
}

describe('Gift contract', function () {
  let gift, admin1, admin2, user1, user2

  before(async () => {
    [admin1, admin2, user1, user2] = await ethers.getSigners()

    const Gift = await ethers.getContractFactory('GiftV1')
    gift = await Gift.deploy(admin1.address)
  })

  describe('admin tests', function () {
    it('keeper is correctly set', async function () {
      await expect(await gift.santa()).to.equal(admin1.address)
    })

    it('only admins can pause', async function () {
      await expect(gift.connect(user1).pause()).to.be.revertedWith('Not authorized')

      await expect(gift.connect(admin1).pause())
        .to.emit(gift, 'Paused')

      expect(await gift.paused()).to.equal(true)
    })

    it('only admins can unpause', async function () {
      await expect(gift.connect(user1).unpause()).to.be.revertedWith('Not authorized')

      await expect(gift.connect(admin1).unpause()).to.emit(gift, 'Unpaused')

      await expect(await gift.paused()).to.equal(false)
    })

    it('only admins can change fee', async function () {
      const initialFee = (await gift.fee())
      const newFee = initialFee.add(ethers.utils.parseEther(String(5)))

      await expect(gift.connect(user1).setFee(newFee)).to.be.revertedWith('Not authorized')

      await expect(gift.connect(admin1).setFee(newFee)).to.be.emit(gift, 'NewFee')

      await expect((await gift.fee())).to.equal(newFee)
    })

    it('only admins can change keeper', async function () {
      const initialKeeper = (await gift.santa())
      const newKeeper = admin2.address

      await expect(initialKeeper).to.not.equal(newKeeper)
      await expect(gift.connect(user1).setKeeper(newKeeper)).to.be.revertedWith('Not authorized')

      await expect(gift.connect(admin1).setKeeper(newKeeper)).to.be.emit(gift, 'NewKeeper')

      await expect(await gift.santa()).to.equal(newKeeper)
    })

    it('only admins can unpause', async function () {
      await gift.connect(admin1).pause()
      await expect(await gift.paused()).to.equal(true)

      await expect(gift.connect(user1).unpause()).to.be.revertedWith('Not authorized')
      await expect(await gift.paused()).to.equal(true)

      await expect(gift.connect(admin1).unpause()).to.emit(gift, 'Unpaused')
      await expect(await gift.paused()).to.equal(false)
    })

    it('admin can add other admin', async function () {
      const initialAdminCount = (await gift.adminCount()).toNumber()

      await gift.connect(admin1).addAdmin(admin2.address)
      await expect(await gift.isAdmin(admin2.address)).to.equal(true)

      await expect((await gift.adminCount()).toNumber()).to.equal(initialAdminCount + 1)
    })

    it('admin can remove other admin', async function () {
      const initialAdminCount = (await gift.adminCount()).toNumber()

      await gift.connect(admin1).removeAdmin(admin2.address)
      await expect(await gift.isAdmin(admin2.address)).to.equal(false)

      await expect((await gift.adminCount()).toNumber()).to.equal(initialAdminCount - 1)
    })

    it('only admins can add other admin', async function () {
      const initialAdminCount = (await gift.adminCount()).toNumber()

      await expect(gift.connect(user1).addAdmin(user2.address)).to.be.revertedWith('Not authorized')
      await expect((await gift.adminCount()).toNumber()).to.equal(initialAdminCount)
    })

    it('only admins can remove other admin', async function () {
      await gift.connect(admin1).addAdmin(admin2.address)
      await expect(await gift.isAdmin(admin2.address)).to.equal(true)

      await expect(gift.connect(user1).removeAdmin(admin2.address)).to.be.revertedWith('Not authorized')
      await expect(await gift.isAdmin(admin2.address)).to.equal(true)
    })

    it('admin can renounce', async function () {
      await gift.connect(admin2).renounceAdmin()
      await expect(await gift.isAdmin(admin2.address)).to.equal(false)
    })

    it('cannot remove last admin', async function () {
      await expect(await gift.isAdmin(admin1.address)).to.equal(true)

      await expect(gift.connect(admin1).removeAdmin(admin1.address)).to.be.revertedWith('Cannot remove last admin')
      await expect(gift.connect(admin1).renounceAdmin()).to.be.revertedWith('Cannot remove last admin')

      await expect(await gift.isAdmin(admin1.address)).to.equal(true)
    })

    it('only admins can withdraw gas tokens', async function () {
      await admin1.sendTransaction({ to: gift.address, value: ethers.utils.parseEther('10') })

      const initialUser1GasBalance = await provider.getBalance(user1.address)
      const contractGasBalance = await provider.getBalance(gift.address)

      const expectedUser1GasBalance = initialUser1GasBalance.add(contractGasBalance)

      await expect(gift.connect(user2).withdrawGas(user1.address)).to.be.revertedWith('Not authorized')
      await expect(gift.connect(admin1).withdrawGas(user1.address)).to.emit(gift, 'GasWithdrawn')

      expect((await provider.getBalance(user1.address))).to.equal(expectedUser1GasBalance)
    })
  })

  describe('gas transfers tests', function () {
    before(async () => {
      await expect(await gift.giftGas()).to.equal(0)

      const giftFee = (await gift.fee())

      const extraGasValue = ethers.utils.parseEther('10')
      const giftGasValue = ethers.utils.parseEther('20')
      await admin1.sendTransaction({ to: gift.address, value: extraGasValue })

      await expect(gift.connect(admin1).setKeeper(admin1.address)).to.be.emit(gift, 'NewKeeper')

      const params = [0, nullAddress, 0, nullHash, user1.address, 0, 7, 2]

      await expect(
        gift
          .connect(admin2)
          .createGift(...params, signature(...params), { value: giftGasValue.add(giftFee) })
      ).to.emit(gift, 'NewGift')

      await expect(await gift.giftGas()).to.equal(giftGasValue)
      await expect(await provider.getBalance(gift.address)).to.equal(extraGasValue.add(giftGasValue).add(giftFee))
    })

    it('admins gas withdrawal does not negatively affect gift gas', async function () {
      const gasesBelongingToGiftsValue = await gift.giftGas()

      const initialUser1GasBalance = await provider.getBalance(user1.address)
      const initialContractGasBalance = await provider.getBalance(gift.address)

      const withdrawableGasAmountByAdmins = initialContractGasBalance.sub(gasesBelongingToGiftsValue)
      const expectedUser1GasBalance = initialUser1GasBalance.add(withdrawableGasAmountByAdmins)

      expect(+initialContractGasBalance).to.be.greaterThan(+withdrawableGasAmountByAdmins)

      await expect(gift.connect(admin1).withdrawGas(user1.address)).to.emit(gift, 'GasWithdrawn')

      expect(await provider.getBalance(user1.address)).to.equal(expectedUser1GasBalance)
      expect(await provider.getBalance(gift.address)).to.equal(gasesBelongingToGiftsValue)
    })

    it("user's GAS-based gift withdrawal does not negatively affect gift gas", async function () {
      const extraGasValue = ethers.utils.parseEther('10')
      await admin1.sendTransaction({ to: gift.address, value: extraGasValue })

      await ethers.provider.send('evm_mine')

      const giftId = await gift.count()

      const initialUser1GasBalance = await provider.getBalance(user1.address)
      const initialContractGasBalance = await provider.getBalance(gift.address)
      const giftGasValue = (await gift.gifts(1)).value

      const expectedUser1GasBalance = initialUser1GasBalance.add(giftGasValue)
      const expectedContractGasBalance = initialContractGasBalance.sub(giftGasValue)

      expect(+expectedContractGasBalance).to.be.greaterThan(0)

      await expect(
        gift.connect(user1).claimGift(giftId, nullGiftCode, nullGiftSignature, { gasPrice: 0 })
      ).to.emit(gift, 'GiftClaimed')

      await expect(
        gift.connect(user1).withdrawGift(giftId, { gasPrice: 0 })
      ).to.emit(gift, 'GiftWithdrawn')

      expect((await provider.getBalance(user1.address))).to.equal(expectedUser1GasBalance)
      expect((await provider.getBalance(gift.address))).to.equal(expectedContractGasBalance)
    })
  })
})
