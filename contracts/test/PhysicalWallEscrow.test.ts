import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { PhysicalWallEscrow } from '../typechain-types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { keccak256, toUtf8Bytes, encodeBytes32String, ZeroAddress } from 'ethers'

// ─── Constants ────────────────────────────────────────────────────────────────
const PROOF_DEADLINE = 14 * 24 * 60 * 60   // 14 days in seconds
const DISPUTE_WINDOW =  7 * 24 * 60 * 60   //  7 days in seconds

const ONE_BNB      = ethers.parseEther('1')
const HALF_BNB     = ethers.parseEther('0.5')
const SMALL_BNB    = ethers.parseEther('0.001')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeBookingId(advertiser: string, wallId: string, nonce: number): string {
  return keccak256(
    ethers.solidityPacked(['address', 'string', 'uint256'], [advertiser, wallId, nonce])
  )
}

function makeMetadataHash(data: object): string {
  return keccak256(toUtf8Bytes(JSON.stringify(data)))
}

function makeProofHash(cid: string): string {
  // Simulate SHA-256 of IPFS manifest content (we use keccak for tests)
  return keccak256(toUtf8Bytes(cid))
}

// ─── Fixture ──────────────────────────────────────────────────────────────────
async function deployFixture() {
  const [owner, advertiser, installer, wallOwner, stranger] =
    await ethers.getSigners()

  const factory = await ethers.getContractFactory('PhysicalWallEscrow')
  const escrow  = (await factory.deploy()) as PhysicalWallEscrow

  const bookingId   = makeBookingId(advertiser.address, 'wall-001', 1)
  const metaHash    = makeMetadataHash({ wall: 'wall-001', price: '1.0' })

  return { escrow, owner, advertiser, installer, wallOwner, stranger, bookingId, metaHash }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('PhysicalWallEscrow', function () {

  // ── Contract constants ────────────────────────────────────────────────────
  describe('Constants', function () {
    it('has correct DEFAULT_PROOF_DEADLINE (14 days)', async function () {
      const { escrow } = await loadFixture(deployFixture)
      expect(await escrow.DEFAULT_PROOF_DEADLINE()).to.equal(PROOF_DEADLINE)
    })

    it('has correct DEFAULT_DISPUTE_WINDOW (7 days)', async function () {
      const { escrow } = await loadFixture(deployFixture)
      expect(await escrow.DEFAULT_DISPUTE_WINDOW()).to.equal(DISPUTE_WINDOW)
    })
  })

  // ── fundBooking ───────────────────────────────────────────────────────────
  describe('fundBooking()', function () {
    it('stores booking with correct fields', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )

      const b = await escrow.getBooking(bookingId)
      expect(b.advertiser).to.equal(advertiser.address)
      expect(b.wallOwner).to.equal(wallOwner.address)
      expect(b.installer).to.equal(installer.address)
      expect(b.amount).to.equal(ONE_BNB)
      expect(b.metadataHash).to.equal(metaHash)
      expect(b.state).to.equal(0) // Funded
    })

    it('emits BookingFunded event', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await expect(
        escrow.connect(advertiser).fundBooking(
          bookingId, wallOwner.address, installer.address, metaHash,
          { value: ONE_BNB }
        )
      ).to.emit(escrow, 'BookingFunded')
        .withArgs(bookingId, advertiser.address, wallOwner.address,
                  installer.address, ONE_BNB, metaHash)
    })

    it('holds BNB in contract', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )

      const contractBalance = await ethers.provider.getBalance(await escrow.getAddress())
      expect(contractBalance).to.equal(ONE_BNB)
    })

    it('reverts on zero value', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await expect(
        escrow.connect(advertiser).fundBooking(
          bookingId, wallOwner.address, installer.address, metaHash,
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(escrow, 'ZeroValue')
    })

    it('reverts on duplicate bookingId', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )

      await expect(
        escrow.connect(advertiser).fundBooking(
          bookingId, wallOwner.address, installer.address, metaHash,
          { value: ONE_BNB }
        )
      ).to.be.revertedWithCustomError(escrow, 'AlreadyExists')
    })

    it('reverts when wallOwner is zero address', async function () {
      const { escrow, advertiser, installer, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await expect(
        escrow.connect(advertiser).fundBooking(
          bookingId, ZeroAddress, installer.address, metaHash,
          { value: ONE_BNB }
        )
      ).to.be.revertedWithCustomError(escrow, 'Unauthorized')
    })

    it('reverts when installer is zero address', async function () {
      const { escrow, advertiser, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await expect(
        escrow.connect(advertiser).fundBooking(
          bookingId, wallOwner.address, ZeroAddress, metaHash,
          { value: ONE_BNB }
        )
      ).to.be.revertedWithCustomError(escrow, 'Unauthorized')
    })
  })

  // ── submitProof ───────────────────────────────────────────────────────────
  describe('submitProof()', function () {
    async function fundedFixture() {
      const base = await loadFixture(deployFixture)
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } = base

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      return base
    }

    it('transitions to ProofSubmitted state', async function () {
      const { escrow, installer, bookingId } = await loadFixture(fundedFixture)
      const proofHash = makeProofHash('QmTestCID123')

      await escrow.connect(installer).submitProof(bookingId, proofHash)

      const b = await escrow.getBooking(bookingId)
      expect(b.state).to.equal(1) // ProofSubmitted
      expect(b.proofContentHash).to.equal(proofHash)
    })

    it('emits ProofSubmitted event', async function () {
      const { escrow, installer, bookingId } = await loadFixture(fundedFixture)
      const proofHash = makeProofHash('QmTestCID123')

      await expect(escrow.connect(installer).submitProof(bookingId, proofHash))
        .to.emit(escrow, 'ProofSubmitted')
    })

    it('reverts when called by non-installer', async function () {
      const { escrow, stranger, bookingId } = await loadFixture(fundedFixture)

      await expect(
        escrow.connect(stranger).submitProof(bookingId, makeProofHash('QmFake'))
      ).to.be.revertedWithCustomError(escrow, 'Unauthorized')
    })

    it('reverts when proof deadline has passed', async function () {
      const { escrow, installer, bookingId } = await loadFixture(fundedFixture)

      await time.increase(PROOF_DEADLINE + 1)

      await expect(
        escrow.connect(installer).submitProof(bookingId, makeProofHash('QmLate'))
      ).to.be.revertedWithCustomError(escrow, 'ProofDeadlineMissed')
    })

    it('reverts when booking not in Funded state', async function () {
      const { escrow, advertiser, installer, bookingId } =
        await loadFixture(fundedFixture)

      // First submission succeeds
      await escrow.connect(installer).submitProof(bookingId, makeProofHash('Qm1'))

      // Second submission should fail
      await expect(
        escrow.connect(installer).submitProof(bookingId, makeProofHash('Qm2'))
      ).to.be.revertedWithCustomError(escrow, 'InvalidState')
    })
  })

  // ── HAPPY PATH: fund → proof → approve ───────────────────────────────────
  describe('approveProof() — happy path', function () {
    async function proofSubmittedFixture() {
      const base = await loadFixture(deployFixture)
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } = base

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      await escrow.connect(installer).submitProof(bookingId, makeProofHash('QmGoodProof'))
      return base
    }

    it('releases BNB to wallOwner', async function () {
      const { escrow, advertiser, wallOwner, bookingId } =
        await loadFixture(proofSubmittedFixture)

      const ownerBefore = await ethers.provider.getBalance(wallOwner.address)
      await escrow.connect(advertiser).approveProof(bookingId)
      const ownerAfter  = await ethers.provider.getBalance(wallOwner.address)

      expect(ownerAfter - ownerBefore).to.equal(ONE_BNB)
    })

    it('sets state to Approved', async function () {
      const { escrow, advertiser, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await escrow.connect(advertiser).approveProof(bookingId)

      const b = await escrow.getBooking(bookingId)
      expect(b.state).to.equal(2)  // Approved
      expect(b.amount).to.equal(0) // amount zeroed
    })

    it('emits FundsReleased event', async function () {
      const { escrow, advertiser, wallOwner, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await expect(escrow.connect(advertiser).approveProof(bookingId))
        .to.emit(escrow, 'FundsReleased')
        .withArgs(bookingId, wallOwner.address, ONE_BNB, 2)
    })

    it('reverts when called by non-advertiser', async function () {
      const { escrow, stranger, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await expect(
        escrow.connect(stranger).approveProof(bookingId)
      ).to.be.revertedWithCustomError(escrow, 'Unauthorized')
    })

    it('reverts when called twice (double-release prevention)', async function () {
      const { escrow, advertiser, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await escrow.connect(advertiser).approveProof(bookingId)

      await expect(
        escrow.connect(advertiser).approveProof(bookingId)
      ).to.be.revertedWithCustomError(escrow, 'InvalidState')
    })
  })

  // ── REFUND PATH: fund → proof → reject ───────────────────────────────────
  describe('rejectProof() — refund path', function () {
    async function proofSubmittedFixture() {
      const base = await loadFixture(deployFixture)
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } = base

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      await escrow.connect(installer).submitProof(bookingId, makeProofHash('QmBadInstall'))
      return base
    }

    it('refunds BNB to advertiser', async function () {
      const { escrow, advertiser, bookingId } =
        await loadFixture(proofSubmittedFixture)

      const advBefore = await ethers.provider.getBalance(advertiser.address)
      const tx   = await escrow.connect(advertiser).rejectProof(bookingId, makeProofHash('wrong color'))
      const rcpt = await tx.wait()
      const gasUsed = (rcpt!.gasUsed * rcpt!.gasPrice)
      const advAfter  = await ethers.provider.getBalance(advertiser.address)

      // advAfter ≈ advBefore + ONE_BNB - gasUsed
      expect(advAfter).to.be.closeTo(advBefore + ONE_BNB - gasUsed, ethers.parseEther('0.001'))
    })

    it('sets state to Rejected', async function () {
      const { escrow, advertiser, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await escrow.connect(advertiser).rejectProof(bookingId, makeProofHash('reason'))

      const b = await escrow.getBooking(bookingId)
      expect(b.state).to.equal(3)  // Rejected
      expect(b.amount).to.equal(0)
    })

    it('reverts if rejection attempted after dispute window', async function () {
      const { escrow, advertiser, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await time.increase(DISPUTE_WINDOW + 1)

      await expect(
        escrow.connect(advertiser).rejectProof(bookingId, makeProofHash('late'))
      ).to.be.revertedWithCustomError(escrow, 'DisputeWindowClosed')
    })

    it('reverts when called by non-advertiser', async function () {
      const { escrow, stranger, bookingId } =
        await loadFixture(proofSubmittedFixture)

      await expect(
        escrow.connect(stranger).rejectProof(bookingId, makeProofHash('x'))
      ).to.be.revertedWithCustomError(escrow, 'Unauthorized')
    })
  })

  // ── TIMEOUT PATH: fund → proof → (7 days) → auto-release ─────────────────
  describe('claimAfterTimeout() — inactivity auto-release', function () {
    it('releases funds to wallOwner after dispute window', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      await escrow.connect(installer).submitProof(bookingId, makeProofHash('Qm'))

      // Fast-forward past dispute window
      await time.increase(DISPUTE_WINDOW + 1)

      const ownerBefore = await ethers.provider.getBalance(wallOwner.address)
      await escrow.connect(installer).claimAfterTimeout(bookingId)
      const ownerAfter  = await ethers.provider.getBalance(wallOwner.address)

      expect(ownerAfter - ownerBefore).to.equal(ONE_BNB)
    })

    it('reverts if dispute window still open', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      await escrow.connect(installer).submitProof(bookingId, makeProofHash('Qm'))

      await expect(
        escrow.connect(installer).claimAfterTimeout(bookingId)
      ).to.be.revertedWithCustomError(escrow, 'DisputeWindowOpen')
    })

    it('canClaimTimeout() returns correct boolean', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      await escrow.connect(installer).submitProof(bookingId, makeProofHash('Qm'))

      expect(await escrow.canClaimTimeout(bookingId)).to.be.false
      await time.increase(DISPUTE_WINDOW + 1)
      expect(await escrow.canClaimTimeout(bookingId)).to.be.true
    })
  })

  // ── EXPIRED PATH: fund → (14 days) → advertiser reclaims ─────────────────
  describe('reclaimExpiredBooking() — installer no-show', function () {
    it('refunds advertiser after proof deadline', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )

      await time.increase(PROOF_DEADLINE + 1)

      const advBefore = await ethers.provider.getBalance(advertiser.address)
      const tx   = await escrow.connect(advertiser).reclaimExpiredBooking(bookingId)
      const rcpt = await tx.wait()
      const gasUsed = rcpt!.gasUsed * rcpt!.gasPrice
      const advAfter  = await ethers.provider.getBalance(advertiser.address)

      expect(advAfter).to.be.closeTo(
        advBefore + ONE_BNB - gasUsed, ethers.parseEther('0.001')
      )

      const b = await escrow.getBooking(bookingId)
      expect(b.state).to.equal(4) // Expired
    })

    it('reverts if proof deadline not reached yet', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )

      await expect(
        escrow.connect(advertiser).reclaimExpiredBooking(bookingId)
      ).to.be.revertedWithCustomError(escrow, 'ProofDeadlineNotReached')
    })

    it('reverts when called by non-advertiser', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )
      await time.increase(PROOF_DEADLINE + 1)

      await expect(
        escrow.connect(installer).reclaimExpiredBooking(bookingId)
      ).to.be.revertedWithCustomError(escrow, 'Unauthorized')
    })
  })

  // ── View helpers ──────────────────────────────────────────────────────────
  describe('View helpers', function () {
    it('disputeWindowEndsAt() returns 0 for unfunded booking', async function () {
      const { escrow, bookingId } = await loadFixture(deployFixture)
      expect(await escrow.disputeWindowEndsAt(bookingId)).to.equal(0)
    })

    it('proofDeadlineAt() returns fundedAt + 14 days', async function () {
      const { escrow, advertiser, installer, wallOwner, bookingId, metaHash } =
        await loadFixture(deployFixture)

      await escrow.connect(advertiser).fundBooking(
        bookingId, wallOwner.address, installer.address, metaHash,
        { value: ONE_BNB }
      )

      const b        = await escrow.getBooking(bookingId)
      const expected = BigInt(b.fundedAt) + BigInt(PROOF_DEADLINE)
      expect(await escrow.proofDeadlineAt(bookingId)).to.equal(expected)
    })
  })

  // ── Multiple concurrent bookings ──────────────────────────────────────────
  describe('Multiple concurrent bookings', function () {
    it('handles multiple independent bookings correctly', async function () {
      const { escrow, advertiser, installer, wallOwner, metaHash } =
        await loadFixture(deployFixture)

      const id1 = makeBookingId(advertiser.address, 'wall-001', 1)
      const id2 = makeBookingId(advertiser.address, 'wall-002', 2)
      const id3 = makeBookingId(advertiser.address, 'wall-003', 3)

      await escrow.connect(advertiser).fundBooking(
        id1, wallOwner.address, installer.address, metaHash, { value: ONE_BNB }
      )
      await escrow.connect(advertiser).fundBooking(
        id2, wallOwner.address, installer.address, metaHash, { value: HALF_BNB }
      )
      await escrow.connect(advertiser).fundBooking(
        id3, wallOwner.address, installer.address, metaHash, { value: SMALL_BNB }
      )

      const contractBalance = await ethers.provider.getBalance(await escrow.getAddress())
      expect(contractBalance).to.equal(ONE_BNB + HALF_BNB + SMALL_BNB)

      // Approve id1, reject id2, leave id3 funded
      await escrow.connect(installer).submitProof(id1, makeProofHash('p1'))
      await escrow.connect(installer).submitProof(id2, makeProofHash('p2'))

      await escrow.connect(advertiser).approveProof(id1)
      await escrow.connect(advertiser).rejectProof(id2, makeProofHash('r2'))

      // Contract should only hold id3's amount
      const remaining = await ethers.provider.getBalance(await escrow.getAddress())
      expect(remaining).to.equal(SMALL_BNB)
    })
  })
})
