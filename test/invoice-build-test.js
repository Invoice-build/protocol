const { expect } = require('chai')

describe('InvoiceBuild contract', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, recipient2

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1, recipient2] = await ethers.getSigners()
    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()
  })

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await invoiceBuild.owner()).to.equal(owner.address)
    })
  })

  describe('Minting', function () {
    let amount, metaUrl

    beforeEach(async function () {
      amount = ethers.utils.parseUnits('1000', 'ether')
      metaUrl = 'https://invoice.build'

      await invoiceBuild.connect(signer1).create(amount, recipient1.address, metaUrl)
    })

    it('Should be owned by signer', async function () {
      expect(await invoiceBuild.ownerOf(1)).to.equal(signer1.address)
    })

    it('Should have correct tokenURI', async function () {
      expect(await invoiceBuild.tokenURI(1)).to.equal(metaUrl)
    })

    it('should have unique tokenURIs', async function () {
      const metaUrl2 = 'https://invoice.build/2'
      await invoiceBuild.connect(signer2).create(amount, recipient2.address, metaUrl2)
      expect(await invoiceBuild.tokenURI(1)).to.equal(metaUrl)
      expect(await invoiceBuild.tokenURI(2)).to.equal(metaUrl2)
    })

    it('Should add id to owners invoice map', async function () {
      await invoiceBuild.connect(signer2).create('5000', recipient2.address, metaUrl)
      await invoiceBuild.connect(signer1).create('3000', recipient1.address, metaUrl)
      const ids = (await invoiceBuild.invoicesForOwner(signer1.address)).map(id => id.toNumber())
      expect(ids).to.eql([1,3])
    })

    it('Increments total supply', async function () {
      await invoiceBuild.connect(signer2).create('5000', recipient2.address, metaUrl)
      const totalSupply = (await invoiceBuild.connect(owner).totalSupply()).toNumber()
      expect(totalSupply).to.equal(2)
    })

    it('Returns number of invoices owned', async function () {
      await invoiceBuild.connect(signer1).create('5000', recipient1.address, metaUrl)
      await invoiceBuild.connect(signer2).create('3000', recipient2.address, metaUrl)
      const count1 = (await invoiceBuild.connect(owner).balanceOf(signer1.address)).toNumber()
      const count2 = (await invoiceBuild.connect(owner).balanceOf(signer2.address)).toNumber()
      expect(count1).to.equal(2)
      expect(count2).to.equal(1)
    })

    it('Returns oustanding amount for token', async function () {
      let outstanding = await invoiceBuild.invoiceOutstanding(1)
      outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))
      expect(outstanding).to.equal(1000.0)
    })

    it('Returns withdrawable balance for token', async function () {
      let balance = await invoiceBuild.invoiceBalance(1)
      balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))
      expect(balance).to.equal(0.0)
    })

    it('Returns amount for token', async function () {
      let amount = await invoiceBuild.invoiceAmount(1)
      amount = parseFloat(ethers.utils.formatUnits(amount, 'ether'))
      expect(amount).to.equal(1000.0)
    })

    it('Prevents negative or zero amount invoice', async function () {
      try {
        await invoiceBuild.connect(signer1).create('0', recipient1.address, metaUrl)
      } catch (error) {
        expect(error.message).to.include('Amount too low')
      }
    })
  })

  describe('Payments', function () {
    let amount, metaUrl

    beforeEach(async function () {
      amount = ethers.utils.parseUnits('1000', 'ether')
      metaUrl = 'https://invoice.build'

      await invoiceBuild.connect(signer1).create(amount, recipient1.address, metaUrl)
    })

    it('Reduces invoice outstanding', async function () {
      const value = ethers.utils.parseUnits('150.5', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })

      let outstanding = await invoiceBuild.invoiceOutstanding(1)
      outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))

      expect(outstanding).to.equal(849.5)
    })

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
  })

  describe('Withdrawals', function () {
    let amount, metaUrl

    beforeEach(async function () {
      amount = ethers.utils.parseUnits('1000', 'ether')
      metaUrl = 'https://invoice.build'
    })

    it('Fails if not owner', async function () {
      await invoiceBuild.connect(signer1).create(amount, recipient1.address, metaUrl)
      const value = ethers.utils.parseUnits('1000', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })

      try {
        await invoiceBuild.connect(signer2).withdrawBalance(1)
      } catch (error) {
        expect(error.message).to.include('not the owner')
      }
    })

    it('Fails if nothing to withdraw', async function () {
      await invoiceBuild.connect(signer1).create(amount, recipient1.address, metaUrl)

      try {
        await invoiceBuild.connect(signer1).withdrawBalance(1)
      } catch (error) {
        expect(error.message).to.include('Nothing to withdraw')
      }
    })

    it('Fails if already fully withdrawn', async function () {
      await invoiceBuild.connect(signer1).create(amount, recipient1.address, metaUrl)
      const value = ethers.utils.parseUnits('1000', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })
      await invoiceBuild.connect(signer1).withdrawBalance(1)

      try {
        await invoiceBuild.connect(signer1).withdrawBalance(1)
      } catch (error) {
        expect(error.message).to.include('Nothing to withdraw')
      }
    })

    it('Increases balance of recipient', async function () {
      let startinBalance = await ethers.provider.getBalance(recipient1.address)
      startinBalance = parseFloat(ethers.utils.formatUnits(startinBalance, 'ether'))
      await invoiceBuild.connect(signer1).create(amount, recipient1.address, metaUrl)
      const value = ethers.utils.parseUnits('500', 'ether').toHexString()
      await invoiceBuild.connect(signer2).makePayment(1, { value })
      await invoiceBuild.connect(signer1).withdrawBalance(1)
      let newBalance = await ethers.provider.getBalance(recipient1.address)
      newBalance = parseFloat(ethers.utils.formatUnits(newBalance, 'ether'))
      
      expect(newBalance - startinBalance).to.equal(500.0)
    })
  })
})
