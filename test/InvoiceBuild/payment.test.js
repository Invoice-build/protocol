const { expect } = require('chai')

describe('InvoiceBuild payment', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, signer3, recipient1, params

  beforeEach(async function () {
    [owner, signer1, signer2, signer3, recipient1] = await ethers.getSigners()
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

  it('Reduces invoice outstanding', async function () {
    const value = ethers.utils.parseUnits('15.5', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    const timestamp = +new Date()
    let outstanding = await invoiceBuild.invoiceOutstanding(1, timestamp)
    outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))

    expect(outstanding).to.equal(84.5)
  })

  it('Increases invoice withdrawable balance', async function () {})

  it('Doesnt increase the contract balance', async function () {
    const value = ethers.utils.parseUnits('15.5', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    let contractBalance = await ethers.provider.getBalance(invoiceBuild.address)
    contractBalance = parseFloat(ethers.utils.formatUnits(contractBalance, 'ether'))

    expect(contractBalance).to.equal(0)
  })

  it('Prevents overpayment', async function () {
    try {
      const value = ethers.utils.parseUnits('101', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })
    } catch (error) {
      expect(error.message).to.include('Amount greater than remaining balance')
    }
  })

  it('Prevents payment after marked as isPaid', async function () {
    try {
      const value = ethers.utils.parseUnits('100', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })

      expect(await invoiceBuild.isPaid(1)).to.be.true
      
      await invoiceBuild.connect(signer3).makePayment(1, { value })
    } catch (error) {
      expect(error.message).to.include('Invoice already paid off')
    }
  })

  it('Marked as paid if full amount sent', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    expect(await invoiceBuild.isPaid(1)).to.be.true
  })

  it('Returns 0 for overdueFee', async function () {
    const nowTimestamp = Math.round((new Date() / 1000))
    let overdueFee = await invoiceBuild.overdueFee(1, nowTimestamp)
    overdueFee = parseFloat(ethers.utils.formatUnits(overdueFee, 'ether'))

    expect(overdueFee).to.equal(0)
  })

  it('Returns 0 for lateFees after payment', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(1, { value })

    let lateFees = await invoiceBuild.lateFees(1)
    lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))

    expect(lateFees).to.equal(0)
  })

  it('Can be partially paid back', async function () {
    const value = ethers.utils.parseUnits('50', 'ether').toHexString()

    await invoiceBuild.connect(signer2).makePayment(1, { value })
    expect(await invoiceBuild.isPaid(1)).to.be.false

    await invoiceBuild.connect(signer2).makePayment(1, { value })
    expect(await invoiceBuild.isPaid(1)).to.be.true
  })

  describe('Overdue', function () {
    beforeEach(async function () {
      const dueAt = Math.round((new Date() / 1000)) - 36000 // 10 hours ago
      const overdueInterest = ethers.utils.parseUnits((8 / 100).toString(), 'ether') // 8%

      const params2 = Object.assign({}, params, { dueAt, overdueInterest })
      await invoiceBuild.connect(signer1).create(...Object.values(params2))
    })

    it('Returns true for isOverdue', async function () {
      const nowTimestamp = Math.round((new Date() / 1000))
      expect(await invoiceBuild.isOverdue(2, nowTimestamp)).to.be.true
    })

    it('Is not marked as paid if full amount sent but not fees', async function () {
      const value = ethers.utils.parseUnits('100', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(2, { value })

      expect(await invoiceBuild.isPaid(2)).to.be.false
    })

    it('Has outstanding if full amount sent', async function () {
      const value = ethers.utils.parseUnits('100', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(2, { value })

      const nowTimestamp = Math.round((new Date() / 1000))
      let outstanding = await invoiceBuild.invoiceOutstanding(2, nowTimestamp)
      outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))

      expect(outstanding).to.not.equal(0)
    })

    it('Marked as paid if outstanding + overdue fee sent', async function () {
      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(2, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(2, { value })

      expect(await invoiceBuild.isPaid(2)).to.be.true
    })

    it('Has overdue fees within first hour overdue', async function () {
      // I think this is why we had the .add(1) in hoursOverdue()
      // So that fees would start getting added immediately after the due date and not an hour after
    })

    it('Records lateFees on final payment', async function () {
      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(2, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(2, { value })

      let lateFees = await invoiceBuild.lateFees(2)
      lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))
      expect(lateFees).to.not.equal(0)
    })

    it('Calculates correct lateFee', async function () {
      // hoursOverdue = 10
      // amount = 1000
      // interest = 0.08 = 8%
      // hoursInYear = 8760
      // feePerHour = (amount * interest) / hoursInYear = 0.00913242
      // lateFees = hoursOverdue * feePerHour = 0.091324201
      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(2, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(2, { value })

      let lateFees = await invoiceBuild.lateFees(2)
      lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))
      expect(lateFees.toFixed(6)).to.equal('0.009132')
    })
  })
})
