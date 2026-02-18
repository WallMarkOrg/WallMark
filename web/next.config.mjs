/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: '*.mypinata.cloud' },
    ],
  },
  webpack: (config) => {
    // Required for wagmi/viem in Next.js
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    // Stub out react-native module pulled in by @metamask/sdk
    config.resolve.alias['@react-native-async-storage/async-storage'] = false
    return config
  },
}

export default nextConfig
