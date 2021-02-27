const { expect } = require('chai')
const { deployProxySuite } = require('../support/deployment')

describe('InvoiceController (proxy)', function () {
  let contracts, owner

  beforeEach(async function () {
    [owner] = await ethers.getSigners()
    contracts = await deployProxySuite()
  })

  it('sets the right owner', async function () {
    expect(await contracts.invoiceController.owner()).to.equal(owner.address)
  })

  it('Gets logger address previously initialized', async function () {
    expect(await contracts.invoiceController.loggerAddress()).to.equal(contracts.logger.address)
  })

  it('Gets IBT address previously initialized', async function () {
    expect(await contracts.invoiceController.erc20Address()).to.equal(contracts.invoiceBuildToken.address)
  })

  it('Gets INFT address previously initialized', async function () {
    expect(await contracts.invoiceController.erc721Address()).to.equal(contracts.invoiceNFT.address)
  })

  it('Sets default feeBp to 5 wei (0.05%)', async function () {
    let feeBp = await contracts.invoiceController.feeBp()
    feeBp = parseFloat(ethers.utils.formatUnits(feeBp, 'wei'))

    expect(feeBp).to.equal(5)
  })

  it('Returns correct fee for amount', async function () {
    // Amount = 1000
    // feeBp = 5 = 0.05%
    // fee = baseFee + ((amount * feeBp) / 10000) = 0.5
    const amount = ethers.utils.parseUnits('1000', 'ether')
    let fee = await contracts.invoiceController.feeFor(amount)
    fee = parseFloat(ethers.utils.formatUnits(fee, 'ether'))

    expect(fee).to.equal(0.5)
  })
})
