const { expect } = require('chai')

describe('InvoiceBuild minting', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, recipient2, params, invoiceId, mintFee

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1, recipient2] = await ethers.getSigners()
    params = {
      amount: ethers.utils.parseUnits('100', 'ether'),
      recipient: recipient1.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }
    mintFee = ethers.utils.parseUnits('0.11', 'ether')

    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()

    await invoiceBuild.connect(signer1).create(...Object.values(params), { value: mintFee })
    invoiceId = 1
  })

  it('Should be owned by signer', async function () {
    expect(await invoiceBuild.ownerOf(invoiceId)).to.equal(signer1.address)
  })

  it('Should have correct tokenURI', async function () {
    expect(await invoiceBuild.tokenURI(invoiceId)).to.equal(params.metaUrl)
  })

  it('should have unique tokenURIs', async function () {
    const params2 = Object.assign({}, params, {
      metaUrl: 'https://invoice.build/2',
      recipient: recipient2.address
    })
    await invoiceBuild.connect(signer2).create(...Object.values(params2), { value: mintFee })
    expect(await invoiceBuild.tokenURI(invoiceId)).to.equal(params.metaUrl)
    expect(await invoiceBuild.tokenURI(2)).to.equal(params2.metaUrl)
  })

  it('Should add id to owners invoice map', async function () {
    const params2 = Object.assign({}, params, { recipient: recipient2.address })
    await invoiceBuild.connect(signer2).create(...Object.values(params2), { value: mintFee })
    await invoiceBuild.connect(signer1).create(...Object.values(params), { value: mintFee })
    const ids = (await invoiceBuild.invoicesForOwner(signer1.address)).map(id => id.toNumber())
    expect(ids).to.eql([1,3])
  })

  it('Increments total supply', async function () {
    await invoiceBuild.connect(signer2).create(...Object.values(params), { value: mintFee })
    const totalSupply = (await invoiceBuild.connect(owner).totalSupply()).toNumber()
    expect(totalSupply).to.equal(2)
  })

  it('Returns number of invoices owned', async function () {
    await invoiceBuild.connect(signer1).create(...Object.values(params), { value: mintFee })
    await invoiceBuild.connect(signer2).create(...Object.values(params), { value: mintFee })
    const count1 = (await invoiceBuild.connect(owner).balanceOf(signer1.address)).toNumber()
    const count2 = (await invoiceBuild.connect(owner).balanceOf(signer2.address)).toNumber()
    expect(count1).to.equal(2)
    expect(count2).to.equal(1)
  })

  it('Returns oustanding amount for token', async function () {
    const timestamp = +new Date()
    let outstanding = await invoiceBuild.invoiceOutstanding(invoiceId, timestamp)
    outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))
    expect(outstanding).to.equal(100.0)
  })

  it('Returns withdrawable balance for token', async function () {
    let balance = await invoiceBuild.invoiceBalance(invoiceId)
    balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))
    expect(balance).to.equal(0.0)
  })

  it('Returns amount for token', async function () {
    let amount = await invoiceBuild.invoiceAmount(invoiceId)
    amount = parseFloat(ethers.utils.formatUnits(amount, 'ether'))
    expect(amount).to.equal(100.0)
  })

  it('Sets isPaid to false', async function () {
    expect(await invoiceBuild.isPaid(invoiceId)).to.be.false
  })

  it('Sets dueAt', async function () {
    const dueAt = +new Date() + 1000
    const params2 = Object.assign({}, params, { dueAt })
    await invoiceBuild.connect(signer1).create(...Object.values(params2), { value: mintFee })

    expect((await invoiceBuild.dueAt(invoiceId)).toNumber()).to.equal(0)
    expect((await invoiceBuild.dueAt(2)).toNumber()).to.equal(dueAt)
  })

  it('Sets overdueInterest', async function () {
    expect((await invoiceBuild.overdueInterest(invoiceId)).toNumber()).to.equal(0)

    const overdueInterest = ethers.utils.parseUnits((8 / 100).toString(), 'ether') // 8%
    const params2 = Object.assign({}, params, { overdueInterest })
    await invoiceBuild.connect(signer1).create(...Object.values(params2), { value: mintFee })

    let interest = await invoiceBuild.overdueInterest(2)
    interest = parseFloat(ethers.utils.formatUnits(interest, 'ether'))
    expect(interest).to.equal(0.08)
  })

  it('Sets lateFees', async function () {
    expect((await invoiceBuild.lateFees(invoiceId)).toNumber()).to.equal(0)
  })

  it('Prevents zero amount invoice', async function () {
    try {
      const params2 = Object.assign({}, params, { amount: '0' })
      await invoiceBuild.connect(signer1).create(...Object.values(params2), { value: mintFee })
    } catch (error) {
      expect(error.message).to.include('Amount too low')
    }
  })

  it('Reverts if negative amount invoice', async function () {
    try {
      const params2 = Object.assign({}, params, { amount: '-100' })
      await invoiceBuild.connect(signer1).create(...Object.values(params2), { value: mintFee })
    } catch (error) {
      expect(error.message).to.include('value out-of-bounds')
    }
  })

  it('Calculates correct minting fee', async function () {
    // amount = 100
    // baseFee = 0.1
    // feeBp = 1 (0.01%)
    // fee = baseFee + ((amount * feeBp) / 10000) = 0.11
    const amount = ethers.utils.parseUnits('100', 'ether')
    let fee = await invoiceBuild.mintFeeFor(amount)
    fee = parseFloat(ethers.utils.formatUnits(fee, 'ether'))
    expect(fee).to.equal(0.11)
  })

  it('Reverts if mint fee too low', async function () {
    try {
      mintFee = ethers.utils.parseUnits('0.1', 'ether')
      await invoiceBuild.connect(signer1).create(...Object.values(params), { value: mintFee })
    } catch (error) {
      expect(error.message).to.include('Fee too low')
    }
  })

  it('Increases the contract balance', async function () {
    let contractBalance = await ethers.provider.getBalance(invoiceBuild.address)
    contractBalance = parseFloat(ethers.utils.formatUnits(contractBalance, 'ether'))

    expect(contractBalance).to.equal(0.11)
  })

  // it('Has correct default minting fee', async function () {
  //   let baseMintFee = await invoiceBuild.baseMintFee()
  //   baseMintFee = parseFloat(ethers.utils.formatUnits(baseMintFee, 'ether'))

  //   expect(baseMintFee).to.equal(0.1)
  // })

  // it('Has correct default minting fee basis points', async function () {
  //   let mintFeeBp = await invoiceBuild.mintFeeBp()
  //   mintFeeBp = parseFloat(ethers.utils.formatUnits(mintFeeBp, 'ether'))

  //   expect(mintFeeBp).to.equal(0.1)
  // })
})
