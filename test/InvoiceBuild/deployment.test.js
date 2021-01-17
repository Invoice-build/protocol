const { expect } = require('chai')

describe('InvoiceBuild deployment', function() {
  let InvoiceBuild, invoiceBuild, owner

  beforeEach(async function () {
    [owner] = await ethers.getSigners()
    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()
  })

  it('Should set the right owner', async function () {
    expect(await invoiceBuild.owner()).to.equal(owner.address)
  })
})
