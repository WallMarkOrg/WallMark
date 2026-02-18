'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount }            from 'wagmi'
import { useApproveProof, useRejectProof, useClaimAfterTimeout, useOnChainBooking, useCanClaimTimeout } from '@/hooks/useEscrow'
import type { Booking }          from '@/types'
import { ipfsImageUrl }          from '@/lib/ipfs'
import { keccak256 }             from 'viem'
import { EXPLORER_BASE }         from '@/lib/contract'
import { BookingStatus }         from '@/components/BookingStatus'
import { CheckCircle, XCircle, Clock, ExternalLink, Loader2, AlertTriangle, Shield, Image as ImageIcon, Video } from 'lucide-react'
import { formatBnb }             from '@/lib/pricing'
import { timeUntil }             from '@/lib/utils'

export default function ReviewPage() {
  const { bookingId }          = useParams<{ bookingId: string }>()
  const router                 = useRouter()
  const { address }            = useAccount()

  const [booking,  setBooking]  = useState<Booking | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  const { approve, hash: approveHash, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveError } = useApproveProof()
  const { reject,  hash: rejectHash,  isPending: rejectPending,  isConfirming: rejectConfirming,  isSuccess: rejectSuccess,  error: rejectError  } = useRejectProof()
  const { claim,   hash: claimHash,   isPending: claimPending,   isConfirming: claimConfirming,   isSuccess: claimSuccess,   error: claimError   } = useClaimAfterTimeout()

  // Read on-chain state for the booking
  const chainBid = booking?.chainBookingId as `0x${string}` | undefined
  const { data: onChainBooking } = useOnChainBooking(chainBid)
  const { data: canClaim       } = useCanClaimTimeout(chainBid)

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.json())
      .then(d => { setBooking(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [bookingId])

  // Sync chain state back to DB after any successful tx
  useEffect(() => {
    if (!booking) return
    const hash = approveHash || rejectHash || claimHash
    if (!hash) return

    const newStatus = approveSuccess ? 'APPROVED' : rejectSuccess ? 'REJECTED' : claimSuccess ? 'APPROVED' : null
    if (!newStatus) return

    fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHashSettle: hash, status: newStatus }),
    }).then(() => {
      if (rejectSuccess && booking.proof) {
        fetch(`/api/proofs/${booking.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'rejected', rejectionReason: rejectReason }),
        })
      }
      setTimeout(() => router.push('/dashboard'), 2500)
    })
  }, [approveSuccess, rejectSuccess, claimSuccess])

  const handleApprove = () => {
    if (!booking?.chainBookingId) return
    approve(booking.chainBookingId as `0x${string}`)

    // Mark proof as approved in DB
    if (booking.proof) {
      fetch(`/api/proofs/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      })
    }
  }

  const handleReject = () => {
    if (!booking?.chainBookingId || !rejectReason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }
    const reasonHash = keccak256(new TextEncoder().encode(rejectReason)) as `0x${string}`
    reject(booking.chainBookingId as `0x${string}`, reasonHash)
    setShowRejectForm(false)
  }

  const handleClaim = () => {
    if (!booking?.chainBookingId) return
    claim(booking.chainBookingId as `0x${string}`)
  }

  if (loading) return <div className="page-container py-16 text-center"><Loader2 className="animate-spin text-brand mx-auto" /></div>
  if (!booking) return <div className="page-container py-16 text-center text-red-400">Booking not found</div>

  const proof         = booking.proof
  const isAdvertiser  = address?.toLowerCase() === booking.advertiserAddress?.toLowerCase()
  const allPhotos     = proof ? [...(proof.beforePhotoCids || []), ...(proof.afterPhotoCids || [])] : []
  const disputeEnd    = booking.disputeDeadline ? new Date(booking.disputeDeadline) : null
  const windowOpen    = disputeEnd ? disputeEnd > new Date() : true

  const txHash        = approveHash || rejectHash || claimHash
  const isPending     = approvePending || rejectPending || claimPending
  const isConfirming  = approveConfirming || rejectConfirming || claimConfirming
  const isSuccess     = approveSuccess || rejectSuccess || claimSuccess
  const txError       = approveError || rejectError || claimError

  return (
    <div className="page-container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">

        {/* ── Left: proof media ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h1 className="section-title">Review Installation Proof</h1>
            <p className="text-slate-500 mt-1">{booking.wall.title} — {booking.wall.city}</p>
          </div>

          {!proof ? (
            <div className="card py-12 text-center">
              <Clock size={48} className="mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">No proof submitted yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                {booking.status === 'FUNDED'
                  ? 'Waiting for installer to submit proof.'
                  : `Booking status: ${booking.status}`}
              </p>
            </div>
          ) : (
            <>
              {/* Photo viewer */}
              {allPhotos.length > 0 && (
                <div className="card p-0 overflow-hidden space-y-0">
                  <div className="relative bg-surface-raised" style={{ minHeight: 320 }}>
                    <img
                      src={ipfsImageUrl(allPhotos[photoIdx])}
                      alt={`Proof photo ${photoIdx + 1}`}
                      className="w-full h-80 object-contain"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder-wall.jpg' }}
                    />
                    {/* Before/After label */}
                    <div className="absolute top-3 left-3">
                      <span className={`badge ${
                        photoIdx < ((proof.beforePhotoCids ?? []).length)
                          ? 'bg-yellow-400/20 text-yellow-400'
                          : 'bg-emerald-400/20 text-emerald-400'
                      }`}>
                        {photoIdx < ((proof.beforePhotoCids ?? []).length) ? 'BEFORE' : 'AFTER'}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 text-xs text-slate-400 bg-black/50 px-2 py-1 rounded">
                      {photoIdx + 1} / {allPhotos.length}
                    </div>
                  </div>

                  {/* Thumbnails */}
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {(proof.beforePhotoCids ?? []).map((cid, i) => (
                      <button key={`b-${i}`} onClick={() => setPhotoIdx(i)}
                        className={`shrink-0 w-16 h-12 rounded border-2 overflow-hidden transition-colors ${
                          photoIdx === i ? 'border-yellow-400' : 'border-surface-border'
                        }`}>
                        <img src={ipfsImageUrl(cid)} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {proof.afterPhotoCids?.map((cid, i) => {
                      const idx = (proof.beforePhotoCids ?? []).length + i
                      return (
                        <button key={`a-${i}`} onClick={() => setPhotoIdx(idx)}
                          className={`shrink-0 w-16 h-12 rounded border-2 overflow-hidden transition-colors ${
                            photoIdx === idx ? 'border-emerald-400' : 'border-surface-border'
                          }`}>
                          <img src={ipfsImageUrl(cid)} className="w-full h-full object-cover" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Video */}
              {proof.videoCid && (
                <div className="card space-y-2">
                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <Video size={16} className="text-brand" />
                    Installation Video
                  </div>
                  <video
                    src={ipfsImageUrl(proof.videoCid)}
                    controls
                    className="w-full rounded-lg"
                  />
                </div>
              )}

              {/* Proof metadata */}
              <div className="card space-y-3">
                <h3 className="font-semibold text-slate-100">Proof Details</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Submitted',    new Date(proof.submittedAt).toLocaleString()],
                    ['Before photos', `${proof.beforePhotoCids?.length || 0} photos`],
                    ['After photos',  `${proof.afterPhotoCids?.length || 0} photos`],
                    proof.gpsLat && proof.gpsLng
                      ? ['GPS', `${proof.gpsLat.toFixed(5)}, ${proof.gpsLng.toFixed(5)}`]
                      : null,
                    ['IPFS Manifest', proof.proofPackageCid],
                    ['Content Hash',  proof.proofContentHash?.slice(0, 20) + '...'],
                  ].filter(Boolean).map((item) => {
                    const [k, v] = item as [string, string]
                    return (
                    <div key={k as string} className="flex justify-between gap-4 py-2 border-b border-surface-border last:border-0">
                      <span className="text-slate-500 shrink-0">{k}</span>
                      {k === 'IPFS Manifest' ? (
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${v}`}
                          target="_blank" rel="noreferrer"
                          className="text-brand text-xs font-mono hover:underline flex items-center gap-1"
                        >
                          {(v as string).slice(0, 16)}... <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs text-right">{v as string}</span>
                      )}
                    </div>
                  )
                  })}
                </div>

                {/* On-chain verification */}
                {booking.chainBookingId && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-400/5 border border-emerald-400/20 rounded-lg text-xs text-slate-400">
                    <Shield size={13} className="text-emerald-400 shrink-0" />
                    Proof hash recorded on BNB Chain.{' '}
                    {booking.txHashProof && (
                      <a href={`${EXPLORER_BASE}/tx/${booking.txHashProof}`} target="_blank" rel="noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1">
                        Verify on-chain <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right: decision panel ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Booking status timeline */}
          <div className="card">
            <BookingStatus booking={booking} />
          </div>

          {/* Dispute window */}
          {booking.status === 'PROOF_SUBMITTED' && disputeEnd && (
            <div className={`card border ${windowOpen ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-red-400/30 bg-red-400/5'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className={windowOpen ? 'text-yellow-400' : 'text-red-400'} />
                <span className="text-sm font-medium text-slate-200">Dispute Window</span>
              </div>
              <p className={`text-xs ${windowOpen ? 'text-yellow-400' : 'text-red-400'}`}>
                {windowOpen ? timeUntil(BigInt(Math.floor(disputeEnd.getTime() / 1000))) : 'Window closed — auto-release available'}
              </p>
            </div>
          )}

          {/* On-chain state */}
          {onChainBooking && (
            <div className="card text-xs space-y-1">
              <p className="text-slate-500 font-medium mb-2">On-Chain State</p>
              <div className="flex justify-between">
                <span className="text-slate-600">Amount locked</span>
                <span className="text-brand font-mono">{formatBnb(String(Number(onChainBooking.amount) / 1e18))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">State</span>
                <span className="text-slate-300">{['Funded','ProofSubmitted','Approved','Rejected','Expired'][onChainBooking.state]}</span>
              </div>
            </div>
          )}

          {/* Errors */}
          {(error || txError) && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-start gap-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {error || (txError instanceof Error ? txError.message : 'Transaction failed')}
            </div>
          )}

          {/* Tx status */}
          {txHash && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs flex items-center justify-between">
              <span className={isSuccess ? 'text-emerald-400' : 'text-blue-400'}>
                {isSuccess ? '✓ Transaction confirmed' : isConfirming ? 'Confirming...' : 'Submitted'}
              </span>
              <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer"
                className="text-brand flex items-center gap-1 hover:underline">
                BscScan <ExternalLink size={10} />
              </a>
            </div>
          )}

          {/* Action buttons */}
          {isSuccess ? (
            <div className="card text-center space-y-2">
              <CheckCircle size={36} className="text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-slate-200">
                {approveSuccess ? 'Approved! Funds released.' : rejectSuccess ? 'Rejected. Refund sent.' : 'Auto-released.'}
              </p>
              <p className="text-xs text-slate-500">Redirecting to dashboard...</p>
            </div>
          ) : booking.status === 'PROOF_SUBMITTED' && isAdvertiser ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center">
                You have final authority. Approve to release funds, reject for a refund.
              </p>

              {/* Approve */}
              <button
                className="btn-primary w-full py-3"
                onClick={handleApprove}
                disabled={isPending || isConfirming}
              >
                {isPending && !rejectPending
                  ? <><Loader2 size={15} className="animate-spin" /> Confirm in wallet...</>
                  : isConfirming && !rejectConfirming
                  ? <><Loader2 size={15} className="animate-spin" /> Confirming...</>
                  : <><CheckCircle size={15} /> Approve Installation</>
                }
              </button>

              {/* Reject */}
              {windowOpen && !showRejectForm && (
                <button
                  className="btn-danger w-full py-3"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isPending || isConfirming}
                >
                  <XCircle size={15} /> Reject Proof
                </button>
              )}

              {showRejectForm && (
                <div className="space-y-2 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <label className="label text-xs">Rejection Reason <span className="text-red-400">*</span></label>
                  <textarea
                    className="input text-sm min-h-[80px] resize-none"
                    placeholder="e.g. Banner is misaligned, wrong section of wall..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-secondary text-sm py-2 flex-1" onClick={() => setShowRejectForm(false)}>Cancel</button>
                    <button
                      className="btn-danger text-sm py-2 flex-1"
                      onClick={handleReject}
                      disabled={!rejectReason.trim() || isPending || isConfirming}
                    >
                      {rejectPending || rejectConfirming
                        ? <Loader2 size={13} className="animate-spin" />
                        : 'Confirm Reject'
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : canClaim ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">
                Dispute window has passed. Anyone can trigger auto-release.
              </p>
              <button
                className="btn-secondary w-full py-3"
                onClick={handleClaim}
                disabled={isPending || isConfirming}
              >
                {claimPending || claimConfirming
                  ? <Loader2 size={15} className="animate-spin" />
                  : <><Clock size={15} /> Trigger Auto-Release</>
                }
              </button>
            </div>
          ) : null}

          {/* Metadata hash integrity note */}
          {booking.metadataHash && (
            <div className="text-xs text-slate-600 p-3 bg-surface-raised rounded-lg">
              <p className="font-medium text-slate-500 mb-1">Booking Integrity</p>
              <p className="font-mono break-all">{booking.metadataHash?.slice(0,32)}...</p>
              <p className="mt-1">This hash anchors all booking terms to the on-chain escrow.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
