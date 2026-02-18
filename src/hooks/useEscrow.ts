'use client'

import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi'
import { parseEther } from 'viem'
import { ESCROW_ABI, ESCROW_ADDRESS } from '@/lib/contract'

// ─── Fund a booking ──────────────────────────────────────────────────────────

export function useFundBooking() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const fund = (
    bookingId:    `0x${string}`,
    wallOwner:    `0x${string}`,
    installer:    `0x${string}`,
    metadataHash: `0x${string}`,
    totalBnb:     string
  ) =>
    writeContract({
      address:      ESCROW_ADDRESS,
      abi:          ESCROW_ABI,
      functionName: 'fundBooking',
      args:         [bookingId, wallOwner, installer, metadataHash],
      value:        parseEther(totalBnb),
    })

  return { fund, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Submit proof ────────────────────────────────────────────────────────────

export function useSubmitProof() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const submitProof = (
    bookingId:        `0x${string}`,
    proofContentHash: `0x${string}`
  ) =>
    writeContract({
      address:      ESCROW_ADDRESS,
      abi:          ESCROW_ABI,
      functionName: 'submitProof',
      args:         [bookingId, proofContentHash],
    })

  return { submitProof, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Approve proof ───────────────────────────────────────────────────────────

export function useApproveProof() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const approve = (bookingId: `0x${string}`) =>
    writeContract({
      address:      ESCROW_ADDRESS,
      abi:          ESCROW_ABI,
      functionName: 'approveProof',
      args:         [bookingId],
    })

  return { approve, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Reject proof ────────────────────────────────────────────────────────────

export function useRejectProof() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const reject = (bookingId: `0x${string}`, rejectionReasonHash: `0x${string}`) =>
    writeContract({
      address:      ESCROW_ADDRESS,
      abi:          ESCROW_ABI,
      functionName: 'rejectProof',
      args:         [bookingId, rejectionReasonHash],
    })

  return { reject, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Claim after timeout ─────────────────────────────────────────────────────

export function useClaimAfterTimeout() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const claim = (bookingId: `0x${string}`) =>
    writeContract({
      address:      ESCROW_ADDRESS,
      abi:          ESCROW_ABI,
      functionName: 'claimAfterTimeout',
      args:         [bookingId],
    })

  return { claim, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Reclaim expired booking ─────────────────────────────────────────────────

export function useReclaimExpired() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const reclaim = (bookingId: `0x${string}`) =>
    writeContract({
      address:      ESCROW_ADDRESS,
      abi:          ESCROW_ABI,
      functionName: 'reclaimExpiredBooking',
      args:         [bookingId],
    })

  return { reclaim, hash, isPending, isConfirming, isSuccess, error }
}

// ─── Read booking state from chain ───────────────────────────────────────────

export function useOnChainBooking(bookingId: `0x${string}` | undefined) {
  return useReadContract({
    address:      ESCROW_ADDRESS,
    abi:          ESCROW_ABI,
    functionName: 'getBooking',
    args:         bookingId ? [bookingId] : undefined,
    query: {
      enabled:           !!bookingId && bookingId !== ('0x' + '0'.repeat(64)),
      refetchInterval:   15_000, // poll every 15s
    },
  })
}

export function useCanClaimTimeout(bookingId: `0x${string}` | undefined) {
  return useReadContract({
    address:      ESCROW_ADDRESS,
    abi:          ESCROW_ABI,
    functionName: 'canClaimTimeout',
    args:         bookingId ? [bookingId] : undefined,
    query: {
      enabled: !!bookingId,
      refetchInterval: 30_000,
    },
  })
}

export function useDisputeWindowEndsAt(bookingId: `0x${string}` | undefined) {
  return useReadContract({
    address:      ESCROW_ADDRESS,
    abi:          ESCROW_ABI,
    functionName: 'disputeWindowEndsAt',
    args:         bookingId ? [bookingId] : undefined,
    query: { enabled: !!bookingId },
  })
}
