import { NextRequest, NextResponse } from 'next/server'

const PINATA_JWT     = process.env.PINATA_JWT
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud'

// POST /api/upload — upload file or JSON to IPFS via Pinata
export async function POST(req: NextRequest) {
  if (!PINATA_JWT) {
    return NextResponse.json({ error: 'PINATA_JWT not configured' }, { status: 500 })
  }

  const contentType = req.headers.get('content-type') || ''

  // ── JSON upload ────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    try {
      const body = await req.json()
      const { json, name } = body

      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent:  json,
          pinataOptions:  { cidVersion: 1 },
          pinataMetadata: { name: name || 'wallad-json' },
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `Pinata error: ${err}` }, { status: 502 })
      }

      const data = await res.json()
      return NextResponse.json({
        cid:     data.IpfsHash,
        gateway: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`,
      })
    } catch (e) {
      return NextResponse.json({ error: 'JSON upload failed' }, { status: 500 })
    }
  }

  // ── File (multipart) upload ────────────────────────────────────────────
  try {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null
    const type     = formData.get('type') as string || 'media'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Size limit: 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
    }

    const pinataForm = new FormData()
    pinataForm.append('file', file, file.name)
    pinataForm.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))
    pinataForm.append('pinataMetadata', JSON.stringify({
      name: `wallad-${type}-${Date.now()}`
    }))

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method:  'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body:    pinataForm,
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Pinata error: ${err}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({
      cid:     data.IpfsHash,
      gateway: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`,
    })
  } catch (e) {
    console.error('[POST /api/upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

