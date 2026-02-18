import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/db'

// GET /api/walls — list walls with optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status       = searchParams.get('status')       || undefined
  const ownerAddress = searchParams.get('ownerAddress') || undefined
  const city         = searchParams.get('city')         || undefined

  try {
    const walls = await prisma.wall.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(city   && { city: { contains: city, mode: 'insensitive' } }),
        ...(ownerAddress && {
          owner: { walletAddress: { equals: ownerAddress, mode: 'insensitive' } }
        }),
      },
      include: { owner: { select: { walletAddress: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(
      walls.map((w: typeof walls[0]) => ({ ...w, ownerAddress: w.owner.walletAddress }))
    )
  } catch (e) {
    console.error('[GET /api/walls]', e)
    return NextResponse.json({ error: 'Failed to fetch walls' }, { status: 500 })
  }
}

// POST /api/walls — create a new wall listing
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      ownerAddress, title, description, addressText, city, country,
      latitude, longitude, photoCids, referencePhotoCid, wallCornersJson,
      areaSqft, widthFt, heightFt, pricePerSqftDay, visibilityTier,
    } = body

    if (!ownerAddress || !title || !addressText || !city || !pricePerSqftDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert user record
    const owner = await prisma.user.upsert({
      where:  { walletAddress: ownerAddress.toLowerCase() },
      create: { walletAddress: ownerAddress.toLowerCase(), isOwner: true },
      update: { isOwner: true },
    })

    const wall = await prisma.wall.create({
      data: {
        ownerId:          owner.id,
        title,
        description:      description || null,
        addressText,
        city,
        country:          country || 'US',
        latitude:         parseFloat(latitude),
        longitude:        parseFloat(longitude),
        photoCids:        photoCids || [],
        referencePhotoCid: referencePhotoCid || null,
        wallCornersJson:  wallCornersJson || null,
        areaSqft:         areaSqft  ? parseFloat(areaSqft)  : null,
        widthFt:          widthFt   ? parseFloat(widthFt)   : null,
        heightFt:         heightFt  ? parseFloat(heightFt)  : null,
        dimensionsLocked: !!(areaSqft),
        pricePerSqftDay:  pricePerSqftDay,
        visibilityTier:   parseInt(visibilityTier) || 3,
        status:           'ACTIVE', // auto-approve for MVP; add moderation queue later
      },
    })

    return NextResponse.json({ wall }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/walls]', e)
    return NextResponse.json({ error: 'Failed to create wall' }, { status: 500 })
  }
}
