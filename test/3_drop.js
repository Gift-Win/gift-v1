
const { keys } = require('../../accounts.json')
const { expect } = require('chai')

const privateKeys = {
  admin1: keys[0],
  admin2: keys[1],
  user1: keys[2]
}

const Admin2Signer = new ethers.utils.SigningKey(privateKeys.admin2)
const User1Signer = new ethers.utils.SigningKey(privateKeys.user1)

const signature = (signer, sender, amount) => {
  const hash = ethers.utils.solidityKeccak256(
    ['address', 'uint256'],
    [sender, amount]
  )

  const prefixedHash = ethers.utils.solidityKeccak256(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', hash]
  )

  return ethers.utils.joinSignature(signer.signDigest(prefixedHash))
}

describe('One time airdropper contract', function () {
  let dropper, token, admin1, admin2, user1, user2
  before(async () => {
    [admin1, admin2, user1, user2] = await ethers.getSigners()

    const OneTimeDropper = await ethers.getContractFactory('OneTimeDropper')
    dropper = await OneTimeDropper.deploy()

    const Token = await ethers.getContractFactory('Token')
    token = await Token.deploy()
  })

  describe('admin tests', function () {
    it('deployer is admin', async function () {
      await expect(await dropper.admin()).to.equal(admin1.address)
    })

    it('only admins can change admin', async function () {
      await expect(dropper.connect(user1).setAdmin(admin2.address)).to.be.revertedWith('Not authorized')

      await expect(dropper.connect(admin1).setAdmin(admin2.address)).to.emit(dropper, 'NewAdmin')

      expect(await dropper.admin()).to.equal(admin2.address)
    })

    it('only admins can start', async function () {
      await expect(await dropper.balance()).to.equal(0)
      await expect(await dropper.balance()).to.equal(0)

      const airdropTotalAmount = ethers.utils.parseEther('200')
      await token.connect(admin1).transfer(dropper.address, airdropTotalAmount)

      await expect(dropper.connect(user1).start(token.address)).to.be.revertedWith('Not authorized')

      await expect(dropper.connect(admin2).start(token.address)).to.emit(dropper, 'Started')

      await expect(await dropper.total()).to.equal(airdropTotalAmount)
      await expect(await dropper.balance()).to.equal(airdropTotalAmount)
    })
  })

  describe('user tests', function () {
    it('only users with valid signature can claim airdrop', async function () {
      const initialContractBalanceValue = await dropper.balance()
      const initialContractTokenBalance = await token.balanceOf(dropper.address)
      const initialUser1TokenBalance = await token.balanceOf(user1.address)

      await expect(await dropper.participant(user1.address)).to.equal(false)

      const amount = ethers.utils.parseEther('100')

      const sigForUser1ByUser1 = signature(User1Signer, user1.address, amount)
      const sigForUser1ByAdmin2 = signature(Admin2Signer, user1.address, amount)

      await expect(dropper.connect(user1).claimDrop(amount, sigForUser1ByUser1)).to.be.revertedWith('Invalid signature')
      await expect(dropper.connect(user2).claimDrop(amount, sigForUser1ByAdmin2)).to.be.revertedWith('Invalid signature')
      await expect(dropper.connect(user1).claimDrop(amount, sigForUser1ByAdmin2)).to.emit(dropper, 'Airdropped')

      await expect(await dropper.balance()).to.equal(initialContractBalanceValue.sub(amount))
      await expect(await token.balanceOf(dropper.address)).to.equal(initialContractTokenBalance.sub(amount))
      await expect(await token.balanceOf(user1.address)).to.equal(initialUser1TokenBalance.add(amount))

      await expect(await dropper.participant(user1.address)).to.equal(true)
    })

    it('same user cannot claim airdrop twice', async function () {
      const amount = ethers.utils.parseEther('100')
      const sig = signature(Admin2Signer, user1.address, amount)

      await expect(dropper.connect(user1).claimDrop(amount, sig)).to.be.revertedWith('Already claimed')
    })

    it('other uses too can claim airdrop', async function () {
      const amount = ethers.utils.parseEther('100')
      const sig = signature(Admin2Signer, user2.address, amount)

      await expect(dropper.connect(user2).claimDrop(amount, sig)).to.emit(dropper, 'Airdropped')
    })

    it('users cannot claim airdrop when consumed', async function () {
      const amount = ethers.utils.parseEther('100')
      const sig = signature(Admin2Signer, admin1.address, amount)

      await expect(dropper.connect(admin1).claimDrop(amount, sig)).to.be.revertedWith('Airdrop consumed')
    })
  })
})
