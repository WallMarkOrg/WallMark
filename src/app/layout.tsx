import type { Metadata } from 'next'
import { Providers }      from './providers'
import { Navbar }         from '@/components/Navbar'
import './globals.css'

export const metadata: Metadata = {
  title:       'WallMark — Physical Wall Ad Marketplace',
  description: 'Rent physical walls for advertising with trustless BNB Chain escrow',
  keywords:    ['advertising', 'web3', 'bnb chain', 'physical ads', 'escrow'],
  openGraph: {
    title:       'WallMark',
    description: 'Trustless physical ad marketplace on BNB Chain',
    type:        'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-slate-100">
        <Providers>
          <Navbar />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
