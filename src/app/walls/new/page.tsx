'use client'

import { useState, useRef }    from 'react'
import { useRouter }            from 'next/navigation'
import { useAccount }           from 'wagmi'
import { ConnectButton }        from '@rainbow-me/rainbowkit'
import { CornerPicker }         from '@/components/CornerPicker'
import { estimateWallArea }     from '@/lib/homography'
import type { Point2D }         from '@/lib/homography'
import { VISIBILITY_MULTIPLIERS } from '@/lib/pricing'
import { Camera, Upload, CheckCircle, Loader2, MapPin, Info } from 'lucide-react'

type Step = 'location' | 'capture' | 'measure' | 'pricing' | 'submit'

export default function NewWallPage() {
  const { isConnected, address } = useAccount()
  const router = useRouter()

  // Form state
  const [step, setStep]       = useState<Step>('location')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Location
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [addressText, setAddressText] = useState('')
  const [city,        setCity]        = useState('')
  const [country,     setCountry]     = useState('US')
  const [lat,         setLat]         = useState('')
  const [lng,         setLng]         = useState('')

  // Capture
  const [capturedImg,  setCapturedImg]  = useState<string | null>(null)  // base64 or blob URL
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [streaming, setStreaming]       = useState(false)

  // Measure
  const [a4Corners,   setA4Corners]   = useState<Point2D[]>([])
  const [wallCorners, setWallCorners] = useState<Point2D[]>([])
  const [estimate, setEstimate] = useState<{
    widthFt: number; heightFt: number; areaSqft: number; wallCornersNorm: [number,number][]
  } | null>(null)

  // Pricing
  const [pricePerSqftDay, setPricePerSqftDay] = useState('0.0001')
  const [visibilityTier,  setVisibilityTier]  = useState(3)

  // Camera helpers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStreaming(true)
      }
    } catch {
      setError('Camera access denied. Please use file upload instead.')
    }
  }

  const capture = () => {
    const video  = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'wall-capture.jpg', { type: 'image/jpeg' })
      setCapturedFile(file)
      setCapturedImg(URL.createObjectURL(blob))
      // Stop stream
      ;(video.srcObject as MediaStream)?.getTracks().forEach(t => t.stop())
      setStreaming(false)
    }, 'image/jpeg', 0.92)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCapturedFile(file)
    setCapturedImg(URL.createObjectURL(file))
  }

  const computeEstimate = () => {
    if (a4Corners.length !== 4 || wallCorners.length !== 4) {
      setError('Please place all 4 corners for both the A4 sheet and wall boundary.')
      return
    }
    // Get canvas dimensions from the CornerPicker (we use normalized 0–1 coords)
    // We pass dummy image dimensions since coords are already normalized
    const result = estimateWallArea(a4Corners, wallCorners, 1, 1, true)
    setEstimate(result)
    setError('')
  }

  const handleSubmit = async () => {
    if (!capturedFile || !estimate) return
    setLoading(true)
    setError('')

    try {
      // 1. Upload photo to IPFS
      const formData = new FormData()
      formData.append('file', capturedFile)
      formData.append('type', 'wall-photo')

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Photo upload failed')
      const { cid: photoCid } = await uploadRes.json()

      // 2. Create wall in DB
      const res = await fetch('/api/walls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: address,
          title,
          description,
          addressText,
          city,
          country,
          latitude:         parseFloat(lat),
          longitude:        parseFloat(lng),
          photoCids:        [photoCid],
          referencePhotoCid: photoCid,
          wallCornersJson:  JSON.stringify(estimate.wallCornersNorm),
          areaSqft:         estimate.areaSqft,
          widthFt:          estimate.widthFt,
          heightFt:         estimate.heightFt,
          pricePerSqftDay,
          visibilityTier,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create wall')
      const { wall } = await res.json()
      router.push(`/walls/${wall.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="page-container py-16 flex flex-col items-center gap-6">
        <h1 className="section-title">List Your Wall</h1>
        <p className="text-slate-500">Connect your wallet to list a wall</p>
        <ConnectButton />
      </div>
    )
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'location', label: 'Location' },
    { id: 'capture',  label: 'Photo'    },
    { id: 'measure',  label: 'Measure'  },
    { id: 'pricing',  label: 'Pricing'  },
    { id: 'submit',   label: 'Review'   },
  ]

  const stepIndex = steps.findIndex(s => s.id === step)

  return (
    <div className="page-container py-8 max-w-3xl">
      <h1 className="section-title mb-6">List Your Wall</h1>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i < stepIndex  ? 'bg-brand/20 text-brand' :
              i === stepIndex ? 'bg-brand text-black' :
              'bg-surface-raised text-slate-500'
            }`}>
              {i < stepIndex ? <CheckCircle size={11} /> : null}
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-6 ${i < stepIndex ? 'bg-brand/40' : 'bg-surface-border'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Step: Location ─────────────────────────────────────────── */}
      {step === 'location' && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-100">Wall Location & Title</h2>

          <div>
            <label className="label">Wall Title</label>
            <input className="input" placeholder="e.g. Downtown Mural Wall, Broadway & 5th" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-none" placeholder="Describe the wall, surroundings, foot traffic..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="label">Street Address</label>
            <input className="input" placeholder="123 Main St" value={addressText} onChange={e => setAddressText(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="New York" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" placeholder="US" maxLength={2} value={country} onChange={e => setCountry(e.target.value.toUpperCase())} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input className="input" placeholder="40.7128" type="number" step="0.0001" value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input className="input" placeholder="-74.0060" type="number" step="0.0001" value={lng} onChange={e => setLng(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-brand/5 border border-brand/20 rounded-lg text-xs text-slate-400">
            <MapPin size={13} className="text-brand shrink-0" />
            Tip: use Google Maps → right-click → "What&apos;s here?" to get lat/lng
          </div>

          <button
            className="btn-primary w-full"
            disabled={!title || !addressText || !city || !lat || !lng}
            onClick={() => setStep('capture')}
          >
            Continue to Photo Capture
          </button>
        </div>
      )}

      {/* ── Step: Capture ──────────────────────────────────────────── */}
      {step === 'capture' && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-100">Capture Wall Photo</h2>
          <div className="flex items-start gap-2 p-3 bg-brand/5 border border-brand/20 rounded-lg text-xs text-slate-400">
            <Info size={13} className="text-brand shrink-0 mt-0.5" />
            Place an A4 sheet (210×297mm) flat against the wall and visible in the photo.
            This is used to estimate wall dimensions.
          </div>

          {capturedImg ? (
            <div className="space-y-3">
              <img src={capturedImg} alt="Captured wall" className="w-full rounded-lg border border-surface-border" />
              <button
                className="btn-secondary text-sm"
                onClick={() => { setCapturedImg(null); setCapturedFile(null) }}
              >
                Retake
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-surface-raised border border-surface-border" style={{ minHeight: 300 }}>
                <video ref={videoRef} className="w-full" playsInline muted />
                {!streaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <Camera size={48} className="text-slate-600" />
                    <button onClick={startCamera} className="btn-primary">
                      <Camera size={16} />
                      Use Camera
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {streaming && (
                  <button onClick={capture} className="btn-primary flex-1">
                    <Camera size={16} />
                    Capture Photo
                  </button>
                )}
                <label className={`${streaming ? 'btn-secondary' : 'btn-primary w-full'} cursor-pointer justify-center`}>
                  <Upload size={16} />
                  Upload Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep('location')}>Back</button>
            <button className="btn-primary flex-1" disabled={!capturedImg} onClick={() => setStep('measure')}>
              Continue to Measurement
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Measure ──────────────────────────────────────────── */}
      {step === 'measure' && capturedImg && (
        <div className="card space-y-5">
          <h2 className="font-semibold text-slate-100">Mark Corners</h2>
          <p className="text-sm text-slate-400">
            First mark the 4 corners of the A4 sheet, then the 4 corners of the wall area.
          </p>

          <CornerPicker imageUrl={capturedImg} mode="a4" corners={a4Corners} onCornersSet={setA4Corners} />
          <CornerPicker imageUrl={capturedImg} mode="wall" corners={wallCorners} onCornersSet={setWallCorners} />

          {estimate && (
            <div className="p-4 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
              <p className="text-sm font-semibold text-emerald-400 mb-1">Estimated Dimensions</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-slate-500">Width: </span><span className="text-slate-200 font-medium">{estimate.widthFt}′</span></div>
                <div><span className="text-slate-500">Height: </span><span className="text-slate-200 font-medium">{estimate.heightFt}′</span></div>
                <div><span className="text-slate-500">Area: </span><span className="text-brand font-bold">{estimate.areaSqft} sqft</span></div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep('capture')}>Back</button>
            <button
              className="btn-secondary"
              disabled={a4Corners.length !== 4 || wallCorners.length !== 4}
              onClick={computeEstimate}
            >
              Calculate Area
            </button>
            <button
              className="btn-primary flex-1"
              disabled={!estimate}
              onClick={() => setStep('pricing')}
            >
              Continue to Pricing
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Pricing ──────────────────────────────────────────── */}
      {step === 'pricing' && (
        <div className="card space-y-5">
          <h2 className="font-semibold text-slate-100">Set Your Price</h2>

          <div>
            <label className="label">Price per sqft per day (BNB)</label>
            <input className="input font-mono" type="number" step="0.000001" min="0.000001"
              value={pricePerSqftDay} onChange={e => setPricePerSqftDay(e.target.value)} />
            {estimate && (
              <p className="text-xs text-slate-500 mt-1">
                ≈ {(Number(pricePerSqftDay) * estimate.areaSqft * VISIBILITY_MULTIPLIERS[visibilityTier].mult).toFixed(6)} BNB/day
                for {estimate.areaSqft} sqft at tier {visibilityTier}
              </p>
            )}
          </div>

          <div>
            <label className="label">Visibility Tier</label>
            <div className="space-y-2 mt-2">
              {Object.entries(VISIBILITY_MULTIPLIERS).map(([tier, info]) => (
                <label key={tier} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  visibilityTier === Number(tier)
                    ? 'border-brand/60 bg-brand/5'
                    : 'border-surface-border hover:border-surface-border/80'
                }`}>
                  <input type="radio" name="tier" value={tier}
                    checked={visibilityTier === Number(tier)}
                    onChange={() => setVisibilityTier(Number(tier))}
                    className="text-brand" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Tier {tier} — {info.mult}× multiplier
                    </p>
                    <p className="text-xs text-slate-500">{info.label}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep('measure')}>Back</button>
            <button className="btn-primary flex-1" onClick={() => setStep('submit')}>
              Review & Submit
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Submit ───────────────────────────────────────────── */}
      {step === 'submit' && (
        <div className="card space-y-5">
          <h2 className="font-semibold text-slate-100">Review & Publish</h2>

          <div className="space-y-2">
            {[
              ['Title',      title],
              ['Location',   `${addressText}, ${city}, ${country}`],
              ['Coordinates',`${lat}, ${lng}`],
              ['Area',       estimate ? `${estimate.areaSqft} sqft (${estimate.widthFt}′ × ${estimate.heightFt}′)` : 'Not measured'],
              ['Price',      `${pricePerSqftDay} BNB / sqft / day`],
              ['Visibility', `Tier ${visibilityTier} — ${VISIBILITY_MULTIPLIERS[visibilityTier].mult}×`],
            ].map(([key, val]) => (
              <div key={key} className="flex items-start gap-3 py-2 border-b border-surface-border last:border-0">
                <span className="text-sm text-slate-500 w-28 shrink-0">{key}</span>
                <span className="text-sm text-slate-200">{val}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep('pricing')}>Back</button>
            <button
              className="btn-primary flex-1"
              disabled={loading || !estimate}
              onClick={handleSubmit}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Publish Wall Listing'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
