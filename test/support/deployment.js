module.exports = {
  deploySuite: async function () {
    const [owner] = await ethers.getSigners()

    // Deploy logger
    const Logger = await ethers.getContractFactory('InvoiceLogger')
    const logger = await Logger.deploy()
    await logger.deployed()
    await logger.initialize()

    // Deploy IBT token (ERC20)
    const InvoiceBuildToken = await ethers.getContractFactory('InvoiceBuildToken')
    const invoiceBuildToken = await InvoiceBuildToken.deploy()
    await invoiceBuildToken.deployed()
    await invoiceBuildToken.initialize()

    // Deploy INFT token (ERC721)
    const InvoiceNFT = await ethers.getContractFactory('InvoiceNFT')
    const invoiceNFT = await InvoiceNFT.deploy()
    await invoiceNFT.deployed()
    await invoiceNFT.initialize()

    // Deploy controller
    const InvoiceController = await ethers.getContractFactory('InvoiceController')
    const invoiceController = await InvoiceController.deploy()
    await invoiceController.deployed()
    await invoiceController.initialize(logger.address, invoiceBuildToken.address, invoiceNFT.address)

    // Set controller on dependent contracts
    await logger.setController(invoiceController.address)
    await invoiceBuildToken.setController(invoiceController.address)
    await invoiceNFT.setController(invoiceController.address)

    return { logger, invoiceController, invoiceBuildToken, invoiceNFT }
  },

  deployProxySuite: async function () {
    // Deploy logger
    const Logger = await ethers.getContractFactory('InvoiceLogger')
    const logger = await upgrades.deployProxy(Logger)

    // Deploy IBT token (ERC20)
    const InvoiceBuildToken = await ethers.getContractFactory('InvoiceBuildToken')
    const invoiceBuildToken = await upgrades.deployProxy(InvoiceBuildToken)

    // Deploy INFT token (ERC721)
    const InvoiceNFT = await ethers.getContractFactory('InvoiceNFT')
    const invoiceNFT = await upgrades.deployProxy(InvoiceNFT)

    // Deploy controller
    const InvoiceController = await ethers.getContractFactory('InvoiceController')
    const invoiceController = await upgrades.deployProxy(InvoiceController, [logger.address, invoiceBuildToken.address, invoiceNFT.address])

    // Set controller on dependent contracts
    await logger.setController(invoiceController.address)
    await invoiceBuildToken.setController(invoiceController.address)
    await invoiceNFT.setController(invoiceController.address)

    return { logger, invoiceController, invoiceBuildToken, invoiceNFT }
  }
}
