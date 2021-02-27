const { ethers, upgrades } = require("hardhat")

async function deploy() : Promise<void> {
  // Prep
  const [deployer] = await ethers.getSigners()
  console.log('👷‍♂️ Deployer:', deployer.address)
  const initBalance = ethers.utils.formatUnits((await deployer.getBalance()), 'ether')
  console.log('💰 Deployer balance:', initBalance, 'ETH')
  console.log('\n')

  // Deploy Logger
  const Logger = await ethers.getContractFactory('Logger')
  console.log('🏗  Deploying Logger...')
  const logger = await upgrades.deployProxy(Logger)
  await logger.deployed()
  console.log('✅ Deployed, Logger proxy:', logger.address)
  console.log('\n')

  // Deploy Factory
  const InvoiceFactory = await ethers.getContractFactory('InvoiceFactory')
  console.log('🏗  Deploying InvoiceFactory...')
  const invoiceFactory = await upgrades.deployProxy(InvoiceFactory, [logger.address])
  await invoiceFactory.deployed()
  console.log('✅ Deployed, InvoiceFactory proxy:', invoiceFactory.address)
  console.log('\n')

  // Set factory address for logger
  const factoryAddress = ethers.utils.getAddress(invoiceFactory.address)
  console.log('⚙️  Setting logger factory to:', factoryAddress)
  await logger.setFactory(factoryAddress, { gasLimit: 5e5, gasPrice: 3e9 })
  console.log('✅ Logger factory set!')
  console.log('\n')

  const finalBalance = ethers.utils.formatUnits((await deployer.getBalance()), 'ether')
  console.log('💰 Deployer balance:', finalBalance, 'ETH')
  console.log('💸 Deployment cost:', initBalance - finalBalance, 'ETH')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
