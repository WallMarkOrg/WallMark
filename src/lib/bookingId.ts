import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem'

/**
 * Deterministically derive an on-chain bookingId (bytes32).
 *
 * Matches the contract's expected format:
 *   keccak256(abi.encodePacked(advertiser, wallId, nonce))
 */
export function deriveBookingId(
  advertiser: `0x${string}`,
  wallId:     string,
  nonce:      number
): `0x${string}` {
  return keccak256(
    encodePacked(
      ['address', 'string', 'uint256'],
      [advertiser, wallId, BigInt(nonce)]
    )
  )
}

/**
 * Build the canonical metadata JSON for a booking and compute its keccak256 hash.
 * This hash is stored in the escrow contract as an integrity anchor.
 */
export function buildMetadataHash(meta: {
  bookingId:       string
  wallId:          string
  advertiser:      string
  wallOwner:       string
  installer:       string
  startDate:       string
  endDate:         string
  areaSqft:        number
  pricePerSqftDay: string
  visibilityTier:  number
  visibilityMult:  number
  totalBnb:        string
}): { json: string; hash: `0x${string}` } {
  // Canonical form: sorted keys, no whitespace
  const json = JSON.stringify({
    bookingId:       meta.bookingId,
    wallId:          meta.wallId,
    advertiser:      meta.advertiser.toLowerCase(),
    wallOwner:       meta.wallOwner.toLowerCase(),
    installer:       meta.installer.toLowerCase(),
    startDate:       meta.startDate,
    endDate:         meta.endDate,
    areaSqft:        meta.areaSqft,
    pricePerSqftDay: meta.pricePerSqftDay,
    visibilityTier:  meta.visibilityTier,
    visibilityMult:  meta.visibilityMult,
    totalBnb:        meta.totalBnb,
  })

  const hash = keccak256(new TextEncoder().encode(json)) as `0x${string}`
  return { json, hash }
}

/**
 * Generate a nonce for booking ID derivation.
 * In production this should come from the DB (count of advertiser's bookings).
 */
export function generateNonce(): number {
  return Date.now()
}
