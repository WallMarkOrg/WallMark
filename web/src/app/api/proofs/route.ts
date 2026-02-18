import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/db'

// POST /api/proofs — installer submits proof metadata (after IPFS upload)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      bookingId, installerAddress, beforePhotoCids, afterPhotoCids,
      videoCid, gpsLat, gpsLng, gpsAccuracyM,
      proofPackageCid, proofContentHash,
    } = body

    if (!bookingId || !installerAddress || !proofPackageCid || !proofContentHash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Look up installer user
    const installer = await prisma.user.upsert({
      where:  { walletAddress: installerAddress.toLowerCase() },
      create: { walletAddress: installerAddress.toLowerCase(), isInstaller: true },
      update: { isInstaller: true },
    })

    // Verify booking exists and is in FUNDED state
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status !== 'FUNDED') {
      return NextResponse.json({ error: `Booking is in ${booking.status} state` }, { status: 400 })
    }

    const proof = await prisma.proof.create({
      data: {
        bookingId,
        installerId:     installer.id,
        beforePhotoCids: beforePhotoCids || [],
        afterPhotoCids:  afterPhotoCids  || [],
        videoCid:        videoCid || null,
        gpsLat:          gpsLat  ? parseFloat(gpsLat)  : null,
        gpsLng:          gpsLng  ? parseFloat(gpsLng)  : null,
        gpsAccuracyM:    gpsAccuracyM ? parseFloat(gpsAccuracyM) : null,
        proofPackageCid,
        proofContentHash,
      },
    })

    // Advance booking to PROOF_SUBMITTED
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status:          'PROOF_SUBMITTED',
        disputeDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({ proof }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/proofs]', e)
    return NextResponse.json({ error: 'Failed to create proof' }, { status: 500 })
  }
}
