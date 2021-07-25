async function main () {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)
  console.log('Account balance:', (await deployer.getBalance()).toString())

  console.log('\n\n----------------------- GIFT -----------------------\n\n')

  const Gift = await ethers.getContractFactory('GiftV1')
  const gift = await Gift.deploy(deployer.address)

  console.log('Gift address:', gift.address)

  console.log('\n\n----------------------- TOKEN -----------------------\n\n')

  const Token = await ethers.getContractFactory('Token')
  const token = await Token.deploy()

  console.log('Token address:', token.address)

  console.log('\n\n----------------------- NFT -----------------------\n\n')

  const NFT = await ethers.getContractFactory('NFT')
  const nft = await NFT.deploy()

  await nft.mint(deployer.address, 1)
  await nft.mint(deployer.address, 2)
  await nft.mint(deployer.address, 3)
  await nft.mint(deployer.address, 4)

  console.log('NFT address:', nft.address)

  console.log('\n\n----------------------- ONT TIME AIRDROPPER -----------------------\n\n')

  const Dropper = await ethers.getContractFactory('OneTimeDropper')
  const dropper = await Dropper.deploy()

  const dropperTokenBalance = ethers.utils.parseEther('600000')
  await token.connect(deployer).transfer(dropper.address, dropperTokenBalance)

  await dropper.connect(deployer).start(token.address)

  console.log('OneTimeDropper address:', dropper.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
