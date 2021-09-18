const { bn } = require('../support/utils/numbers');
const { expect } = require('chai')
const { deployProxySuite } = require('../support/deployment')
const InvoiceV1 = require('../../artifacts/contracts/InvoiceV1.sol/InvoiceV1.json')

const AMOUNT = 100;
const FEE_FRACTION = 0.0005; // 0.05%
const FEE = AMOUNT * FEE_FRACTION;

describe('InvoiceController #pay', function () {
  let contracts, owner, signer1, signer2, params, fee

  async function createInvoice(creator, attrs, value) {
    return await contracts.invoiceController.connect(creator).create(...Object.values(attrs), { value })
  }

  beforeEach(async function () {
    [owner, signer1, signer2] = await ethers.getSigners()
    contracts = await deployProxySuite()

    params = {
      amount: ethers.utils.parseUnits(AMOUNT.toString(), 'ether'),
      recipient: signer2.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }
    fee = ethers.utils.parseUnits(FEE.toString(), 'ether')

    await createInvoice(signer1, params, fee)
  })

  it('Fails if invoice doesnt exist', async function () {
    try {
      const paymentAmount = ethers.utils.parseUnits('10', 'ether')
      await contracts.invoiceController.connect(signer2).pay(2, { value: paymentAmount })
    } catch (error) {
      expect(error.message).to.include('Doesn\'t exist')
    }
  })

  it('Increases the invoice contract balance', async function () {
    const paymentAmount = ethers.utils.parseUnits('10', 'ether')
    await contracts.invoiceController.connect(signer2).pay(1, { value: paymentAmount })

    const invoiceAddress = await contracts.invoiceController.invoices(1)
    const balance = await ethers.provider.getBalance(invoiceAddress)
    expect(balance).to.equal(paymentAmount)
  })

  it('Mints a IBT reward for the payer', async function () {
    const paymentAmount = 10
    const paymentAmountWei = ethers.utils.parseUnits(paymentAmount.toString(), 'ether')
    await contracts.invoiceController.connect(signer2).pay(1, { value: paymentAmountWei })

    let balance = await contracts.invoiceBuildToken.balanceOf(signer2.address)
    balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))

    expectedReward = ((AMOUNT * FEE_FRACTION) / 4) / (AMOUNT / paymentAmount)
    expect(balance).to.equal(expectedReward)
  })

  it('Logs InvoicePayment', async function () {
    const paymentAmount = ethers.utils.parseUnits('10', 'ether')
    const payment = contracts.invoiceController.connect(signer2).pay(1, { value: paymentAmount })
    await expect(payment).to.emit(contracts.logger, 'InvoicePayment')
  })

  it('Prevents payment if already paid off', async function () {
    const paymentAmount = ethers.utils.parseUnits('10', 'ether')
    await contracts.invoiceController.connect(signer2).pay(1, { value: paymentAmount })

    try {
      await contracts.invoiceController.connect(signer2).pay(1, { value: paymentAmount })
    } catch (error) {
      expect(error.message).to.include('Already paid off')
    }
  })

  describe('Final payment', async function () {
    async function makeFinalPayment(id) {
      const paymentAmount = ethers.utils.parseUnits('100', 'ether')
      return contracts.invoiceController.connect(signer2).pay(id, { value: paymentAmount })
    }

    it('Logs InvoiceFinalized', async function() {
      const finalPayment = makeFinalPayment(1);
      await expect(finalPayment).to.emit(contracts.logger, 'InvoiceFinalized')
    })

    describe('Fess paid with ETH', async function () {
      it('Mints IBT reward for invoice owner', async function() {
        const initBalance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
  
        await makeFinalPayment(1);

        const balance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
        const expectedReward = ethers.utils.parseUnits((FEE / 4).toString(), 'ether')

        expect(bn(balance).sub(initBalance).toString()).to.equal(expectedReward)
      })
    })

    describe('Fess paid with IBT', async function () {
      beforeEach(async function () {
        await contracts.invoiceBuildToken.mint(signer1.address, ethers.utils.parseUnits('10', 'ether'))
      })

      it('Does not mint IBT reward for owner', async function () {
        let noFee = ethers.utils.parseUnits('0', 'ether')
        await createInvoice(signer1, params, noFee)

        const initBalance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
  
        await makeFinalPayment(2);

        const balance = await contracts.invoiceBuildToken.balanceOf(signer1.address)
        const expectedReward = ethers.utils.parseUnits('0', 'ether')

        expect(bn(balance).sub(initBalance).toString()).to.equal(expectedReward)
      })
    })
  })
})
