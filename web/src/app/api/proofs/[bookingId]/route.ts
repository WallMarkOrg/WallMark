import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/db'

// PATCH /api/proofs/[bookingId] — record advertiser decision
export async function PATCH(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const body = await req.json()
    const { decision, rejectionReason, rejectionReasonHash } = body

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 })
    }

    const proof = await prisma.proof.update({
      where: { bookingId: params.bookingId },
      data: {
        decision,
        rejectionReason:     rejectionReason     || null,
        rejectionReasonHash: rejectionReasonHash || null,
        decidedAt:           new Date(),
      },
    })

    return NextResponse.json({ proof })
  } catch (e) {
    console.error('[PATCH /api/proofs]', e)
    return NextResponse.json({ error: 'Failed to update proof' }, { status: 500 })
  }
}
