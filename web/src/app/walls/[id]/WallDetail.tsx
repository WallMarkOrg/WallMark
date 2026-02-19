'use client'

import Link             from 'next/link'
import { useAccount }   from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { MapPin, Maximize2, Star, Calendar, Wallet, Shield, Clock, Info } from 'lucide-react'
import type { Wall }    from '@/types'
import { ipfsImageUrl } from '@/lib/ipfs'
import { VISIBILITY_MULTIPLIERS } from '@/lib/pricing'
import { shortenAddress } from '@/lib/utils'
import { useState }     from 'react'
import { useBnbPrice }  from '@/hooks/useBnbPrice'

interface WallDetailProps { wall: any } // Accommodating aggregated rating fields

export function WallDetail({ wall }: WallDetailProps) {
  const { isConnected, address } = useAccount()
  const { convert } = useBnbPrice()
  const [imgIdx, setImgIdx]      = useState(0)

  const visInfo = VISIBILITY_MULTIPLIERS[wall.visibilityTier]
  const photos  = wall.photoCids?.length
    ? wall.photoCids
    : [wall.referencePhotoCid].filter(Boolean) as string[]

  const isOwner = address?.toLowerCase() === wall.ownerAddress?.toLowerCase()

  // Calculate daily cost including the visibility multiplier
  const dailyBnb = Number(wall.pricePerSqftDay) * (wall.areaSqft || 0) * (visInfo?.mult || 1)
  
  // Rating placeholder (or real data if available)
  const displayRating = wall.avgRating ? wall.avgRating.toFixed(1) : 'New'

  return (
    <div className="page-container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: photos + info ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Gallery */}
          <div className="rounded-xl overflow-hidden bg-surface-raised border border-surface-border group relative">
            <img
              src={photos[imgIdx] ? ipfsImageUrl(photos[imgIdx]) : '/placeholder-wall.jpg'}
              alt={wall.title}
              className="w-full h-[400px] object-cover transition-transform duration-500"
              onError={e => { (e.target as HTMLImageElement).src = '/placeholder-wall.jpg' }}
            />
            
            {/* Tier & Rating Badges on Image */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
              <div className="bg-brand text-black px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest shadow-2xl">
                Tier {wall.visibilityTier}
              </div>
              <div className="bg-black/80 backdrop-blur-md rounded-md px-3 py-1 text-sm text-yellow-400 font-bold shadow-2xl flex items-center gap-1">
                <Star size={14} className="fill-yellow-400" /> {displayRating}
              </div>
            </div>

            {photos.length > 1 && (
              <div className="flex gap-2 p-3 bg-black/40 backdrop-blur-sm absolute bottom-0 inset-x-0 overflow-x-auto">
                {photos.map((cid:any , i:any) => (
                  <button
                    key={cid}
                    onClick={() => setImgIdx(i)}
                    className={`w-20 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      i === imgIdx ? 'border-brand scale-105 shadow-lg' : 'border-white/20 opacity-70 hover:opacity-100'
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
          <div className="card space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">{wall.title}</h1>
                    <p className="flex items-center gap-1.5 text-slate-500 mt-2">
                        <MapPin size={16} className="text-brand" />
                        {wall.addressText}, {wall.city}, {wall.country}
                    </p>
                </div>
                <span className={`badge py-1.5 px-4 text-xs font-bold tracking-widest ${
                  wall.status === 'ACTIVE'
                    ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20'
                    : 'text-slate-400 bg-slate-400/10 border border-slate-400/20'
                }`}>
                  {wall.status}
                </span>
              </div>
            </div>

            {wall.description && (
              <p className="text-slate-400 text-base leading-relaxed border-l-2 border-surface-border pl-4">
                {wall.description}
              </p>
            )}

            {/* Specs grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {wall.areaSqft && (
                <div className="bg-surface-raised rounded-xl p-4 border border-surface-border">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Total Area</div>
                  <div className="font-bold text-slate-100 text-lg">{wall.areaSqft} <span className="text-xs font-normal text-slate-500 text-xs">sqft</span></div>
                  {wall.widthFt && wall.heightFt && (
                    <div className="text-[10px] text-slate-600 mt-1 font-mono">
                      {wall.widthFt}′ × {wall.heightFt}′
                    </div>
                  )}
                </div>
              )}

              <div className="bg-surface-raised rounded-xl p-4 border border-surface-border">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Rate / sqft</div>
                <div className="font-bold text-brand text-lg">{wall.pricePerSqftDay} <span className="text-xs">BNB</span></div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">
                  ≈ {convert(wall.pricePerSqftDay)}
                </div>
              </div>

              <div className="bg-surface-raised rounded-xl p-4 border border-surface-border">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Visibility</div>
                <div className="font-bold text-slate-100 text-lg">Tier {wall.visibilityTier}</div>
                <div className="text-[10px] text-slate-600 mt-1 uppercase font-bold">{visInfo?.mult}× Mult.</div>
              </div>

              <div className="bg-surface-raised rounded-xl p-4 border border-surface-border">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Owner</div>
                <div className="font-mono text-xs text-slate-300 break-all mt-1 bg-black/20 p-1 rounded">
                  {shortenAddress(wall.ownerAddress ?? '')}
                </div>
              </div>
            </div>

            {/* Visibility detailed info */}
            <div className="flex items-start gap-4 p-4 bg-brand/5 border border-brand/20 rounded-xl">
              <div className="bg-brand/20 p-2 rounded-lg">
                <Info size={20} className="text-brand shrink-0" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200 uppercase tracking-tight">Visibility & Traffic Score</p>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{visInfo?.label}</p>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-surface-border">
              {[
                { icon: Shield, title: 'Escrow Protected', text: 'Funds held by contract' },
                { icon: Clock,  title: '7-Day Review', text: 'Window for dispute' },
                { icon: Wallet, title: 'Safe Payouts', text: 'Release on approval' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-brand" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 ml-6">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: booking panel ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card sticky top-24 border-brand/20 shadow-xl shadow-brand/5">
            <h2 className="font-bold text-xl text-slate-100 mb-6 flex items-center gap-2">
                <Calendar size={20} className="text-brand" />
                Book Campaign
            </h2>

            {wall.status !== 'ACTIVE' ? (
              <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                <p className="text-sm text-yellow-400 font-medium">
                  This wall is currently {wall.status.toLowerCase().replace('_', ' ')}.
                </p>
              </div>
            ) : !isConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Connect your wallet to reserve dates and fund the campaign escrow.
                </p>
                <div className="flex justify-center">
                    <ConnectButton />
                </div>
              </div>
            ) : isOwner ? (
              <div className="p-4 bg-surface-raised rounded-xl text-sm text-slate-400 border border-surface-border">
                You are the owner of this listing.
              </div>
            ) : (
              <div className="space-y-6">
                {wall.areaSqft ? (
                  <>
                    <div className="p-4 bg-surface-raised rounded-xl border border-surface-border space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Est. Daily Cost</p>
                      <p className="text-3xl font-black text-brand">
                        {dailyBnb.toFixed(6)} <span className="text-xs font-bold text-slate-400">BNB</span>
                      </p>
                      <p className="text-sm font-bold text-slate-300">
                        ≈ {convert(dailyBnb)} <span className="text-[10px] text-slate-500 uppercase">USD</span>
                      </p>
                    </div>

                    <Link
                      href={`/book/${wall.id}`}
                      className="btn-primary w-full justify-center text-sm py-4 shadow-lg shadow-brand/20"
                    >
                      <Calendar size={18} />
                      Select Dates & Book
                    </Link>
                  </>
                ) : (
                  <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                    <p className="text-xs text-yellow-400 leading-relaxed font-medium">
                      Wall dimensions are pending verification. Price estimation is currently unavailable.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center">
                        <Shield size={12} /> 100% Trustless Escrow
                    </div>
                    <p className="text-[10px] text-slate-600 text-center px-4">
                      Your funds are locked in the smart contract. Wall owners only get paid once you approve the proof of installation.
                    </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}