// Domain types shared across the app

export type WallStatus   = 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED'
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'FUNDED'
  | 'PROOF_SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'

export interface Wall {
  id:               string
  ownerId:          string
  ownerAddress:     string
  title:            string
  description:      string | null
  addressText:      string
  city:             string
  country:          string
  latitude:         number
  longitude:        number
  areaSqft:         number | null
  widthFt:          number | null
  heightFt:         number | null
  dimensionsLocked: boolean
  wallCornersJson:  string | null  // JSON: [[x,y],[x,y],[x,y],[x,y]]
  referencePhotoCid: string | null
  cvConfidence:     number | null
  pricePerSqftDay:  string
  visibilityTier:   number
  photoCids:        string[]
  status:           WallStatus
  createdAt:        string
  updatedAt:        string
}

export interface Booking {
  id:              string
  advertiserId:    string
  advertiserAddress: string
  wallId:          string
  wall:            Wall
  installerId:     string | null
  installerAddress: string | null
  startDate:       string
  endDate:         string
  areaSqft:        number
  pricePerSqftDay: string
  visibilityMult:  number
  totalBnb:        string
  chainBookingId:  string | null
  metadataHash:    string | null
  txHashFund:      string | null
  txHashProof:     string | null
  txHashSettle:    string | null
  chainId:         number
  status:          BookingStatus
  disputeDeadline: string | null
  artworkCid:      string | null
  previewCid:      string | null
  warpMatrix:      string | null
  proof:           Proof | null
  createdAt:       string
  updatedAt:       string
}

export interface Proof {
  id:                 string
  bookingId:          string
  installerId:        string
  installerAddress:   string
  beforePhotoCids:    string[]
  afterPhotoCids:     string[]
  videoCid:           string | null
  gpsLat:             number | null
  gpsLng:             number | null
  gpsAccuracyM:       number | null
  proofPackageCid:    string
  proofContentHash:   string
  submittedAt:        string
  decision:           string | null
  rejectionReason:    string | null
  rejectionReasonHash: string | null
  decidedAt:          string | null
}

export interface User {
  id:            string
  walletAddress: string
  displayName:   string | null
  email:         string | null
  isOwner:       boolean
  isInstaller:   boolean
}

// UI helpers
export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Awaiting Payment',
  FUNDED:          'Funded',
  PROOF_SUBMITTED: 'Proof Submitted',
  APPROVED:        'Approved',
  REJECTED:        'Rejected',
  EXPIRED:         'Expired',
}

export const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'text-yellow-400 bg-yellow-400/10',
  FUNDED:          'text-blue-400 bg-blue-400/10',
  PROOF_SUBMITTED: 'text-purple-400 bg-purple-400/10',
  APPROVED:        'text-emerald-400 bg-emerald-400/10',
  REJECTED:        'text-red-400 bg-red-400/10',
  EXPIRED:         'text-gray-400 bg-gray-400/10',
}
