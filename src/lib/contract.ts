// Auto-updated by deploy script — also editable manually

export const ESCROW_ADDRESS =
  (process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`) ||
  '0x0000000000000000000000000000000000000000'

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97)

export const ESCROW_ABI = [
  // ── Write functions ──────────────────────────────────────────────────────
  {
    name: 'fundBooking',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'bookingId',    type: 'bytes32' },
      { name: 'wallOwner',    type: 'address' },
      { name: 'installer',    type: 'address' },
      { name: 'metadataHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'submitProof',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bookingId',        type: 'bytes32' },
      { name: 'proofContentHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'approveProof',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'rejectProof',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bookingId',           type: 'bytes32' },
      { name: 'rejectionReasonHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'claimAfterTimeout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'reclaimExpiredBooking',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [],
  },

  // ── View functions ───────────────────────────────────────────────────────
  {
    name: 'getBooking',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'advertiser',       type: 'address' },
          { name: 'amount',           type: 'uint96'  },
          { name: 'wallOwner',        type: 'address' },
          { name: 'fundedAt',         type: 'uint64'  },
          { name: 'proofDeadlineSec', type: 'uint32'  },
          { name: 'installer',        type: 'address' },
          { name: 'proofSubmittedAt', type: 'uint64'  },
          { name: 'state',            type: 'uint8'   },
          { name: 'disputeWindowSec', type: 'uint24'  },
          { name: 'proofContentHash', type: 'bytes32' },
          { name: 'metadataHash',     type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'disputeWindowEndsAt',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'proofDeadlineAt',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'canClaimTimeout',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'bookingId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'DEFAULT_PROOF_DEADLINE',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint32' }],
  },
  {
    name: 'DEFAULT_DISPUTE_WINDOW',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint24' }],
  },

  // ── Events ───────────────────────────────────────────────────────────────
  {
    name: 'BookingFunded',
    type: 'event',
    inputs: [
      { name: 'bookingId',    type: 'bytes32', indexed: true  },
      { name: 'advertiser',   type: 'address', indexed: true  },
      { name: 'wallOwner',    type: 'address', indexed: true  },
      { name: 'installer',    type: 'address', indexed: false },
      { name: 'amount',       type: 'uint96',  indexed: false },
      { name: 'metadataHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'ProofSubmitted',
    type: 'event',
    inputs: [
      { name: 'bookingId',        type: 'bytes32', indexed: true  },
      { name: 'proofContentHash', type: 'bytes32', indexed: false },
      { name: 'submittedAt',      type: 'uint64',  indexed: false },
    ],
  },
  {
    name: 'FundsReleased',
    type: 'event',
    inputs: [
      { name: 'bookingId',  type: 'bytes32', indexed: true  },
      { name: 'recipient',  type: 'address', indexed: true  },
      { name: 'amount',     type: 'uint96',  indexed: false },
      { name: 'finalState', type: 'uint8',   indexed: false },
    ],
  },

  // ── Custom Errors ────────────────────────────────────────────────────────
  { name: 'Unauthorized',            type: 'error', inputs: [] },
  { name: 'InvalidState',            type: 'error', inputs: [] },
  { name: 'ZeroValue',               type: 'error', inputs: [] },
  { name: 'AlreadyExists',           type: 'error', inputs: [] },
  { name: 'TransferFailed',          type: 'error', inputs: [] },
  { name: 'DisputeWindowOpen',       type: 'error', inputs: [] },
  { name: 'DisputeWindowClosed',     type: 'error', inputs: [] },
  { name: 'ProofDeadlineMissed',     type: 'error', inputs: [] },
  { name: 'ProofDeadlineNotReached', type: 'error', inputs: [] },
] as const

// BookingState enum mirror
export const BookingState = {
  Funded:         0,
  ProofSubmitted: 1,
  Approved:       2,
  Rejected:       3,
  Expired:        4,
} as const

export type BookingStateValue = (typeof BookingState)[keyof typeof BookingState]

export const EXPLORER_BASE =
  CHAIN_ID === 56
    ? 'https://bscscan.com'
    : 'https://testnet.bscscan.com'
