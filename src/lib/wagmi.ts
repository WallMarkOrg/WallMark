'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { bsc, bscTestnet } from 'wagmi/chains'
import { defineChain } from 'viem'

// BNB Chain Testnet with fallback RPCs
export const bscTestnetChain = defineChain({
  ...bscTestnet,
  rpcUrls: {
    default: {
      http: [
        'https://data-seed-prebsc-1-s1.binance.org:8545/',
        'https://data-seed-prebsc-2-s1.binance.org:8545/',
        'https://data-seed-prebsc-1-s2.binance.org:8545/',
      ],
    },
    public: {
      http: [
        'https://data-seed-prebsc-1-s1.binance.org:8545/',
      ],
    },
  },
})

const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'wallad-dev-placeholder'

export const wagmiConfig = getDefaultConfig({
  appName:     'Wallad — Physical Wall Ad Marketplace',
  projectId:   WC_PROJECT_ID,
  chains:      [bscTestnetChain, bsc],
  ssr:         true,
})

export { bsc, bscTestnet }
