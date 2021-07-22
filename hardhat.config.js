
require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-etherscan')
require('hardhat-contract-sizer')
require('@nomiclabs/hardhat-solhint')
require('hardhat-abi-exporter')
require('solidity-coverage')

const { EXPLORER_API_KEY, STAGING_CONFIG, PRODUCTION_CONFIG } = require('../.env.json')

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      live: false,
      saveDeployments: true,
      chainId: 1337,
      tags: ['local']
    },
    hardhat: {
      chainId: 1337
    },
    staging: {
      url: STAGING_CONFIG.RPC_ENDPOINT,
      chainId: STAGING_CONFIG.CHAIN_ID,
      gasPrice: STAGING_CONFIG.GAS_PRICE,
      accounts: [STAGING_CONFIG.PRIVATE_KEY],
      tags: ['staging']
    },
    mainnet: {
      url: PRODUCTION_CONFIG.RPC_ENDPOINT,
      chainId: PRODUCTION_CONFIG.CHAIN_ID,
      gasPrice: PRODUCTION_CONFIG.GAS_PRICE,
      accounts: [PRODUCTION_CONFIG.PRIVATE_KEY]
    }
  },
  solidity: {
    version: '0.8.0',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  mocha: {
    timeout: 20000
  },
  etherscan: {
    apiKey: EXPLORER_API_KEY
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false
  },
  abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
    only: [],
    spacing: 2
  }
}
