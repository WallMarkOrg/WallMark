/**
 * IPFS utilities using Pinata.
 * Server-side: uses Pinata JWT (secure).
 * Client-side: reads only, uses public gateway.
 */

const PINATA_JWT      = process.env.PINATA_JWT
const PINATA_GATEWAY  = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud'

// ── Upload file to IPFS via Pinata API (server-side only) ───────────────────

export async function uploadFileToPinata(
  fileBuffer: Buffer,
  filename:   string,
  mimeType:   string
): Promise<string> {
  if (!PINATA_JWT) throw new Error('PINATA_JWT not configured')

  const formData = new FormData()
  const blob     = new Blob([new Uint8Array(fileBuffer)], { type: mimeType })
  formData.append('file', blob, filename)
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method:  'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body:    formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinata upload failed: ${err}`)
  }

  const data = await res.json()
  return data.IpfsHash as string  // CIDv1 string
}

// ── Upload JSON to IPFS via Pinata (server-side only) ───────────────────────

export async function uploadJsonToPinata(
  data:    object,
  name:    string
): Promise<{ cid: string; contentHash: string }> {
  if (!PINATA_JWT) throw new Error('PINATA_JWT not configured')

  const jsonStr = JSON.stringify(data, null, 0)
  const jsonBuf = new TextEncoder().encode(jsonStr)

  // Compute SHA-256 of content (32 bytes → 0x hex)
  const hashBuf     = await crypto.subtle.digest('SHA-256', jsonBuf)
  const contentHash = '0x' + Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: { name },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinata JSON upload failed: ${err}`)
  }

  const result = await res.json()
  return { cid: result.IpfsHash as string, contentHash }
}

// ── Gateway URL builders ─────────────────────────────────────────────────────

export function ipfsUrl(cid: string): string {
  return `${PINATA_GATEWAY}/ipfs/${cid}`
}

export function ipfsImageUrl(cid: string | null | undefined): string {
  if (!cid) return '/placeholder-wall.jpg'
  return ipfsUrl(cid)
}

// ── Compute SHA-256 of an ArrayBuffer (client-side compatible) ──────────────

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf =
    typeof data === 'string'
      ? new TextEncoder().encode(data).buffer
      : data
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return '0x' + Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
