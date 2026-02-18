'use client'

import { useState, useEffect }  from 'react'
import { useAccount }            from 'wagmi'
import { ConnectButton }         from '@rainbow-me/rainbowkit'
import { WallCard }              from '@/components/WallCard'
import { BookingStatus }         from '@/components/BookingStatus'
import type { Wall, Booking }    from '@/types'
import { STATUS_COLORS, STATUS_LABELS } from '@/types'
import { ipfsImageUrl }          from '@/lib/ipfs'
import { EXPLORER_BASE }         from '@/lib/contract'
import { Loader2, Wallet, Building, Package, ExternalLink, ArrowRight } from 'lucide-react'
import Link                      from 'next/link'
import { cn }                    from '@/lib/utils'

type Tab = 'my-walls' | 'my-bookings' | 'my-installs'

export default function DashboardPage() {
  const { address, isConnected } = useAccount()

  const [tab,        setTab]        = useState<Tab>('my-bookings')
  const [walls,      setWalls]      = useState<Wall[]>([])
  const [bookings,   setBookings]   = useState<Booking[]>([])
  const [installs,   setInstalls]   = useState<Booking[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)

    Promise.all([
      fetch(`/api/walls?ownerAddress=${address}`).then(r => r.json()),
      fetch(`/api/bookings?advertiserAddress=${address}`).then(r => r.json()),
      fetch(`/api/bookings?installerAddress=${address}`).then(r => r.json()),
    ]).then(([wallData, bookData, installData]) => {
      setWalls(Array.isArray(wallData) ? wallData : wallData.walls || [])
      setBookings(Array.isArray(bookData) ? bookData : bookData.bookings || [])
      setInstalls(Array.isArray(installData) ? installData : installData.bookings || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div className="page-container py-24 flex flex-col items-center gap-6">
        <Wallet size={48} className="text-slate-600" />
        <div className="text-center">
          <h1 className="section-title">Dashboard</h1>
          <p className="text-slate-500 mt-2">Connect your wallet to view your activity</p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  const tabs = [
    { id: 'my-bookings' as Tab, label: 'My Bookings',    icon: Package,  count: bookings.length  },
    { id: 'my-walls'    as Tab, label: 'My Walls',        icon: Building, count: walls.length     },
    { id: 'my-installs' as Tab, label: 'My Installs',     icon: Package,  count: installs.length  },
  ]

  return (
    <div className="page-container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </p>
        </div>
        <Link href="/walls/new" className="btn-primary text-sm">
          List a Wall
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-surface-border mb-6 w-fit">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id
                ? 'bg-brand text-black'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Icon size={14} />
            {label}
            {count > 0 && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                tab === id ? 'bg-black/20' : 'bg-surface-raised'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand" size={28} />
        </div>
      ) : (
        <>
          {/* ── My Bookings ─────────────────────────────────────── */}
          {tab === 'my-bookings' && (
            <div className="space-y-4">
              {bookings.length === 0 ? (
                <EmptyState
                  message="No bookings yet"
                  sub="Browse the map and book your first wall"
                  cta={{ label: 'Browse Walls', href: '/' }}
                />
              ) : (
                bookings.map(b => <BookingCard key={b.id} booking={b} role="advertiser" />)
              )}
            </div>
          )}

          {/* ── My Walls ────────────────────────────────────────── */}
          {tab === 'my-walls' && (
            <div className="space-y-4">
              {walls.length === 0 ? (
                <EmptyState
                  message="No walls listed"
                  sub="List your wall to start earning BNB"
                  cta={{ label: 'List a Wall', href: '/walls/new' }}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {walls.map(w => <WallCard key={w.id} wall={w} />)}
                </div>
              )}
            </div>
          )}

          {/* ── My Installs ─────────────────────────────────────── */}
          {tab === 'my-installs' && (
            <div className="space-y-4">
              {installs.length === 0 ? (
                <EmptyState
                  message="No installation jobs yet"
                  sub="You'll appear here when assigned as installer for a booking"
                />
              ) : (
                installs.map(b => <BookingCard key={b.id} booking={b} role="installer" />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Booking card ──────────────────────────────────────────────────────────

function BookingCard({ booking, role }: { booking: Booking; role: 'advertiser' | 'installer' }) {
  const actionHref =
    role === 'installer' && booking.status === 'FUNDED'
      ? `/installer/${booking.id}`
      : booking.status === 'PROOF_SUBMITTED'
      ? `/review/${booking.id}`
      : `/review/${booking.id}`

  const actionLabel =
    role === 'installer' && booking.status === 'FUNDED'
      ? 'Submit Proof'
      : booking.status === 'PROOF_SUBMITTED' && role === 'advertiser'
      ? 'Review Proof'
      : 'View Details'

  const actionHighlight =
    (role === 'installer' && booking.status === 'FUNDED') ||
    (role === 'advertiser' && booking.status === 'PROOF_SUBMITTED')

  return (
    <div className="card flex flex-col sm:flex-row gap-4">
      {/* Wall thumbnail */}
      <div className="w-full sm:w-24 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-raised">
        <img
          src={booking.wall.photoCids?.[0] ? ipfsImageUrl(booking.wall.photoCids[0]) : '/placeholder-wall.jpg'}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = '/placeholder-wall.jpg' }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-100 truncate">{booking.wall.title}</p>
            <p className="text-xs text-slate-500">{booking.wall.city} · {new Date(booking.startDate).toLocaleDateString()} – {new Date(booking.endDate).toLocaleDateString()}</p>
          </div>
          <span className={cn('badge shrink-0 text-xs', STATUS_COLORS[booking.status])}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="text-brand font-mono font-semibold">{booking.totalBnb} BNB</span>
          {booking.txHashFund && (
            <a
              href={`${EXPLORER_BASE}/tx/${booking.txHashFund}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1 hover:text-brand"
            >
              Escrow tx <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center">
        <Link
          href={actionHref}
          className={cn(
            'text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors',
            actionHighlight
              ? 'bg-brand text-black hover:bg-brand-dim'
              : 'bg-surface-raised text-slate-400 hover:text-slate-200 border border-surface-border'
          )}
        >
          {actionLabel} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyState({
  message, sub, cta,
}: {
  message: string
  sub:     string
  cta?:    { label: string; href: string }
}) {
  return (
    <div className="card py-16 text-center space-y-3">
      <p className="text-slate-400 font-medium">{message}</p>
      <p className="text-sm text-slate-600">{sub}</p>
      {cta && (
        <Link href={cta.href} className="btn-primary inline-flex mt-2">
          {cta.label}
        </Link>
      )}
    </div>
  )
}
