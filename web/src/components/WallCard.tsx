'use client'

import Link                  from 'next/link'
import { MapPin, Maximize2, Star } from 'lucide-react'
import { Wall }              from '@/types'
import { ipfsImageUrl }      from '@/lib/ipfs'
import { cn }                from '@/lib/utils'

interface WallCardProps {
  wall: any // Use any temporarily to avoid type errors with avgRating
  compact?: boolean
}

export function WallCard({ wall, compact = false }: WallCardProps) {
  const imgSrc = wall.photoCids?.[0]
    ? ipfsImageUrl(wall.photoCids[0])
    : '/placeholder-wall.jpg'

  // Average rating logic (if you add avgRating to your wall fetch later)
  const displayRating = wall.avgRating ? `⭐ ${wall.avgRating.toFixed(1)}` : '⭐ New'

  return (
    <Link
      href={`/walls/${wall.id}`}
      className="group block card hover:border-brand/40 hover:shadow-lg
                 hover:shadow-brand/5 transition-all duration-200 p-0 overflow-hidden"
    >
      <div className={cn('relative overflow-hidden bg-surface-raised', compact ? 'h-32' : 'h-44')}>
        <img
          src={imgSrc}
          alt={wall.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-wall.jpg' }}
        />
        
        {/* Visibility Tier & Rating Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <div className="bg-brand text-black px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter shadow-lg">
            Tier {wall.visibilityTier}
          </div>
          <div className="bg-black/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-[11px] text-yellow-400 font-bold shadow-lg">
            {displayRating}
          </div>
        </div>

        {wall.status !== 'ACTIVE' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {wall.status.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-100 truncate group-hover:text-brand transition-colors">
          {wall.title}
        </h3>
        <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{wall.city}, {wall.country}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-brand font-bold text-sm">{wall.pricePerSqftDay} BNB</span>
            <span className="text-slate-600 text-xs"> /sqft/day</span>
          </div>
        </div>
      </div>
    </Link>
  )
}