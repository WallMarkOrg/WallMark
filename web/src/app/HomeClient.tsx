'use client'

import { useState, useEffect } from 'react'
import { WallMap }             from '@/components/WallMap'
import { WallCard }            from '@/components/WallCard'
import type { Wall }           from '@/types'
import { Search, SlidersHorizontal, MapPin, Loader2 } from 'lucide-react'

export function HomeClient() {
  const [walls,      setWalls]      = useState<Wall[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [tierFilter, setTierFilter] = useState<number | null>(null)
  const [selected,   setSelected]   = useState<Wall | null>(null)

  useEffect(() => {
    fetch('/api/walls?status=ACTIVE')
      .then(r => r.json())
      .then(data => {
        setWalls(Array.isArray(data) ? data : data.walls || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = walls.filter(w => {
    const matchSearch = !search ||
      w.title.toLowerCase().includes(search.toLowerCase()) ||
      w.city.toLowerCase().includes(search.toLowerCase()) ||
      w.addressText.toLowerCase().includes(search.toLowerCase())
    const matchTier = tierFilter === null || w.visibilityTier === tierFilter
    return matchSearch && matchTier
  })

  return (
    <div className="flex h-[calc(100vh-64px)]">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-96 shrink-0 flex flex-col border-r border-surface-border
                      bg-surface overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-surface-border">
          <h1 className="font-bold text-lg text-slate-100">
            Wall<span className="text-brand">Mart</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Trustless physical ad marketplace on BNB Chain
          </p>

          {/* Search */}
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search city, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Visibility filter */}
          <div className="flex gap-1.5 mt-2">
            {[null, 1, 2, 3, 4, 5].map(tier => (
              <button
                key={tier ?? 'all'}
                onClick={() => setTierFilter(tier)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  tierFilter === tier
                    ? 'bg-brand text-black'
                    : 'bg-surface-raised text-slate-400 hover:text-slate-200'
                }`}
              >
                {tier === null ? 'All' : `T${tier}`}
              </button>
            ))}
            <span className="text-xs text-slate-600 self-center ml-1">Tier</span>
          </div>
        </div>

        {/* Wall list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-brand" size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <MapPin size={32} className="mx-auto mb-2 opacity-30" />
              <p>No walls found</p>
            </div>
          ) : (
            filtered.map(wall => (
              <div
                key={wall.id}
                onClick={() => setSelected(wall)}
                className={`rounded-xl border transition-colors cursor-pointer ${
                  selected?.id === wall.id
                    ? 'border-brand/60'
                    : 'border-transparent hover:border-surface-border'
                }`}
              >
                <WallCard wall={wall} compact />
              </div>
            ))
          )}
        </div>

        {/* Footer count */}
        <div className="p-3 border-t border-surface-border text-xs text-slate-600 text-center">
          {filtered.length} wall{filtered.length !== 1 ? 's' : ''} available
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <WallMap
          walls={filtered}
          selectedWallId={selected?.id}
          onWallClick={setSelected}
          center={
            filtered.length > 0
              ? [filtered[0].latitude, filtered[0].longitude]
              : [40.7128, -74.006]
          }
        />

        {/* Selected wall popup */}
        {selected && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10
                          w-80 card shadow-2xl shadow-black/60 animate-slide-up">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-100">{selected.title}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} />{selected.addressText}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-600 hover:text-slate-400 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <span className="text-brand font-bold">{selected.pricePerSqftDay} BNB</span>
                <span className="text-slate-600 text-xs"> /sqft/day</span>
              </div>
              <a href={`/walls/${selected.id}`} className="btn-primary text-sm py-1.5 px-4">
                Book Now
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
