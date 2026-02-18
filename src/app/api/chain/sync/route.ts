import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { bscTestnet, bsc }           from 'viem/chains'
import { prisma }                    from '@/lib/db'
import { ESCROW_ABI, ESCROW_ADDRESS, CHAIN_ID } from '@/lib/contract'

// POST /api/chain/sync — poll for on-chain events and sync DB state
// Call this periodically (e.g. via cron job or Vercel Cron at /api/chain/sync)
export async function POST(req: NextRequest) {
  // Basic auth check: require a secret header to prevent public triggering
  const secret = req.headers.get('x-sync-secret')
  if (process.env.SYNC_SECRET && secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const chain  = CHAIN_ID === 56 ? bsc : bscTestnet
    const client = createPublicClient({
      chain,
      transport: http(
        CHAIN_ID === 56
          ? (process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org/')
          : (process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/')
      ),
    })

    // Get the last synced block from DB
    const lastEvent = await prisma.chainEvent.findFirst({
      where:   { chainId: CHAIN_ID },
      orderBy: { blockNumber: 'desc' },
    })
    const fromBlock = lastEvent ? BigInt(lastEvent.blockNumber) + BigInt(1) : BigInt(0)
    const toBlock   = await client.getBlockNumber()

    if (fromBlock > toBlock) {
      return NextResponse.json({ synced: 0, message: 'Already up to date' })
    }

    // Fetch all relevant events in range (max 2000 blocks per call)
    const BATCH = BigInt(2000)
    let synced  = 0

    for (let start = fromBlock; start <= toBlock; start += BATCH) {
      const end = start + BATCH - BigInt(1) < toBlock ? start + BATCH - BigInt(1) : toBlock

      const [fundedLogs, proofLogs, releasedLogs] = await Promise.all([
        client.getLogs({
          address:   ESCROW_ADDRESS,
          event:     parseAbiItem('event BookingFunded(bytes32 indexed bookingId, address indexed advertiser, address indexed wallOwner, address installer, uint96 amount, bytes32 metadataHash)'),
          fromBlock: start,
          toBlock:   end,
        }),
        client.getLogs({
          address:   ESCROW_ADDRESS,
          event:     parseAbiItem('event ProofSubmitted(bytes32 indexed bookingId, bytes32 proofContentHash, uint64 submittedAt)'),
          fromBlock: start,
          toBlock:   end,
        }),
        client.getLogs({
          address:   ESCROW_ADDRESS,
          event:     parseAbiItem('event FundsReleased(bytes32 indexed bookingId, address indexed recipient, uint96 amount, uint8 finalState)'),
          fromBlock: start,
          toBlock:   end,
        }),
      ])

      // Process BookingFunded events
      for (const log of fundedLogs) {
        const bookingIdHex = log.args.bookingId as string
        await prisma.chainEvent.upsert({
          where:  { chainId_txHash_logIndex: { chainId: CHAIN_ID, txHash: log.transactionHash!, logIndex: log.logIndex! } },
          create: {
            chainId:      CHAIN_ID,
            contractAddr: ESCROW_ADDRESS,
            txHash:       log.transactionHash!,
            blockNumber:  log.blockNumber!,
            logIndex:     log.logIndex!,
            eventName:    'BookingFunded',
            bookingIdHex,
            rawData:      log.args as any,
          },
          update: {},
        })
        // Update booking in DB
        await prisma.booking.updateMany({
          where: { chainBookingId: bookingIdHex },
          data:  { status: 'FUNDED', txHashFund: log.transactionHash },
        })
        synced++
      }

      // Process ProofSubmitted events
      for (const log of proofLogs) {
        const bookingIdHex = log.args.bookingId as string
        await prisma.chainEvent.upsert({
          where:  { chainId_txHash_logIndex: { chainId: CHAIN_ID, txHash: log.transactionHash!, logIndex: log.logIndex! } },
          create: {
            chainId:      CHAIN_ID,
            contractAddr: ESCROW_ADDRESS,
            txHash:       log.transactionHash!,
            blockNumber:  log.blockNumber!,
            logIndex:     log.logIndex!,
            eventName:    'ProofSubmitted',
            bookingIdHex,
            rawData:      log.args as any,
          },
          update: {},
        })
        await prisma.booking.updateMany({
          where: { chainBookingId: bookingIdHex },
          data: {
            status:          'PROOF_SUBMITTED',
            txHashProof:     log.transactionHash,
            disputeDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        synced++
      }

      // Process FundsReleased events
      for (const log of releasedLogs) {
        const bookingIdHex = log.args.bookingId as string
        const finalState   = log.args.finalState as number  // 2=Approved, 3=Rejected, 4=Expired
        const newStatus    = finalState === 2 ? 'APPROVED' : finalState === 3 ? 'REJECTED' : 'EXPIRED'

        await prisma.chainEvent.upsert({
          where:  { chainId_txHash_logIndex: { chainId: CHAIN_ID, txHash: log.transactionHash!, logIndex: log.logIndex! } },
          create: {
            chainId:      CHAIN_ID,
            contractAddr: ESCROW_ADDRESS,
            txHash:       log.transactionHash!,
            blockNumber:  log.blockNumber!,
            logIndex:     log.logIndex!,
            eventName:    'FundsReleased',
            bookingIdHex,
            rawData:      log.args as any,
          },
          update: {},
        })
        await prisma.booking.updateMany({
          where: { chainBookingId: bookingIdHex },
          data:  { status: newStatus as any, txHashSettle: log.transactionHash },
        })
        synced++
      }
    }

    return NextResponse.json({
      synced,
      fromBlock: fromBlock.toString(),
      toBlock:   toBlock.toString(),
    })
  } catch (e) {
    console.error('[POST /api/chain/sync]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
