'use client'

import Link                  from 'next/link'
import { MapPin, Maximize2, Star } from 'lucide-react'
import { Wall }              from '@/types'
import { ipfsImageUrl }      from '@/lib/ipfs'
import { cn }                from '@/lib/utils'

interface WallCardProps {
  wall: Wall
  compact?: boolean
}

const TIER_STARS: Record<number, string> = {
  1: '★☆☆☆☆',
  2: '★★☆☆☆',
  3: '★★★☆☆',
  4: '★★★★☆',
  5: '★★★★★',
}

export function WallCard({ wall, compact = false }: WallCardProps) {
  const imgSrc = wall.photoCids?.[0]
    ? ipfsImageUrl(wall.photoCids[0])
    : '/placeholder-wall.jpg'

  return (
    <Link
      href={`/walls/${wall.id}`}
      className="group block card hover:border-brand/40 hover:shadow-lg
                 hover:shadow-brand/5 transition-all duration-200 p-0 overflow-hidden"
    >
      {/* Image */}
      <div className={cn('relative overflow-hidden bg-surface-raised', compact ? 'h-32' : 'h-44')}>
        <img
          src={imgSrc}
          alt={wall.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-wall.jpg' }}
        />
        {/* Visibility badge */}
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm
                        rounded-md px-2 py-0.5 text-xs text-yellow-400 font-mono">
          {TIER_STARS[wall.visibilityTier]}
        </div>
        {/* Status */}
        {wall.status !== 'ACTIVE' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {wall.status === 'PENDING_REVIEW' ? 'Under Review' : 'Suspended'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-100 truncate group-hover:text-brand transition-colors">
          {wall.title}
        </h3>

        <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{wall.city}, {wall.country}</span>
        </div>

        {!compact && wall.areaSqft && (
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Maximize2 size={11} />
            <span>{wall.areaSqft} sqft</span>
            {wall.widthFt && wall.heightFt && (
              <span className="text-slate-600">
                ({wall.widthFt}′ × {wall.heightFt}′)
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-brand font-bold text-sm">
              {wall.pricePerSqftDay} BNB
            </span>
            <span className="text-slate-600 text-xs"> /sqft/day</span>
          </div>
          {wall.areaSqft && (
            <span className="text-xs text-slate-600">
              ≈ {(Number(wall.pricePerSqftDay) * wall.areaSqft).toFixed(5)} BNB/day
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
