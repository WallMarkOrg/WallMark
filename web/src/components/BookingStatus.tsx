'use client'

import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Booking, STATUS_LABELS, STATUS_COLORS }               from '@/types'
import { cn }            from '@/lib/utils'
import { EXPLORER_BASE } from '@/lib/contract'

interface BookingStatusProps {
  booking: Booking
  showTimeline?: boolean
}

const STEPS = [
  { status: 'PENDING_PAYMENT', label: 'Booking Created' },
  { status: 'FUNDED',          label: 'Escrow Funded'   },
  { status: 'PROOF_SUBMITTED', label: 'Proof Submitted' },
  { status: 'APPROVED',        label: 'Approved'        },
]

const STATUS_ORDER: Record<string, number> = {
  PENDING_PAYMENT: 0,
  FUNDED:          1,
  PROOF_SUBMITTED: 2,
  APPROVED:        3,
  REJECTED:        3,
  EXPIRED:         3,
}

export function BookingStatus({ booking, showTimeline = true }: BookingStatusProps) {
  const currentOrder = STATUS_ORDER[booking.status] ?? 0
  const isTerminal   = ['APPROVED', 'REJECTED', 'EXPIRED'].includes(booking.status)

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span className={cn('badge text-sm px-3 py-1', STATUS_COLORS[booking.status])}>
          {booking.status === 'FUNDED' || booking.status === 'PROOF_SUBMITTED'
            ? <Loader2 size={12} className="animate-spin" />
            : booking.status === 'APPROVED'
            ? <CheckCircle size={12} />
            : booking.status === 'REJECTED' || booking.status === 'EXPIRED'
            ? <XCircle size={12} />
            : <Clock size={12} />
          }
          {STATUS_LABELS[booking.status]}
        </span>

        {booking.disputeDeadline && booking.status === 'PROOF_SUBMITTED' && (
          <span className="text-xs text-slate-500">
            Window closes {new Date(booking.disputeDeadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Timeline */}
      {showTimeline && (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-surface-border" />
          {STEPS.map((step, i) => {
            const done    = i < currentOrder || (isTerminal && i <= currentOrder)
            const active  = i === currentOrder && !isTerminal
            const rejected = booking.status === 'REJECTED' && i === 3
            const expired  = booking.status === 'EXPIRED'  && i === 3

            return (
              <div key={step.status} className="relative flex items-start gap-3 pb-4 last:pb-0">
                {/* Dot */}
                <div
                  className={cn(
                    'absolute -left-0.5 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    done   ? 'border-emerald-500 bg-emerald-500/20' :
                    active ? 'border-brand bg-brand/20 animate-pulse' :
                    rejected ? 'border-red-500 bg-red-500/20' :
                    expired  ? 'border-gray-500 bg-gray-500/20' :
                    'border-surface-border bg-surface'
                  )}
                >
                  {done && <CheckCircle size={8} className="text-emerald-400" />}
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
                  {rejected && <XCircle size={8} className="text-red-400" />}
                </div>

                <div className="pl-2">
                  <p className={cn(
                    'text-sm font-medium',
                    done   ? 'text-slate-300' :
                    active ? 'text-brand'     :
                    'text-slate-600'
                  )}>
                    {rejected ? 'Rejected — Refunded'
                     : expired ? 'Expired — Refunded'
                     : step.label}
                  </p>

                  {/* Tx links */}
                  {step.status === 'FUNDED' && booking.txHashFund && (
                    <a
                      href={`${EXPLORER_BASE}/tx/${booking.txHashFund}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand/70 hover:text-brand"
                    >
                      View tx →
                    </a>
                  )}
                  {step.status === 'PROOF_SUBMITTED' && booking.txHashProof && (
                    <a
                      href={`${EXPLORER_BASE}/tx/${booking.txHashProof}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand/70 hover:text-brand"
                    >
                      View tx →
                    </a>
                  )}
                  {step.status === 'APPROVED' && booking.txHashSettle && (
                    <a
                      href={`${EXPLORER_BASE}/tx/${booking.txHashSettle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand/70 hover:text-brand"
                    >
                      View tx →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
