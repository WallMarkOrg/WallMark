import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-verify'
import * as dotenv from 'dotenv'

dotenv.config()

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '0'.repeat(64)
const BSC_TESTNET_RPC =
  process.env.BSC_TESTNET_RPC ||
  'https://data-seed-prebsc-1-s1.binance.org:8545/'
const BSC_MAINNET_RPC =
  process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org/'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC,
      chainId: 97,
      gasPrice: 10_000_000_000, // 10 gwei
      accounts: [PRIVATE_KEY],
    },
    bscMainnet: {
      url: BSC_MAINNET_RPC,
      chainId: 56,
      gasPrice: 3_000_000_000, // 3 gwei
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'bscTestnet',
        chainId: 97,
        urls: {
          apiURL: 'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    token: 'BNB',
  },
  mocha: {
    timeout: 60_000,
  },
}

export default config
