# Wallad — Physical Wall Ad Marketplace

Trustless marketplace for renting physical walls for advertising, with BNB Chain smart-contract escrow.

```
Funds locked → installation happens → installer uploads proof → advertiser approves → funds released
```

No oracles. No platform custody. No automation. The advertiser has final authority over fund release.

---

## Architecture at a glance

```
wallad/
├── contracts/          Hardhat — PhysicalWallEscrow.sol
└── web/                Next.js 14 — frontend + API routes
    ├── src/app/        Pages and API handlers
    ├── src/components/ UI components (map, canvas preview, corner picker)
    ├── src/hooks/      wagmi contract hooks
    ├── src/lib/        pricing, IPFS, homography, bookingId utils
    └── prisma/         PostgreSQL schema
```

---

## Quick Start

### 1. Prerequisites

- Node.js 22+ (`nvm use 22`)
- PostgreSQL database (local, [Neon](https://neon.tech), or [Supabase](https://supabase.com))
- [Pinata](https://pinata.cloud) account (free tier is fine)
- [WalletConnect](https://cloud.walletconnect.com) project ID (free)

### 2. Web app setup

```bash
cd web

# Copy and fill in environment variables
cp .env.example .env.local
```

Edit `web/.env.local`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/wallad"
PINATA_JWT=eyJh...                          # from Pinata dashboard → API Keys
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=abc123 # from cloud.walletconnect.com
NEXT_PUBLIC_ESCROW_ADDRESS=0x...            # deployed contract address (step 4)
NEXT_PUBLIC_CHAIN_ID=97                     # 97 = BNB testnet, 56 = mainnet
```

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### 3. Deploy the smart contract (Remix IDE — easiest)

1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Create a new file `PhysicalWallEscrow.sol` — paste the contract from `contracts/contracts/PhysicalWallEscrow.sol`
3. Compile with Solidity **0.8.20**, optimizer **200 runs**, via IR enabled
4. In **Deploy & Run**:
   - Environment: **Injected Provider — MetaMask**
   - Network: **BNB Smart Chain Testnet** (chainId 97)
   - Click **Deploy**
5. Copy the deployed contract address
6. Paste it into `web/.env.local` as `NEXT_PUBLIC_ESCROW_ADDRESS`
7. Restart `npm run dev`

> **Get testnet BNB:** [testnet.binance.org/faucet-smart](https://testnet.binance.org/faucet-smart)

#### Verify on BscScan (optional)

After deployment, paste the source code at [testnet.bscscan.com/verifycontract](https://testnet.bscscan.com/verifycontract):
- Compiler: v0.8.20
- Optimisation: Yes, 200 runs
- EVM: Paris
- No constructor arguments

---

### 4. Deploy the smart contract (Hardhat CLI — alternative)

```bash
cd contracts
cp .env.example .env
# Fill in PRIVATE_KEY and BSCSCAN_API_KEY

# Use Node 22 (required for Hardhat)
nvm use 22

npm run deploy:testnet
# → writes deployed address to web/.env.local automatically
```

---

## Core User Flows

### Wall Owner
1. Connect wallet → **List Wall** (`/walls/new`)
2. Capture photo with webcam → place A4 sheet → click 4 corners to measure
3. Set price per sqft per day + visibility tier
4. Wall goes live on the map

### Advertiser
1. Browse map → select wall
2. **Book** → pick dates, upload banner artwork
3. View **perspective-warp preview** of ad on wall
4. Confirm → **Fund Escrow** (`/pay/[bookingId]`) — calls `fundBooking()` on-chain
5. After installation, go to **Review** (`/review/[bookingId]`)
6. **Approve** → `approveProof()` — releases BNB to wall owner
7. **Reject** (within 7 days) → `rejectProof()` — BNB refunded

### Installer
1. Go to **Submit Proof** (`/installer/[bookingId]`)
2. Upload before/after photos + optional video + GPS
3. Files upload to IPFS, SHA-256 of manifest computed client-side
4. Click **Submit Proof On-Chain** → `submitProof(bookingId, sha256Hash)` tx

---

## Smart Contract State Machine

```
fundBooking() ──► [FUNDED]
                      │
       submitProof()  │ (within 14 days)
                      ▼
              [PROOF_SUBMITTED]
               /              \
  approveProof()              rejectProof()         claimAfterTimeout()
  (anytime)                   (within 7 days)       (after 7 days, anyone)
       │                           │                       │
       ▼                           ▼                       ▼
  [APPROVED]                  [REJECTED]             [APPROVED]
  → wallOwner                 → advertiser           → wallOwner

  [FUNDED] + 14 days elapsed + reclaimExpiredBooking() → [EXPIRED] → advertiser
```

### Dispute handling decision matrix

| Scenario | Who acts | When | Outcome |
|---|---|---|---|
| Good install, happy advertiser | Advertiser | Anytime after proof | BNB → wall owner |
| Bad install | Advertiser | Within 7-day window | BNB → advertiser |
| Good install, advertiser ghosts | Anyone | After 7-day window | BNB → wall owner (auto) |
| Installer never shows | Advertiser | After 14-day deadline | BNB → advertiser |

---

## Pricing Formula

```
total = areaSqft × pricePerSqftDay(BNB) × visibilityMultiplier × days
```

| Tier | Multiplier | Description |
|---|---|---|
| 1 | 0.70× | Low — back alley |
| 2 | 0.85× | Below average — side street |
| 3 | 1.00× | Average — residential road |
| 4 | 1.35× | High — shopping district |
| 5 | 1.80× | Premium — CBD / transit hub |

---

## Wall Area Estimation

1. Owner places an **A4 sheet (210×297 mm)** flat against the wall in the photo
2. User taps 4 corners of the A4 sheet on the canvas overlay
3. User taps 4 corners of the wall boundary
4. Homography matrix maps image-space pixels → metric millimetres
5. Wall width and height computed; area locked permanently on first approval

---

## Chain Event Indexer

`POST /api/chain/sync` polls the contract for `BookingFunded`, `ProofSubmitted`, and `FundsReleased` events and syncs DB state. Configured to run every 5 minutes via Vercel Cron (`vercel.json`).

For local dev, call it manually:
```bash
curl -X POST http://localhost:3000/api/chain/sync
```

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PINATA_JWT` | Pinata API JWT (server-side uploads) |
| `NEXT_PUBLIC_PINATA_GATEWAY` | Public IPFS gateway URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Deployed contract address |
| `NEXT_PUBLIC_CHAIN_ID` | 97 (testnet) or 56 (mainnet) |
| `SYNC_SECRET` | Optional secret for `/api/chain/sync` auth |
| `BSC_TESTNET_RPC` | Custom RPC URL (optional) |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart contract | Solidity 0.8.20, Hardhat |
| Frontend | Next.js 14, Tailwind CSS |
| Wallet | wagmi v2, viem, RainbowKit |
| Database | PostgreSQL, Prisma |
| IPFS | Pinata |
| Map | React Leaflet, OpenStreetMap |
| Canvas CV | Custom homography (no ML dependency) |
| Chain | BNB Smart Chain (testnet chainId 97) |
