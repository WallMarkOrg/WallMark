'use client'

import Link                    from 'next/link'
import { ConnectButton }       from '@rainbow-me/rainbowkit'
import { useAccount }          from 'wagmi'
import { usePathname }         from 'next/navigation'
import { LayoutDashboard, Map, Plus } from 'lucide-react'
import { cn }                  from '@/lib/utils'

export function Navbar() {
  const { isConnected } = useAccount()
  const pathname        = usePathname()

  const links = [
    { href: '/',          label: 'Map',       icon: Map             },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16
                        bg-[#0a0a0f]/80 backdrop-blur-md
                        border-b border-surface-border">
      <div className="page-container h-full flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/40
                          flex items-center justify-center
                          group-hover:bg-brand/30 transition-colors">
            <span className="text-brand font-bold text-sm">W</span>
          </div>
          <span className="font-bold text-slate-100 text-lg tracking-tight">
            Wall<span className="text-brand">ad</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-raised'
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isConnected && (
            <Link href="/walls/new" className="btn-primary text-sm py-2 px-4">
              <Plus size={15} />
              List Wall
            </Link>
          )}
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="avatar"
          />
        </div>
      </div>
    </header>
  )
}
