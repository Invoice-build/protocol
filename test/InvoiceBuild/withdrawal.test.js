const { expect } = require('chai')

describe('InvoiceBuild withdrawal', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, params, mintFee, invoiceId

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1] = await ethers.getSigners()
    params = {
      amount: ethers.utils.parseUnits('100', 'ether'),
      recipient: recipient1.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }
    mintFee = ethers.utils.parseUnits('0.2', 'ether')

    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()

    await invoiceBuild.connect(signer1).create(...Object.values(params), { value: mintFee })
    invoiceId = 1
  })

  it('Fails if not owner', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    try {
      await invoiceBuild.connect(signer2).withdrawBalance(invoiceId)
    } catch (error) {
      expect(error.message).to.include('not the owner')
    }
  })

  it('Fails if nothing to withdraw', async function () {
    try {
      await invoiceBuild.connect(signer1).withdrawBalance(invoiceId)
    } catch (error) {
      expect(error.message).to.include('Nothing to withdraw')
    }
  })

  it('Fails if already fully withdrawn', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })
    await invoiceBuild.connect(signer1).withdrawBalance(invoiceId)

    try {
      await invoiceBuild.connect(signer1).withdrawBalance(invoiceId)
    } catch (error) {
      expect(error.message).to.include('Nothing to withdraw')
    }
  })

  it('Increases balance of recipient', async function () {
    let startingBalance = await ethers.provider.getBalance(recipient1.address)
    startingBalance = parseFloat(ethers.utils.formatUnits(startingBalance, 'ether'))

    const value = ethers.utils.parseUnits('50', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })
    await invoiceBuild.connect(signer1).withdrawBalance(invoiceId)

    let newBalance = await ethers.provider.getBalance(recipient1.address)
    newBalance = parseFloat(ethers.utils.formatUnits(newBalance, 'ether'))
    
    expect(newBalance - startingBalance).to.equal(50.0)
  })
})
