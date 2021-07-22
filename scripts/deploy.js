async function main () {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)
  console.log('Account balance:', (await deployer.getBalance()).toString())

  const Gift = await ethers.getContractFactory('GiftV1')
  const gift = await Gift.deploy(deployer.address)

  console.log('Gift address:', gift.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
