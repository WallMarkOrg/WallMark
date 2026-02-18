import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/db'

// GET /api/walls/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const wall = await prisma.wall.findUnique({
      where:   { id: params.id },
      include: { owner: { select: { walletAddress: true } } },
    })
    if (!wall) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ...wall, ownerAddress: wall.owner.walletAddress })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch wall' }, { status: 500 })
  }
}

// PATCH /api/walls/[id] — partial update (owner only in production; simplified for MVP)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const {
      status, pricePerSqftDay, visibilityTier, description,
      photoCids, wallCornersJson, areaSqft, widthFt, heightFt,
    } = body

    const wall = await prisma.wall.update({
      where: { id: params.id },
      data: {
        ...(status          && { status }),
        ...(pricePerSqftDay && { pricePerSqftDay }),
        ...(visibilityTier  && { visibilityTier: parseInt(visibilityTier) }),
        ...(description     !== undefined && { description }),
        ...(photoCids       && { photoCids }),
        ...(wallCornersJson && { wallCornersJson }),
        ...(areaSqft        !== undefined && { areaSqft: parseFloat(areaSqft), dimensionsLocked: true }),
        ...(widthFt         !== undefined && { widthFt:  parseFloat(widthFt)  }),
        ...(heightFt        !== undefined && { heightFt: parseFloat(heightFt) }),
      },
    })
    return NextResponse.json({ wall })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update wall' }, { status: 500 })
  }
}
