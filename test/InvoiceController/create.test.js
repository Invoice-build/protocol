const { expect } = require('chai')
const { deployProxySuite } = require('../support/deployment')
const InvoiceV1 = require('../../artifacts/contracts/InvoiceV1.sol/InvoiceV1.json')

describe('InvoiceController #create', function () {
  let contracts, owner, signer1, signer2, params, mintFee

  async function createInvoice(creator, attrs, value) {
    return await contracts.invoiceController.connect(creator).create(...Object.values(attrs), { value })
  }

  beforeEach(async function () {
    [owner, signer1, signer2] = await ethers.getSigners()
    contracts = await deployProxySuite()

    params = {
      amount: ethers.utils.parseUnits('100', 'ether'),
      recipient: signer2.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }
    fee = ethers.utils.parseUnits('0.05', 'ether')
  })

  it('Creates an invoice', async function () {
    await createInvoice(signer1, params, fee)
    expect(await contracts.invoiceController.invoiceCountForOwner(signer1.address)).to.equal(1)
    expect(await contracts.invoiceController.invoiceCountForOwner(signer2.address)).to.equal(0)
  })

  it('Fails if amount 0', async function () {
    const params2 = Object.assign({}, params, {
      amount: ethers.utils.parseUnits('0', 'ether')
    })
    try {
      await createInvoice(signer1, params2, fee)
    } catch (error) {
      expect(error.message).to.include('Amount to low')
    }
  })

  it('Fails if amount less than 0', async function () {
    const params2 = Object.assign({}, params, {
      amount: ethers.utils.parseUnits('-1', 'ether')
    })
    try {
      await createInvoice(signer1, params2, fee)
    } catch (error) {
      expect(error.message).to.include('value out-of-bounds')
    }
  })

  it('Increments account invoice number', async function () {
    await createInvoice(signer1, params, fee)
    expect(await contracts.invoiceController.invoiceNumberForAccount(signer1.address)).to.equal(1)
    expect(await contracts.invoiceController.invoiceNumberForAccount(signer2.address)).to.equal(0)
  })

  it('Mints an ERC721 token', async function () {
    await createInvoice(signer1, params, fee)

    expect(await contracts.invoiceNFT.balanceOf(signer1.address)).to.equal(1)
    expect(await contracts.invoiceNFT.ownerOf(1)).to.equal(signer1.address)
    expect(await contracts.invoiceNFT.tokenURI(1)).to.equal(params.metaUrl)
  })

  it('Deploys and invoice contract', async function () {
    await createInvoice(signer1, params, fee)
    const invoiceAddress = await contracts.invoiceController.invoices(1)
    const invoice = new ethers.Contract(invoiceAddress, InvoiceV1.abi)

    expect(await invoice.connect(signer2).tokenId()).to.equal(1)
    expect(await invoice.connect(signer2).number()).to.equal(1)

    let invoiceAmount = await invoice.connect(signer2).amount()
    invoiceAmount = parseFloat(ethers.utils.formatUnits(invoiceAmount, 'ether'))
    expect(invoiceAmount).to.equal(100)
  })

  it('Transfers ownership of invoice to creator', async function () {
    await createInvoice(signer1, params, fee)
    const invoiceAddress = await contracts.invoiceController.invoices(1)
    const invoice = new ethers.Contract(invoiceAddress, InvoiceV1.abi)

    expect(await invoice.connect(signer2).owner()).to.equal(signer1.address)
  })

  it('Associates sender with token ID', async function () {
    await createInvoice(signer1, params, fee)
    await createInvoice(signer2, params, fee)
    await createInvoice(signer1, params, fee)

    const signer1Ids = (await contracts.invoiceController.getInvoiceIds(signer1.address)).map(id => id.toNumber())
    const signer2Ids = (await contracts.invoiceController.getInvoiceIds(signer2.address)).map(id => id.toNumber())

    expect(signer1Ids).to.eql([1,3])
    expect(signer2Ids).to.eql([2])
  })

  it('Logs InvoiceCreated', async function () {
    const invoiceCreation = createInvoice(signer1, params, fee)
    await expect(invoiceCreation).to.emit(contracts.logger, 'InvoiceCreated')
  })

  describe('ETH fee', function () {
    it('Increases ETH balance of contract', async function () {
      let balance = await ethers.provider.getBalance(contracts.invoiceController.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))
      expect(balance).to.equal(0)

      await createInvoice(signer1, params, fee)
      balance = await ethers.provider.getBalance(contracts.invoiceController.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

      expect(balance).to.equal(0.05)
    })

    it('Fails if msg.value less than fee', async function () {
      try {
        let lowFee = ethers.utils.parseUnits('0.01', 'ether')
        await createInvoice(signer1, params, lowFee)
      } catch (error) {
        expect(error.message).to.include('Fee to low')
      }
    })

    it('Passes if msg.value more than fee', async function () {
      let highFee = ethers.utils.parseUnits('0.07', 'ether')
      await createInvoice(signer1, params, highFee)

      let balance = await ethers.provider.getBalance(contracts.invoiceController.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

      expect(balance).to.equal(0.07)
    })

    it('Increases creators IBT balance as reward', async function () {
      await createInvoice(signer1, params, fee)

      let balance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

      expect(balance).to.equal(0.025)
    })

    it('Increases creators IBT balance relative to amount not provided fee', async function () {
      let highFee = ethers.utils.parseUnits('0.07', 'ether')
      await createInvoice(signer1, params, highFee)

      let balance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

      expect(balance).to.equal(0.025)
    })
  })

  describe('IBT fee', function () {
    beforeEach(async function () {
      await contracts.invoiceBuildToken.mint(signer1.address, ethers.utils.parseUnits('10', 'ether'))
      await contracts.invoiceBuildToken.mint(signer2.address, ethers.utils.parseUnits('0.01', 'ether'))
    })

    it('Mints IBT for signer', async function () {
      let balance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

      expect(balance).to.equal(10)
    })

    it('Increases IBT balance of contract', async function () {
      let noFee = ethers.utils.parseUnits('0', 'ether')
      await createInvoice(signer1, params, noFee)

      let contractBalance = await contracts.invoiceBuildToken.balanceOf(contracts.invoiceController.address)
      contractBalance = parseFloat(ethers.utils.formatUnits(contractBalance, 'ether'))
      expect(contractBalance).to.equal(0.05)

      let creatorBalance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
      creatorBalance = parseFloat(ethers.utils.formatUnits(creatorBalance, 'ether'))
      expect(creatorBalance).to.equal(9.95)
    })

    it('Fails if sender IBT balance less than fee', async function () {
      try {
        let noFee = ethers.utils.parseUnits('0', 'ether')
        await createInvoice(signer2, params, noFee)
      } catch (error) {
        expect(error.message).to.include('amount exceeds balance')
      } 
    })

    it('Does not mint IBT as creation reward', async function () {
      let noFee = ethers.utils.parseUnits('0', 'ether')
      await createInvoice(signer1, params, noFee)

      let balance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

      expect(balance).to.equal(9.95)
    })
  })
})
