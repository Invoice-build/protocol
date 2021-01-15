const { expect } = require("chai")

describe("InvoiceBuild", function() {
  it("Testing...", async function() {
    const [signer] = await ethers.getSigners();
    const InvoiceBuild = await ethers.getContractFactory("InvoiceBuild")
    const invoiceBuild = await InvoiceBuild.deploy()
    
    await invoiceBuild.deployed()

    await invoiceBuild.create('https://invoice.build')
    const owner = await invoiceBuild.ownerOf(1)
    expect(owner).to.equal(signer.address)

    // expect(await invoiceBuild.create('https://invoice.build')).to.equal("Hello, world!")

    // await greeter.setGreeting("Hola, mundo!")
    // expect(await greeter.greet()).to.equal("Hola, mundo!")
  })
})
