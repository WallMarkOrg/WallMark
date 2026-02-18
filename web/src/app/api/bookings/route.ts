import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/db'
import { calculatePrice, calculateDays, VISIBILITY_MULTIPLIERS } from '@/lib/pricing'

// GET /api/bookings — list bookings for a user
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const advertiserAddress = searchParams.get('advertiserAddress')
  const installerAddress  = searchParams.get('installerAddress')
  const wallId            = searchParams.get('wallId')

  if (!advertiserAddress && !installerAddress && !wallId) {
    return NextResponse.json({ error: 'Provide advertiserAddress, installerAddress, or wallId' }, { status: 400 })
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        ...(advertiserAddress && {
          advertiser: { walletAddress: { equals: advertiserAddress, mode: 'insensitive' } }
        }),
        ...(installerAddress && {
          installer: { walletAddress: { equals: installerAddress, mode: 'insensitive' } }
        }),
        ...(wallId && { wallId }),
      },
      include: {
        wall:      { include: { owner: { select: { walletAddress: true } } } },
        advertiser: { select: { walletAddress: true } },
        installer:  { select: { walletAddress: true } },
        proof:      true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      bookings.map((b: typeof bookings[0]) => ({
        ...b,
        advertiserAddress: b.advertiser.walletAddress,
        installerAddress:  b.installer?.walletAddress || null,
        wall: { ...b.wall, ownerAddress: b.wall.owner.walletAddress },
        startDate:       b.startDate.toISOString(),
        endDate:         b.endDate.toISOString(),
        createdAt:       b.createdAt.toISOString(),
        updatedAt:       b.updatedAt.toISOString(),
        disputeDeadline: b.disputeDeadline?.toISOString() || null,
        proof: b.proof ? {
          ...b.proof,
          submittedAt: b.proof.submittedAt.toISOString(),
          decidedAt:   b.proof.decidedAt?.toISOString() || null,
        } : null,
      }))
    )
  } catch (e) {
    console.error('[GET /api/bookings]', e)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

// POST /api/bookings — create booking record (pre-payment)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { advertiserAddress, wallId, installerAddress, startDate, endDate, artworkCid } = body

    if (!advertiserAddress || !wallId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Load wall for pricing
    const wall = await prisma.wall.findUnique({ where: { id: wallId } })
    if (!wall) return NextResponse.json({ error: 'Wall not found' }, { status: 404 })
    if (!wall.areaSqft) return NextResponse.json({ error: 'Wall dimensions not set' }, { status: 400 })

    const days   = calculateDays(new Date(startDate), new Date(endDate))
    const { totalBnb, totalWei } = calculatePrice(
      wall.areaSqft, wall.pricePerSqftDay, wall.visibilityTier, days
    )
    const mult   = VISIBILITY_MULTIPLIERS[wall.visibilityTier]?.mult || 1.0

    // Upsert advertiser user
    const advertiser = await prisma.user.upsert({
      where:  { walletAddress: advertiserAddress.toLowerCase() },
      create: { walletAddress: advertiserAddress.toLowerCase() },
      update: {},
    })

    // Upsert installer user (may be same as wall owner)
    const effectiveInstaller = installerAddress || wall.ownerId
    let installer = null
    if (installerAddress) {
      installer = await prisma.user.upsert({
        where:  { walletAddress: installerAddress.toLowerCase() },
        create: { walletAddress: installerAddress.toLowerCase(), isInstaller: true },
        update: { isInstaller: true },
      })
    }

    const booking = await prisma.booking.create({
      data: {
        advertiserId:    advertiser.id,
        wallId,
        installerId:     installer?.id || null,
        startDate:       new Date(startDate),
        endDate:         new Date(endDate),
        areaSqft:        wall.areaSqft,
        pricePerSqftDay: wall.pricePerSqftDay,
        visibilityMult:  mult,
        totalBnb:        totalBnb,
        chainId:         parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97'),
        status:          'PENDING_PAYMENT',
        artworkCid:      artworkCid || null,
      },
      include: {
        wall:      { include: { owner: { select: { walletAddress: true } } } },
        advertiser: { select: { walletAddress: true } },
        installer:  { select: { walletAddress: true } },
      },
    })

    return NextResponse.json({
      booking: {
        ...booking,
        advertiserAddress: booking.advertiser.walletAddress,
        installerAddress:  booking.installer?.walletAddress || null,
        wall: { ...booking.wall, ownerAddress: booking.wall.owner.walletAddress },
        startDate:  booking.startDate.toISOString(),
        endDate:    booking.endDate.toISOString(),
        createdAt:  booking.createdAt.toISOString(),
        updatedAt:  booking.updatedAt.toISOString(),
        proof:      null,
      }
    }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/bookings]', e)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
