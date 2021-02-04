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
})
