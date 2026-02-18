'use client'

import { useEffect, useState } from 'react'
import { MapPin }               from 'lucide-react'
import type { Wall }            from '@/types'

interface WallMapProps {
  walls:         Wall[]
  selectedWallId?: string
  onWallClick?:  (wall: Wall) => void
  center?:       [number, number]
  zoom?:         number
}

// Dynamically imported to avoid SSR issues with Leaflet
let MapContainer: React.ComponentType<any>
let TileLayer:    React.ComponentType<any>
let Marker:       React.ComponentType<any>
let Popup:        React.ComponentType<any>
let L: any

export function WallMap({
  walls,
  selectedWallId,
  onWallClick,
  center = [40.7128, -74.006], // default: NYC
  zoom   = 12,
}: WallMapProps) {
  const [isClient,  setIsClient]  = useState(false)
  const [MapComponents, setMapComponents] = useState<any>(null)

  useEffect(() => {
    setIsClient(true)
    import('leaflet').then((leaflet) => {
      L = leaflet.default
      // Fix default marker icon paths for webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      return import('react-leaflet')
    }).then((rl) => {
      setMapComponents({
        MapContainer: rl.MapContainer,
        TileLayer:    rl.TileLayer,
        Marker:       rl.Marker,
        Popup:        rl.Popup,
      })
    })
    return () => {}
  }, [])

  if (!isClient || !MapComponents) {
    return (
      <div className="w-full h-full bg-surface-raised rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <MapPin size={32} className="animate-pulse text-brand/50" />
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    )
  }

  const { MapContainer: MC, TileLayer: TL, Marker: MK, Popup: PP } = MapComponents

  return (
    <MC
      center={center}
      zoom={zoom}
      minZoom={2}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1.0}
      className="w-full h-full rounded-xl z-0"
      style={{ background: '#1a1a27' }}
    >
      <TL
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        noWrap={true}
      />
      {walls.map((wall) => (
        <MK
          key={wall.id}
          position={[wall.latitude, wall.longitude]}
          eventHandlers={{
            click: () => onWallClick?.(wall),
          }}
        >
          <PP>
            <div className="text-black text-sm p-1 min-w-[140px]">
              <p className="font-semibold">{wall.title}</p>
              <p className="text-xs text-gray-600">{wall.addressText}</p>
              <p className="text-xs font-medium text-orange-600 mt-1">
                {wall.pricePerSqftDay} BNB / sqft / day
              </p>
              {wall.areaSqft && (
                <p className="text-xs text-gray-500">{wall.areaSqft} sqft</p>
              )}
              <a
                href={`/walls/${wall.id}`}
                className="block mt-2 text-xs text-blue-600 hover:underline"
              >
                View details →
              </a>
            </div>
          </PP>
        </MK>
      ))}
    </MC>
  )
}
