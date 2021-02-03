const { expect } = require('chai')

describe('InvoiceBuild payment', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, signer3, recipient1, params, invoiceId

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
    invoiceId = 1
  })

  it('Reduces invoice outstanding', async function () {
    const value = ethers.utils.parseUnits('15.5', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    const timestamp = +new Date()
    let outstanding = await invoiceBuild.invoiceOutstanding(invoiceId, timestamp)
    outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))

    expect(outstanding).to.equal(84.5)
  })

  it('Increases invoice withdrawable balance', async function () {})

  it('Doesnt increase the contract balance', async function () {
    const value = ethers.utils.parseUnits('15.5', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    let contractBalance = await ethers.provider.getBalance(invoiceBuild.address)
    contractBalance = parseFloat(ethers.utils.formatUnits(contractBalance, 'ether'))

    expect(contractBalance).to.equal(0)
  })

  it('Prevents overpayment', async function () {
    try {
      const value = ethers.utils.parseUnits('101', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })
    } catch (error) {
      expect(error.message).to.include('Amount greater than remaining balance')
    }
  })

  it('Prevents payment after marked as isPaid', async function () {
    try {
      const value = ethers.utils.parseUnits('100', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      expect(await invoiceBuild.isPaid(invoiceId)).to.be.true
      
      await invoiceBuild.connect(signer3).makePayment(invoiceId, { value })
    } catch (error) {
      expect(error.message).to.include('Invoice already paid off')
    }
  })

  it('Marked as paid if full amount sent', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    expect(await invoiceBuild.isPaid(invoiceId)).to.be.true
  })

  it('Returns 0 for overdueFee', async function () {
    const nowTimestamp = Math.round((new Date() / 1000))
    let overdueFee = await invoiceBuild.overdueFee(invoiceId, nowTimestamp)
    overdueFee = parseFloat(ethers.utils.formatUnits(overdueFee, 'ether'))

    expect(overdueFee).to.equal(0)
  })

  it('Returns 0 for lateFees after payment', async function () {
    const value = ethers.utils.parseUnits('100', 'ether').toHexString()
    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

    let lateFees = await invoiceBuild.lateFees(invoiceId)
    lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))

    expect(lateFees).to.equal(0)
  })

  it('Can be partially paid back', async function () {
    const value = ethers.utils.parseUnits('50', 'ether').toHexString()

    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })
    expect(await invoiceBuild.isPaid(invoiceId)).to.be.false

    await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })
    expect(await invoiceBuild.isPaid(invoiceId)).to.be.true
  })

  describe('Overdue', function () {
    beforeEach(async function () {
      const dueAt = Math.round((new Date() / 1000)) - 36000 // 10 hours ago
      const overdueInterest = ethers.utils.parseUnits((8 / 100).toString(), 'ether') // 8%

      const params2 = Object.assign({}, params, { dueAt, overdueInterest })
      await invoiceBuild.connect(signer1).create(...Object.values(params2))
      invoiceId = 2
    })

    it('Returns true for isOverdue', async function () {
      const nowTimestamp = Math.round((new Date() / 1000))
      expect(await invoiceBuild.isOverdue(invoiceId, nowTimestamp)).to.be.true
    })

    it('Is not marked as paid if full amount sent but not fees', async function () {
      const value = ethers.utils.parseUnits('100', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      expect(await invoiceBuild.isPaid(invoiceId)).to.be.false
    })

    it('Has outstanding if full amount sent', async function () {
      const value = ethers.utils.parseUnits('100', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      const nowTimestamp = Math.round((new Date() / 1000))
      let outstanding = await invoiceBuild.invoiceOutstanding(invoiceId, nowTimestamp)
      outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))

      expect(outstanding).to.not.equal(0)
    })

    it('Marked as paid if outstanding + overdue fee sent', async function () {
      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(invoiceId, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      expect(await invoiceBuild.isPaid(invoiceId)).to.be.true
    })

    it('Has overdue fees within first hour overdue', async function () {
      const dueAt = Math.round((new Date() / 1000)) - 1200 // 20 mins overdue
      const overdueInterest = ethers.utils.parseUnits((8 / 100).toString(), 'ether') // 8%
      const newParams = Object.assign({}, params, { dueAt, overdueInterest })

      await invoiceBuild.connect(signer1).create(...Object.values(newParams))
      const invoiceId = 3

      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(invoiceId, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      let lateFees = await invoiceBuild.lateFees(invoiceId)
      lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))
      console.log('lateFees', lateFees)
      expect(lateFees).to.not.equal(0)
    })

    it('Records lateFees on final payment', async function () {
      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(invoiceId, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      let lateFees = await invoiceBuild.lateFees(invoiceId)
      lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))
      expect(lateFees).to.not.equal(0)
    })

    it('Calculates correct lateFee', async function () {
      // hoursOverdue = 11
      // amount = 100
      // interest = 0.08 = 8%
      // hoursInYear = 8760
      // feePerHour = (amount * interest) / hoursInYear = 0.000913242
      // lateFees = hoursOverdue * feePerHour = 0.010045662
      const nowTimestamp = Math.round((new Date() / 1000))
      const value = (await invoiceBuild.invoiceOutstanding(invoiceId, nowTimestamp)).toString()

      await invoiceBuild.connect(signer2).makePayment(invoiceId, { value })

      let lateFees = await invoiceBuild.lateFees(invoiceId)
      lateFees = parseFloat(ethers.utils.formatUnits(lateFees, 'ether'))
      expect(lateFees.toFixed(6)).to.equal('0.010046')
    })
  })
})
