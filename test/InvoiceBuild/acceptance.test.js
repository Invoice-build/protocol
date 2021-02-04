const { expect } = require('chai')

describe('InvoiceBuild acceptance', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, recipient2, params, invoiceId

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1, recipient2] = await ethers.getSigners()
    params = {
      amount: ethers.utils.parseUnits('100', 'ether'),
      recipient: recipient1.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }
    const mintFee = ethers.utils.parseUnits('0.2', 'ether')

    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()

    await invoiceBuild.connect(signer1).create(...Object.values(params), { value: mintFee })
    invoiceId = 1
  })

  it('Can be accepted', async function () {
    await invoiceBuild.connect(signer2).accept(invoiceId)
    expect(await invoiceBuild.acceptedBy(invoiceId)).to.equal(signer2.address)
    expect(await invoiceBuild.isAccepted(invoiceId)).to.be.true
  })

  it('Returns false if not yet accepted', async function () {
    expect(await invoiceBuild.acceptedBy(invoiceId)).to.equal(ethers.constants.AddressZero)
    expect(await invoiceBuild.isAccepted(invoiceId)).to.be.false
  })

  it('Reverts if already accepted', async function () {
    try {
      await invoiceBuild.connect(signer2).accept(invoiceId)

      expect(await invoiceBuild.isAccepted(invoiceId)).to.be.true
      
      await invoiceBuild.connect(signer2).accept(invoiceId)
    } catch (error) {
      expect(error.message).to.include('Already accepted')
    }
  })

  it('Increases clients reputation on final payment', async function () {
    await invoiceBuild.connect(signer2).accept(invoiceId)

    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    let rep = await invoiceBuild.connect(signer2).reputationFor(signer2.address)
    rep = parseFloat(ethers.utils.formatUnits(rep, 'ether'))
    expect(rep).to.equal(100/100_000)
  })

  it('Fractionally increases clients reputation on partial payment', async function () {
    await invoiceBuild.connect(signer2).accept(invoiceId)

    const value = ethers.utils.parseUnits('50', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    let rep = await invoiceBuild.connect(signer2).reputationFor(signer2.address)
    rep = parseFloat(ethers.utils.formatUnits(rep, 'ether'))
    expect(rep).to.equal(50/100_000)

    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    rep = await invoiceBuild.connect(signer2).reputationFor(signer2.address)
    rep = parseFloat(ethers.utils.formatUnits(rep, 'ether'))
    expect(rep).to.equal(100/100_000)
  })
})
