'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount }            from 'wagmi'
import { useSubmitProof }        from '@/hooks/useEscrow'
import type { Booking }          from '@/types'
import { ipfsImageUrl }          from '@/lib/ipfs'
import { sha256Hex }             from '@/lib/ipfs'
import { Upload, Camera, MapPin, Video, CheckCircle, Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { EXPLORER_BASE }         from '@/lib/contract'

export default function InstallerPage() {
  const { bookingId }          = useParams<{ bookingId: string }>()
  const router                 = useRouter()
  const { address }            = useAccount()

  const [booking,  setBooking]  = useState<Booking | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [uploading, setUploading] = useState(false)

  // Proof media
  const [beforeFiles,    setBeforeFiles]    = useState<File[]>([])
  const [afterFiles,     setAfterFiles]     = useState<File[]>([])
  const [videoFile,      setVideoFile]      = useState<File | null>(null)
  const [useGPS,         setUseGPS]         = useState(false)
  const [gpsLat,         setGpsLat]         = useState('')
  const [gpsLng,         setGpsLng]         = useState('')

  // Upload results
  const [beforeCids, setBeforeCids] = useState<string[]>([])
  const [afterCids,  setAfterCids]  = useState<string[]>([])
  const [videoCid,   setVideoCid]   = useState<string | null>(null)

  const { submitProof, hash, isPending, isConfirming, isSuccess, error: txError } = useSubmitProof()

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.json())
      .then(d => { setBooking(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [bookingId])

  useEffect(() => {
    if (isSuccess && booking) {
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }, [isSuccess, booking, router])

  const uploadFiles = async () => {
    setUploading(true)
    setError('')
    try {
      const uploadSingle = async (file: File): Promise<string> => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', 'proof-media')
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`)
        const { cid } = await res.json()
        return cid
      }

      const [bCids, aCids] = await Promise.all([
        Promise.all(beforeFiles.map(uploadSingle)),
        Promise.all(afterFiles.map(uploadSingle)),
      ])
      setBeforeCids(bCids)
      setAfterCids(aCids)

      if (videoFile) {
        const vCid = await uploadSingle(videoFile)
        setVideoCid(vCid)
      }

      return { bCids, aCids, vCid: videoFile ? videoCid : null }
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!booking || !address) return
    if (beforeFiles.length === 0 || afterFiles.length === 0) {
      setError('Please upload at least 1 before and 1 after photo.')
      return
    }

    setError('')

    try {
      // 1. Upload media files to IPFS
      const uploaded = await uploadFiles()
      if (!uploaded) return

      const bCids = uploaded.bCids
      const aCids = uploaded.aCids

      // 2. Build proof manifest
      const manifest = {
        bookingId:       booking.id,
        chainBookingId:  booking.chainBookingId,
        installer:       address,
        beforePhotoCids: bCids,
        afterPhotoCids:  aCids,
        videoCid:        uploaded.vCid || null,
        gpsLat:          useGPS ? parseFloat(gpsLat) : null,
        gpsLng:          useGPS ? parseFloat(gpsLng) : null,
        submittedAt:     new Date().toISOString(),
      }

      // 3. Upload manifest to IPFS and compute SHA-256
      const manifestStr  = JSON.stringify(manifest)
      const manifestBuf  = new TextEncoder().encode(manifestStr).buffer
      const contentHash  = await sha256Hex(manifestBuf) as `0x${string}`

      // Upload manifest JSON
      const manifestFd = new FormData()
      manifestFd.append('json',  manifestStr)
      manifestFd.append('name',  `proof-${booking.id}`)
      const manRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: manifest, name: `proof-${booking.id}` }),
      })
      if (!manRes.ok) throw new Error('Manifest upload failed')
      const { cid: manifestCid } = await manRes.json()

      // 4. Submit proof to DB
      const proofRes = await fetch('/api/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId:       booking.id,
          installerAddress: address,
          beforePhotoCids: bCids,
          afterPhotoCids:  aCids,
          videoCid:        uploaded.vCid,
          gpsLat:          useGPS ? parseFloat(gpsLat) : null,
          gpsLng:          useGPS ? parseFloat(gpsLng) : null,
          proofPackageCid: manifestCid,
          proofContentHash: contentHash,
        }),
      })
      if (!proofRes.ok) throw new Error('Failed to save proof')

      // 5. Submit hash on-chain
      if (!booking.chainBookingId) throw new Error('No on-chain booking ID found')
      submitProof(booking.chainBookingId as `0x${string}`, contentHash)

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    }
  }

  if (loading) return <div className="page-container py-16 text-center"><Loader2 className="animate-spin mx-auto text-brand" /></div>
  if (!booking) return <div className="page-container py-16 text-center text-red-400">Booking not found</div>

  const isInstaller = address?.toLowerCase() === booking.installerAddress?.toLowerCase()

  return (
    <div className="page-container py-8 max-w-2xl mx-auto">
      <h1 className="section-title mb-2">Submit Installation Proof</h1>
      <p className="text-slate-500 mb-6">{booking.wall.title} — {booking.wall.city}</p>

      {!address ? (
        <div className="card text-center py-8 text-slate-500">Connect wallet to submit proof</div>
      ) : !isInstaller ? (
        <div className="card p-4 bg-yellow-400/10 border border-yellow-400/20">
          <p className="text-yellow-400 text-sm">
            Only the designated installer ({booking.installerAddress?.slice(0,10)}...) can submit proof.
          </p>
        </div>
      ) : booking.status !== 'FUNDED' ? (
        <div className="card p-4">
          <p className="text-slate-400 text-sm">
            This booking is in <strong className="text-slate-200">{booking.status}</strong> state.
            {booking.status === 'PROOF_SUBMITTED' && ' Proof already submitted.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Before photos */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-100">Before Photos <span className="text-red-400">*</span></h3>
            <p className="text-xs text-slate-500">Photos of the wall BEFORE installation begins</p>
            <FileMultiUpload
              files={beforeFiles}
              onFilesChange={setBeforeFiles}
              accept="image/*"
              label="Add Before Photos"
            />
          </div>

          {/* After photos */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-100">After Photos <span className="text-red-400">*</span></h3>
            <p className="text-xs text-slate-500">Photos of the completed installation</p>
            <FileMultiUpload
              files={afterFiles}
              onFilesChange={setAfterFiles}
              accept="image/*"
              label="Add After Photos"
            />
          </div>

          {/* Video */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-100">Video <span className="text-slate-500 text-xs">(optional)</span></h3>
            <p className="text-xs text-slate-500">Short walkthrough video of the installation</p>
            {videoFile ? (
              <div className="flex items-center justify-between p-3 bg-surface-raised rounded-lg">
                <div className="flex items-center gap-2">
                  <Video size={16} className="text-brand" />
                  <span className="text-sm text-slate-300">{videoFile.name}</span>
                </div>
                <button onClick={() => setVideoFile(null)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 border border-dashed border-surface-border rounded-lg cursor-pointer hover:border-brand/50 transition-colors text-sm text-slate-400">
                <Video size={16} />
                Upload Video
                <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          {/* GPS */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100">GPS Location <span className="text-slate-500 text-xs">(optional)</span></h3>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="checkbox" checked={useGPS} onChange={e => setUseGPS(e.target.checked)} className="rounded" />
                Include GPS
              </label>
            </div>
            {useGPS && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Latitude</label>
                  <input className="input" type="number" step="0.0001" value={gpsLat} onChange={e => setGpsLat(e.target.value)} />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input className="input" type="number" step="0.0001" value={gpsLng} onChange={e => setGpsLng(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Errors */}
          {(error || txError) && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {error || (txError instanceof Error ? txError.message : 'Transaction failed')}
            </div>
          )}

          {/* Tx status */}
          {hash && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm flex items-center justify-between">
              <span className={isSuccess ? 'text-emerald-400' : 'text-blue-400'}>
                {isSuccess ? '✓ Proof hash recorded on-chain!' : isConfirming ? 'Confirming...' : 'Submitted'}
              </span>
              <a href={`${EXPLORER_BASE}/tx/${hash}`} target="_blank" rel="noreferrer"
                className="text-brand text-xs flex items-center gap-1">
                View <ExternalLink size={11} />
              </a>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center space-y-2">
              <CheckCircle size={48} className="text-emerald-400 mx-auto" />
              <p className="font-semibold text-slate-200">Proof submitted successfully!</p>
              <p className="text-sm text-slate-500">The advertiser has 7 days to review.</p>
            </div>
          ) : (
            <button
              className="btn-primary w-full py-4"
              onClick={handleSubmit}
              disabled={uploading || isPending || isConfirming || beforeFiles.length === 0 || afterFiles.length === 0}
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin" /> Uploading to IPFS...</>
                : isPending || isConfirming
                ? <><Loader2 size={16} className="animate-spin" /> {isPending ? 'Confirm in wallet...' : 'Confirming...'}</>
                : <>Submit Proof On-Chain</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Multi-file upload helper component
function FileMultiUpload({
  files, onFilesChange, accept, label,
}: {
  files: File[]
  onFilesChange: (files: File[]) => void
  accept: string
  label: string
}) {
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden bg-surface-raised aspect-square">
              <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
              <button
                onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-xs text-white hover:bg-red-500/80"
              >×</button>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 p-3 border border-dashed border-surface-border rounded-lg cursor-pointer hover:border-brand/50 transition-colors text-sm text-slate-400">
        <Upload size={14} />
        {label}
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={e => {
            const newFiles = Array.from(e.target.files || [])
            onFilesChange([...files, ...newFiles])
          }}
        />
      </label>
    </div>
  )
}
