'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useFundBooking }       from '@/hooks/useEscrow'
import { deriveBookingId, buildMetadataHash } from '@/lib/bookingId'
import { EXPLORER_BASE, CHAIN_ID } from '@/lib/contract'
import type { Booking }         from '@/types'
import { Shield, ExternalLink, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatBnb }            from '@/lib/pricing'

export default function PayPage() {
  const { bookingId }          = useParams<{ bookingId: string }>()
  const router                 = useRouter()
  const { address }            = useAccount()
  const chainId                = useChainId()
  const { switchChain }        = useSwitchChain()

  const [booking,  setBooking]  = useState<Booking | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [txHash,   setTxHash]   = useState<string | null>(null)

  const { fund, hash, isPending, isConfirming, isSuccess, error: txError } = useFundBooking()

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.json())
      .then(data => { setBooking(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [bookingId])

  // Sync tx hash to DB when tx is submitted
  useEffect(() => {
    if (!hash || !booking) return
    setTxHash(hash)
    fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHashFund: hash, status: 'FUNDED' }),
    })
  }, [hash, booking])

  // Redirect to dashboard when confirmed
  useEffect(() => {
    if (isSuccess && booking) {
      // Update booking with chainBookingId
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }, [isSuccess, booking, router])

  const handlePay = async () => {
    if (!booking || !address) return
    setError('')

    try {
      // Derive deterministic bookingId (bytes32)
      const chainBid = deriveBookingId(
        address as `0x${string}`,
        booking.wallId,
        Date.parse(booking.createdAt)
      )

      // Build metadata hash
      const { hash: metaHash } = buildMetadataHash({
        bookingId:       chainBid,
        wallId:          booking.wallId,
        advertiser:      address,
        wallOwner:       booking.wall.ownerAddress,
        installer:       booking.installerAddress || '',
        startDate:       booking.startDate,
        endDate:         booking.endDate,
        areaSqft:        booking.areaSqft,
        pricePerSqftDay: booking.pricePerSqftDay,
        visibilityTier:  booking.wall.visibilityTier,
        visibilityMult:  booking.visibilityMult,
        totalBnb:        booking.totalBnb,
      })

      // Save chainBookingId to DB
      await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainBookingId: chainBid, metadataHash: metaHash }),
      })

      // Send the transaction
      fund(
        chainBid as `0x${string}`,
        booking.wall.ownerAddress as `0x${string}`,
        (booking.installerAddress || booking.wall.ownerAddress) as `0x${string}`,
        metaHash as `0x${string}`,
        booking.totalBnb
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  const wrongChain = chainId !== CHAIN_ID

  if (loading) return (
    <div className="page-container py-16 text-center">
      <Loader2 className="animate-spin text-brand mx-auto" size={32} />
    </div>
  )

  if (!booking) return (
    <div className="page-container py-16 text-center text-red-400">Booking not found</div>
  )

  if (booking.status !== 'PENDING_PAYMENT') {
    return (
      <div className="page-container py-16 max-w-lg mx-auto text-center space-y-4">
        <CheckCircle size={48} className="text-emerald-400 mx-auto" />
        <p className="text-lg font-semibold text-slate-200">
          {booking.status === 'FUNDED' ? 'Booking Already Funded' : `Status: ${booking.status}`}
        </p>
        <a href="/dashboard" className="btn-primary inline-flex">Go to Dashboard</a>
      </div>
    )
  }

  return (
    <div className="page-container py-8 max-w-lg mx-auto">
      <h1 className="section-title mb-6">Fund Escrow</h1>

      {/* Booking summary */}
      <div className="card space-y-3 mb-6">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <span className="font-semibold text-slate-100">{booking.wall.title}</span>
          <span className="text-xs text-slate-500">{booking.wall.city}</span>
        </div>
        {[
          ['Dates',     `${new Date(booking.startDate).toLocaleDateString()} – ${new Date(booking.endDate).toLocaleDateString()}`],
          ['Area',      `${booking.areaSqft} sqft`],
          ['Installer', booking.installerAddress ? booking.installerAddress.slice(0,10)+'...' : 'Same as owner'],
          ['Wall Owner',booking.wall.ownerAddress.slice(0,10)+'...'],
        ].map(([k,v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-slate-500">{k}</span>
            <span className="text-slate-200 font-mono text-xs">{v}</span>
          </div>
        ))}
        <div className="flex justify-between pt-3 border-t border-surface-border font-bold">
          <span className="text-slate-300">Total Escrow</span>
          <span className="text-brand text-xl">{booking.totalBnb} BNB</span>
        </div>
      </div>

      {/* Escrow explanation */}
      <div className="flex items-start gap-3 p-4 bg-brand/5 border border-brand/20 rounded-xl mb-6">
        <Shield size={20} className="text-brand shrink-0 mt-0.5" />
        <div className="text-sm text-slate-400 space-y-1">
          <p><strong className="text-slate-300">How escrow works:</strong></p>
          <p>Your BNB is locked in the smart contract — not held by any platform.</p>
          <p>It&apos;s released to the wall owner <em>only after you approve</em> the installation proof.</p>
          <p>If the installer ghosts, you reclaim after 14 days automatically.</p>
        </div>
      </div>

      {/* Errors */}
      {(error || txError) && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error || (txError instanceof Error ? txError.message : 'Transaction failed')}
        </div>
      )}

      {/* Tx status */}
      {txHash && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className={isSuccess ? 'text-emerald-400' : 'text-blue-400'}>
              {isConfirming ? 'Confirming...' : isSuccess ? 'Confirmed!' : 'Submitted'}
            </span>
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand text-xs flex items-center gap-1 hover:underline"
            >
              View on BscScan <ExternalLink size={11} />
            </a>
          </div>
          {isConfirming && <div className="mt-2 h-1 bg-surface-border rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-brand animate-pulse rounded-full" />
          </div>}
        </div>
      )}

      {isSuccess ? (
        <div className="text-center space-y-2">
          <CheckCircle size={48} className="text-emerald-400 mx-auto" />
          <p className="font-semibold text-slate-200">Escrow funded successfully!</p>
          <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
        </div>
      ) : wrongChain ? (
        <button
          className="btn-primary w-full py-4"
          onClick={() => switchChain({ chainId: CHAIN_ID })}
        >
          Switch to {CHAIN_ID === 97 ? 'BNB Testnet' : 'BNB Chain'}
        </button>
      ) : (
        <button
          className="btn-primary w-full py-4 text-base"
          onClick={handlePay}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming
            ? <><Loader2 size={18} className="animate-spin" /> {isPending ? 'Confirm in wallet...' : 'Confirming...'}</>
            : <><Shield size={18} /> Fund Escrow — {booking.totalBnb} BNB</>
          }
        </button>
      )}

      <p className="text-xs text-center text-slate-600 mt-3">
        Contract: {ESCROW_ADDRESS_SHORT} on {CHAIN_ID === 97 ? 'BNB Testnet' : 'BNB Mainnet'}
      </p>
    </div>
  )
}

const ESCROW_ADDRESS_SHORT = (() => {
  const addr = process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '0x000...000'
  return addr.slice(0, 8) + '...' + addr.slice(-6)
})()
