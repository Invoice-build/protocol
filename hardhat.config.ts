import 'dotenv/config'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import 'solidity-coverage'
import { HardhatUserConfig } from 'hardhat/types'

// Load tasks
import tasks from './tasks'
for (const tsk of tasks) { tsk() }

let mnemonic = process.env.MNEMONIC
if (!mnemonic) {
  // FOR DEV ONLY, SET IT IN .env files if you want to keep it private
  // (IT IS IMPORTANT TO HAVE A NON RANDOM MNEMONIC SO THAT SCRIPTS CAN ACT ON THE SAME ACCOUNTS)
  mnemonic = 'test test test test test test test test test test test junk'
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.7.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      /*
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      */
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_TOKEN}`,
      accounts: { mnemonic }
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_TOKEN}`,
      accounts: { mnemonic }
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_TOKEN}`,
      accounts: { mnemonic }
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_TOKEN}`,
      accounts: { mnemonic }
    },
    xdai: {
      url: 'https://dai.poa.network',
      chainId: 100,
      gas: 5e5,
      gasPrice: 3e9,
      accounts: { mnemonic }
    }
  }
}

export default config

