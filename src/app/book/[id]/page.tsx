'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount }            from 'wagmi'
import { ConnectButton }         from '@rainbow-me/rainbowkit'
import { calculatePrice, calculateDays, formatBnb, VISIBILITY_MULTIPLIERS } from '@/lib/pricing'
import { AdPreview }             from '@/components/AdPreview'
import type { Wall }             from '@/types'
import { ipfsImageUrl }          from '@/lib/ipfs'
import { Calendar, Upload, Image as ImageIcon, ArrowRight, Loader2, Info } from 'lucide-react'

type BookStep = 'dates' | 'artwork' | 'preview' | 'confirm'

export default function BookPage() {
  const { id }               = useParams<{ id: string }>()
  const router               = useRouter()
  const { isConnected, address } = useAccount()

  const [wall,      setWall]      = useState<Wall | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [step,      setStep]      = useState<BookStep>('dates')
  const [error,     setError]     = useState('')

  // Dates
  const today     = new Date()
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const in30      = new Date(today); in30.setDate(today.getDate() + 31)
  const [startDate, setStartDate] = useState(tomorrow.toISOString().split('T')[0])
  const [endDate,   setEndDate]   = useState(in30.toISOString().split('T')[0])

  // Artwork
  const [artworkFile,    setArtworkFile]    = useState<File | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [artworkCid,     setArtworkCid]     = useState<string | null>(null)
  const [uploadingArt,   setUploadingArt]   = useState(false)

  // Installer
  const [installerAddress, setInstallerAddress] = useState('')

  // Booking result
  const [bookingId, setBookingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/walls/${id}`)
      .then(r => r.json())
      .then(data => { setWall(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading)     return <div className="page-container py-16 text-center text-slate-500"><Loader2 className="animate-spin mx-auto" /></div>
  if (!wall)       return <div className="page-container py-16 text-center text-red-400">Wall not found</div>
  if (!isConnected) return (
    <div className="page-container py-16 flex flex-col items-center gap-4">
      <p className="text-slate-400">Connect wallet to book</p>
      <ConnectButton />
    </div>
  )

  const days     = calculateDays(new Date(startDate), new Date(endDate))
  const pricing  = wall.areaSqft
    ? calculatePrice(wall.areaSqft, wall.pricePerSqftDay, wall.visibilityTier, days)
    : null

  const uploadArtwork = async (file: File) => {
    setUploadingArt(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'artwork')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { cid } = await res.json()
      setArtworkCid(cid)
    } catch (e) {
      setError('Artwork upload failed')
    } finally {
      setUploadingArt(false)
    }
  }

  const handleArtworkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArtworkFile(file)
    setArtworkPreview(URL.createObjectURL(file))
    uploadArtwork(file)
  }

  const createBooking = async () => {
    if (!pricing || !artworkCid || !installerAddress) {
      setError('Please fill all required fields')
      return
    }
    setError('')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advertiserAddress: address,
          wallId:            wall.id,
          installerAddress,
          startDate,
          endDate,
          artworkCid,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Booking failed')
      const { booking } = await res.json()
      router.push(`/pay/${booking.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed')
    }
  }

  const steps: { id: BookStep; label: string }[] = [
    { id: 'dates',   label: 'Dates'   },
    { id: 'artwork', label: 'Artwork' },
    { id: 'preview', label: 'Preview' },
    { id: 'confirm', label: 'Confirm' },
  ]
  const stepIdx = steps.findIndex(s => s.id === step)

  return (
    <div className="page-container py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="section-title mb-2">Book Wall</h1>
        <p className="text-slate-500 mb-6">{wall.title} — {wall.city}</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= stepIdx ? 'bg-brand' : 'bg-surface-raised'
            }`} />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Step: Dates ─────────────────────────────────────────── */}
        {step === 'dates' && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Calendar size={18} className="text-brand" />
              Select Campaign Dates
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input"
                  min={tomorrow.toISOString().split('T')[0]}
                  value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input"
                  min={startDate}
                  value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Installer address */}
            <div>
              <label className="label">Installer Wallet Address</label>
              <input className="input font-mono text-sm" placeholder="0x..."
                value={installerAddress} onChange={e => setInstallerAddress(e.target.value)} />
              <p className="text-xs text-slate-600 mt-1">
                The person who will install the ad. They&apos;ll submit photo proof on-chain.
              </p>
            </div>

            {/* Pricing */}
            {pricing && (
              <div className="p-4 bg-surface-raised rounded-xl border border-surface-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Duration</span>
                  <span className="text-slate-200">{days} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Area</span>
                  <span className="text-slate-200">{wall.areaSqft} sqft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Visibility</span>
                  <span className="text-slate-200">
                    Tier {wall.visibilityTier} ({VISIBILITY_MULTIPLIERS[wall.visibilityTier]?.mult}×)
                  </span>
                </div>
                <div className="border-t border-surface-border pt-2 flex justify-between font-bold">
                  <span className="text-slate-300">Total</span>
                  <span className="text-brand text-lg">{pricing.totalBnb} BNB</span>
                </div>
              </div>
            )}

            <button
              className="btn-primary w-full"
              disabled={!startDate || !endDate || !installerAddress || !installerAddress.startsWith('0x')}
              onClick={() => setStep('artwork')}
            >
              Continue to Artwork <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step: Artwork ───────────────────────────────────────── */}
        {step === 'artwork' && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <ImageIcon size={18} className="text-brand" />
              Upload Banner Artwork
            </h2>

            <div className="flex items-start gap-2 p-3 bg-brand/5 border border-brand/20 rounded-lg text-xs text-slate-400">
              <Info size={13} className="text-brand shrink-0 mt-0.5" />
              Upload your banner at full resolution. Recommended: {
                wall.widthFt && wall.heightFt
                  ? `${Math.round(wall.widthFt * 96)} × ${Math.round(wall.heightFt * 96)}px`
                  : 'high resolution'
              }
            </div>

            {artworkPreview ? (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-surface-border bg-surface-raised">
                  <img src={artworkPreview} alt="Artwork preview" className="w-full max-h-64 object-contain" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{artworkFile?.name}</span>
                  {uploadingArt
                    ? <span className="text-xs text-brand flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading to IPFS...</span>
                    : artworkCid
                    ? <span className="text-xs text-emerald-400">✓ Uploaded to IPFS</span>
                    : null
                  }
                </div>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => { setArtworkFile(null); setArtworkPreview(null); setArtworkCid(null) }}
                >
                  Choose Different File
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 p-10
                                border-2 border-dashed border-surface-border rounded-xl
                                cursor-pointer hover:border-brand/50 transition-colors">
                <Upload size={32} className="text-slate-600" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">Click to upload artwork</p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP — max 10MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleArtworkSelect} />
              </label>
            )}

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('dates')}>Back</button>
              <button
                className="btn-primary flex-1"
                disabled={!artworkCid || uploadingArt || !wall.wallCornersJson}
                onClick={() => setStep('preview')}
              >
                Generate Preview <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Preview ───────────────────────────────────────── */}
        {step === 'preview' && artworkCid && wall.wallCornersJson && wall.photoCids?.[0] && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-slate-100">Ad Preview</h2>
            <p className="text-sm text-slate-400">
              This is how your ad will look on the wall.
            </p>

            <AdPreview
              wallPhotoCid={wall.referencePhotoCid || wall.photoCids[0]}
              artworkCid={artworkCid}
              wallCornersJson={wall.wallCornersJson}
            />

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('artwork')}>Back</button>
              <button className="btn-primary flex-1" onClick={() => setStep('confirm')}>
                Looks Good — Confirm <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Confirm ───────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="card space-y-5">
            <h2 className="font-semibold text-slate-100">Confirm Booking</h2>

            <div className="space-y-2">
              {[
                ['Wall',      wall.title],
                ['Location',  `${wall.city}, ${wall.country}`],
                ['Dates',     `${startDate} → ${endDate} (${days} days)`],
                ['Installer', installerAddress],
                ['Total',     pricing ? `${pricing.totalBnb} BNB` : 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-surface-border last:border-0 text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className={`font-medium ${k === 'Total' ? 'text-brand' : 'text-slate-200'} font-mono text-xs`}>{v}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg text-xs text-slate-400 space-y-1">
              <p>• Clicking &quot;Proceed to Payment&quot; creates a booking record off-chain.</p>
              <p>• Next step: you&apos;ll confirm the on-chain <strong className="text-brand">fundBooking()</strong> transaction.</p>
              <p>• Funds stay locked in the contract until you approve the installation.</p>
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('preview')}>Back</button>
              <button className="btn-primary flex-1" onClick={createBooking}>
                Proceed to Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
