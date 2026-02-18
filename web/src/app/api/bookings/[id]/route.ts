import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/db'

// GET /api/bookings/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        wall:       { include: { owner: { select: { walletAddress: true } } } },
        advertiser: { select: { walletAddress: true } },
        installer:  { select: { walletAddress: true } },
        proof:      true,
      },
    })
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      ...booking,
      advertiserAddress: booking.advertiser.walletAddress,
      installerAddress:  booking.installer?.walletAddress || null,
      wall: { ...booking.wall, ownerAddress: booking.wall.owner.walletAddress },
      startDate:       booking.startDate.toISOString(),
      endDate:         booking.endDate.toISOString(),
      createdAt:       booking.createdAt.toISOString(),
      updatedAt:       booking.updatedAt.toISOString(),
      disputeDeadline: booking.disputeDeadline?.toISOString() || null,
      proof: booking.proof ? {
        ...booking.proof,
        submittedAt: booking.proof.submittedAt.toISOString(),
        decidedAt:   booking.proof.decidedAt?.toISOString() || null,
      } : null,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

// PATCH /api/bookings/[id] — update booking state (called by frontend after on-chain events)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const {
      status, chainBookingId, metadataHash,
      txHashFund, txHashProof, txHashSettle,
      disputeDeadline, previewCid, warpMatrix,
    } = body

    // When proof is submitted, compute the dispute deadline (7 days from now)
    const computedDisputeDeadline =
      status === 'PROOF_SUBMITTED' && !disputeDeadline
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : disputeDeadline
        ? new Date(disputeDeadline)
        : undefined

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        ...(status          && { status }),
        ...(chainBookingId  && { chainBookingId }),
        ...(metadataHash    && { metadataHash }),
        ...(txHashFund      && { txHashFund }),
        ...(txHashProof     && { txHashProof }),
        ...(txHashSettle    && { txHashSettle }),
        ...(computedDisputeDeadline && { disputeDeadline: computedDisputeDeadline }),
        ...(previewCid      && { previewCid }),
        ...(warpMatrix      && { warpMatrix }),
      },
    })
    return NextResponse.json({ booking })
  } catch (e) {
    console.error('[PATCH /api/bookings]', e)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
