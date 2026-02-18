import { parseEther, formatEther } from 'viem'

export const VISIBILITY_MULTIPLIERS: Record<number, { mult: number; label: string }> = {
  1: { mult: 0.70, label: 'Low — back alley, sparse foot traffic' },
  2: { mult: 0.85, label: 'Below average — side street' },
  3: { mult: 1.00, label: 'Average — residential main road' },
  4: { mult: 1.35, label: 'High — shopping district' },
  5: { mult: 1.80, label: 'Premium — CBD / transit hub' },
}

/**
 * Calculate total booking cost.
 * Returns both a human-readable string and the bigint wei value.
 *
 * Formula: areaSqft × pricePerSqftDay(BNB) × visibilityMult × days
 */
export function calculatePrice(
  areaSqft: number,
  pricePerSqftDayBnb: string, // e.g. "0.000001"
  visibilityTier: number,
  days: number
): { totalBnb: string; totalWei: bigint; breakdown: string } {
  const mult = VISIBILITY_MULTIPLIERS[visibilityTier]?.mult ?? 1.0

  // Use BigInt arithmetic to avoid floating-point precision loss
  // Scale by 1e6 to handle 6 decimal places safely
  const SCALE = BigInt(1_000_000)

  const priceWei = parseEther(pricePerSqftDayBnb)  // per sqft per day in wei

  // areaSqft * 1e6 (integer)
  const areaBig = BigInt(Math.round(areaSqft * 1_000_000))
  // mult * 1e6 (integer)
  const multBig = BigInt(Math.round(mult * 1_000_000))
  // days (integer)
  const daysBig = BigInt(days)

  // total = price × area × mult × days / (SCALE × SCALE)
  const totalWei =
    (priceWei * areaBig * multBig * daysBig) / (SCALE * SCALE)

  const totalBnb = Number(formatEther(totalWei)).toFixed(6)

  const breakdown =
    `${areaSqft} sqft × ${pricePerSqftDayBnb} BNB/sqft/day × ` +
    `${mult}x visibility × ${days} days = ${totalBnb} BNB`

  return { totalBnb, totalWei, breakdown }
}

/**
 * Derive days from two Date objects (rounded to nearest day).
 */
export function calculateDays(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay))
}

/**
 * Format a BNB amount for display.
 */
export function formatBnb(bnbString: string): string {
  const n = Number(bnbString)
  if (n < 0.001) return `${(n * 1000).toFixed(4)} mBNB`
  return `${n.toFixed(4)} BNB`
}
