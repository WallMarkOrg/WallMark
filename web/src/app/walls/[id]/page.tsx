import { notFound }  from 'next/navigation'
import { prisma }    from '@/lib/db'
import { WallDetail } from './WallDetail'

export default async function WallPage({ params }: { params: { id: string } }) {
  const wall = await prisma.wall.findUnique({
    where: { id: params.id },
    include: { owner: true },
  })

  if (!wall) notFound()

  const serialized = {
    ...wall,
    areaSqft:  wall.areaSqft  ?? null,
    widthFt:   wall.widthFt   ?? null,
    heightFt:  wall.heightFt  ?? null,
    cvConfidence: wall.cvConfidence ?? null,
    ownerAddress: wall.owner.walletAddress,
    createdAt: wall.createdAt.toISOString(),
    updatedAt: wall.updatedAt.toISOString(),
  }

  return <WallDetail wall={serialized as any} />
}
