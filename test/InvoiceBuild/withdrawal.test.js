const { expect } = require('chai')

describe('InvoiceBuild withdrawal', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, params

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1] = await ethers.getSigners()
    params = {
      amount: ethers.utils.parseUnits('100', 'ether'),
      recipient: recipient1.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }

    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()

    await invoiceBuild.connect(signer1).create(...Object.values(params))
  })

  it('Fails if not owner', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    try {
      await invoiceBuild.connect(signer2).withdrawBalance(1)
    } catch (error) {
      expect(error.message).to.include('not the owner')
    }
  })

  it('Fails if nothing to withdraw', async function () {
    try {
      await invoiceBuild.connect(signer1).withdrawBalance(1)
    } catch (error) {
      expect(error.message).to.include('Nothing to withdraw')
    }
  })

  it('Fails if already fully withdrawn', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })
    await invoiceBuild.connect(signer1).withdrawBalance(1)

    try {
      await invoiceBuild.connect(signer1).withdrawBalance(1)
    } catch (error) {
      expect(error.message).to.include('Nothing to withdraw')
    }
  })

  it('Increases balance of recipient', async function () {
    let startingBalance = await ethers.provider.getBalance(recipient1.address)
    startingBalance = parseFloat(ethers.utils.formatUnits(startingBalance, 'ether'))

    const value = ethers.utils.parseUnits('50', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })
    await invoiceBuild.connect(signer1).withdrawBalance(1)

    let newBalance = await ethers.provider.getBalance(recipient1.address)
    newBalance = parseFloat(ethers.utils.formatUnits(newBalance, 'ether'))
    
    expect(newBalance - startingBalance).to.equal(50.0)
  })
})
