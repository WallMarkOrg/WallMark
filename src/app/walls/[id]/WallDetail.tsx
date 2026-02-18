'use client'

import Link             from 'next/link'
import { useAccount }   from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { MapPin, Maximize2, Star, Calendar, Wallet, Shield, Clock } from 'lucide-react'
import type { Wall }    from '@/types'
import { ipfsImageUrl } from '@/lib/ipfs'
import { VISIBILITY_MULTIPLIERS } from '@/lib/pricing'
import { shortenAddress } from '@/lib/utils'
import { useState }     from 'react'

interface WallDetailProps { wall: Wall }

export function WallDetail({ wall }: WallDetailProps) {
  const { isConnected, address } = useAccount()
  const [imgIdx, setImgIdx]      = useState(0)

  const visInfo = VISIBILITY_MULTIPLIERS[wall.visibilityTier]
  const photos  = wall.photoCids?.length
    ? wall.photoCids
    : [wall.referencePhotoCid].filter(Boolean) as string[]

  const isOwner = address?.toLowerCase() === wall.ownerAddress?.toLowerCase()

  return (
    <div className="page-container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: photos + info ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Gallery */}
          <div className="rounded-xl overflow-hidden bg-surface-raised border border-surface-border">
            <img
              src={photos[imgIdx] ? ipfsImageUrl(photos[imgIdx]) : '/placeholder-wall.jpg'}
              alt={wall.title}
              className="w-full h-80 object-cover"
              onError={e => { (e.target as HTMLImageElement).src = '/placeholder-wall.jpg' }}
            />
            {photos.length > 1 && (
              <div className="flex gap-2 p-3">
                {photos.map((cid, i) => (
                  <button
                    key={cid}
                    onClick={() => setImgIdx(i)}
                    className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === imgIdx ? 'border-brand' : 'border-surface-border'
                    }`}
                  >
                    <img
                      src={ipfsImageUrl(cid)}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="card space-y-5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-2xl font-bold text-slate-100">{wall.title}</h1>
                <span className={`badge mt-1 ${
                  wall.status === 'ACTIVE'
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-slate-400 bg-slate-400/10'
                }`}>
                  {wall.status}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-slate-500 mt-1">
                <MapPin size={14} />
                {wall.addressText}, {wall.city}, {wall.country}
              </p>
            </div>

            {wall.description && (
              <p className="text-slate-400 text-sm leading-relaxed">{wall.description}</p>
            )}

            {/* Specs grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {wall.areaSqft && (
                <div className="bg-surface-raised rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Total Area</div>
                  <div className="font-bold text-slate-100">{wall.areaSqft} sqft</div>
                  {wall.widthFt && wall.heightFt && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      {wall.widthFt}′ × {wall.heightFt}′
                    </div>
                  )}
                </div>
              )}

              <div className="bg-surface-raised rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Price / sqft / day</div>
                <div className="font-bold text-brand">{wall.pricePerSqftDay} BNB</div>
              </div>

              <div className="bg-surface-raised rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Visibility</div>
                <div className="font-bold text-slate-100">Tier {wall.visibilityTier}</div>
                <div className="text-xs text-slate-600">{visInfo?.mult}× multiplier</div>
              </div>

              <div className="bg-surface-raised rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Owner</div>
                <div className="font-mono text-xs text-slate-300">
                  {shortenAddress(wall.ownerAddress ?? '')}
                </div>
              </div>
            </div>

            {/* Visibility description */}
            <div className="flex items-start gap-3 p-3 bg-brand/5 border border-brand/20 rounded-lg">
              <Star size={16} className="text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-300">Visibility Score</p>
                <p className="text-sm text-slate-500">{visInfo?.label}</p>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-surface-border">
              {[
                { icon: Shield, text: 'Funds held in escrow — no trust required' },
                { icon: Clock,  text: '7-day dispute window after installation' },
                { icon: Wallet, text: 'Pay & approve on BNB Chain' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2">
                  <Icon size={14} className="text-brand shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: booking panel ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card sticky top-24">
            <h2 className="font-bold text-lg text-slate-100 mb-4">Book This Wall</h2>

            {wall.status !== 'ACTIVE' ? (
              <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
                <p className="text-sm text-yellow-400">
                  This wall is currently {wall.status.toLowerCase().replace('_', ' ')}.
                  Check back later.
                </p>
              </div>
            ) : !isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Connect your wallet to book this wall.
                </p>
                <ConnectButton />
              </div>
            ) : isOwner ? (
              <div className="p-4 bg-surface-raised rounded-lg text-sm text-slate-400">
                You own this wall. Wait for advertiser bookings.
              </div>
            ) : (
              <div className="space-y-4">
                {wall.areaSqft ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-500">Estimated daily cost</p>
                      <p className="text-2xl font-bold text-brand">
                        {(Number(wall.pricePerSqftDay) * wall.areaSqft * (VISIBILITY_MULTIPLIERS[wall.visibilityTier]?.mult || 1)).toFixed(6)} BNB
                        <span className="text-sm font-normal text-slate-500"> /day</span>
                      </p>
                    </div>

                    <Link
                      href={`/book/${wall.id}`}
                      className="btn-primary w-full justify-center text-sm py-3"
                    >
                      <Calendar size={16} />
                      Select Dates & Book
                    </Link>
                  </>
                ) : (
                  <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      Wall dimensions not yet verified. Cannot calculate price.
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-600 text-center">
                  No charges until you confirm payment on-chain
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
