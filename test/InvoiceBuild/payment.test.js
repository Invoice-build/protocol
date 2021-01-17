const { expect } = require('chai')

describe('InvoiceBuild payment', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, recipient2, params

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1, recipient2] = await ethers.getSigners()
    params = {
      amount: ethers.utils.parseUnits('1000', 'ether'),
      recipient: recipient1.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }

    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()

    await invoiceBuild.connect(signer1).create(...Object.values(params))
  })

  it('Reduces invoice outstanding', async function () {
    const value = ethers.utils.parseUnits('150.5', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    const timestamp = +new Date()
    let outstanding = await invoiceBuild.invoiceOutstanding(1, timestamp)
    outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))

    expect(outstanding).to.equal(849.5)
  })

  it('Increases invoice withdrawable balance', async function () {})

  it('Doesnt increase the contract balance', async function () {
    const value = ethers.utils.parseUnits('150.5', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    let contractBalance = await ethers.provider.getBalance(invoiceBuild.address)
    contractBalance = parseFloat(ethers.utils.formatUnits(contractBalance, 'ether'))

    expect(contractBalance).to.equal(0)
  })

  it('Prevents overpayment', async function () {
    try {
      const value = ethers.utils.parseUnits('1001', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })
    } catch (error) {
      expect(error.message).to.include('Amount greater than remaining balance')
    }
  })

  it('Marked as paid if full amount sent', async function () {})

  describe('Overdue', function () {
    it('Is not marked as paid if full amount sent', async function () {})
    it('Has outstanding if full amount sent', async function () {})
    it('Marked as paid if outstanding + overdue fee sent', async function () {})
  })
})
