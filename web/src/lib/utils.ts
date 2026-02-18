import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const e = new Date(end).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return `${s} – ${e}`
}

export function timeUntil(timestamp: bigint | number): string {
  const ms   = Number(timestamp) * 1000 - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / 86_400_000)
  const hrs  = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hrs}h remaining`
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hrs > 0) return `${hrs}h ${mins}m remaining`
  return `${mins}m remaining`
}
