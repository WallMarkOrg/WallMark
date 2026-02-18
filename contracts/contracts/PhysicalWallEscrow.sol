// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  PhysicalWallEscrow
 * @author Wallad Protocol
 * @notice Trustless escrow for physical wall advertisement bookings.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  FUND FLOW (no platform key, no oracle, no automation required)     │
 * │                                                                     │
 * │  Advertiser ──fundBooking()──► Contract (holds BNB)                 │
 * │                                    │                                │
 * │  Installer ──submitProof()─────────┤ (IPFS hash on-chain)          │
 * │                                    │                                │
 * │  Advertiser ──approveProof()───────┴──► Wall Owner receives BNB    │
 * │            ──rejectProof()─────────────► Advertiser refunded        │
 * │  (anyone) ──claimAfterTimeout()────────► Wall Owner (auto-release)  │
 * │  Advertiser ──reclaimExpired()─────────► Advertiser (no proof)      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * State Machine per booking:
 *   Funded ──► ProofSubmitted ──► Approved   (funds → wallOwner)
 *     │               └──────────► Rejected   (funds → advertiser, within window)
 *     └──────────────────────────► Expired    (installer missed deadline)
 *
 *   ProofSubmitted + window elapsed + no action ─► claimAfterTimeout ─► Approved
 *
 * @dev Reentrancy protected by zeroing amount before .call{value}.
 *      Struct packed into 4 storage slots for gas efficiency.
 */
contract PhysicalWallEscrow {

    // ─── Custom Errors (saves ~50 gas vs require strings) ───────────────────
    error Unauthorized();
    error InvalidState();
    error ZeroValue();
    error AlreadyExists();
    error TransferFailed();
    error DisputeWindowOpen();
    error DisputeWindowClosed();
    error ProofDeadlineMissed();
    error ProofDeadlineNotReached();

    // ─── State Machine ───────────────────────────────────────────────────────
    enum BookingState {
        Funded,          // 0 — escrow active, awaiting installer
        ProofSubmitted,  // 1 — IPFS proof hash on-chain, dispute window open
        Approved,        // 2 — funds released to wallOwner
        Rejected,        // 3 — funds returned to advertiser
        Expired          // 4 — installer missed deadline, advertiser refunded
    }

    /**
     * @dev Packed into exactly 4 × 32-byte storage slots:
     *   Slot 0: advertiser (20B) + amount (12B)        = 32B
     *   Slot 1: wallOwner (20B) + fundedAt (8B) + proofDeadlineSec (4B)  = 32B
     *   Slot 2: installer (20B) + proofSubmittedAt (8B) + state (1B) + disputeWindowSec (3B) = 32B
     *   Slot 3: proofContentHash (32B)
     *   Slot 4: metadataHash (32B)
     *
     *   Total: 5 slots (160 bytes) — tight for this data density.
     */
    struct Booking {
        // Slot 0
        address  advertiser;        // 20B — creates + funds the booking
        uint96   amount;            // 12B — BNB held in escrow (max ~79B BNB)

        // Slot 1
        address  wallOwner;         // 20B — receives funds on approval
        uint64   fundedAt;          // 8B  — block.timestamp of funding
        uint32   proofDeadlineSec;  // 4B  — seconds from fundedAt for installer

        // Slot 2
        address  installer;         // 20B — only address that may submit proof
        uint64   proofSubmittedAt;  // 8B  — block.timestamp of proof submission
        BookingState state;         // 1B
        uint24   disputeWindowSec;  // 3B  — seconds after proof for advertiser to act

        // Slot 3
        bytes32  proofContentHash;  // SHA-256 of IPFS proof manifest content

        // Slot 4
        bytes32  metadataHash;      // keccak256 of off-chain booking JSON (integrity anchor)
    }

    // ─── Constants ───────────────────────────────────────────────────────────
    /// @notice Maximum time installer has to submit proof after booking is funded
    uint32 public constant DEFAULT_PROOF_DEADLINE = 14 days;

    /// @notice Time window during which advertiser can reject proof after submission
    uint24 public constant DEFAULT_DISPUTE_WINDOW = 7 days;

    // ─── Storage ─────────────────────────────────────────────────────────────
    /// @notice bookingId => Booking
    mapping(bytes32 => Booking) public bookings;

    // ─── Events ──────────────────────────────────────────────────────────────
    event BookingFunded(
        bytes32 indexed bookingId,
        address indexed advertiser,
        address indexed wallOwner,
        address  installer,
        uint96   amount,
        bytes32  metadataHash
    );

    event ProofSubmitted(
        bytes32 indexed bookingId,
        bytes32 proofContentHash,
        uint64  submittedAt
    );

    event FundsReleased(
        bytes32 indexed bookingId,
        address indexed recipient,
        uint96  amount,
        BookingState finalState
    );

    // ─── Modifier ────────────────────────────────────────────────────────────
    modifier inState(bytes32 id, BookingState expected) {
        if (bookings[id].state != expected) revert InvalidState();
        _;
    }

    // =========================================================================
    // WRITE FUNCTIONS
    // =========================================================================

    /**
     * @notice Advertiser creates and funds the escrow in a single transaction.
     *
     * @param bookingId     Deterministic ID: keccak256(advertiser, wallId, nonce)
     * @param wallOwner     Address that receives funds on approval
     * @param installer     Address permitted to submit proof
     * @param metadataHash  keccak256(canonicalBookingJSON) — integrity anchor
     *
     * @dev msg.value becomes the escrowed amount.  Uses uint96 which safely
     *      covers any realistic BNB payment (max ~79 billion BNB).
     */
    function fundBooking(
        bytes32 bookingId,
        address wallOwner,
        address installer,
        bytes32 metadataHash
    ) external payable {
        if (msg.value == 0)                               revert ZeroValue();
        if (bookings[bookingId].advertiser != address(0)) revert AlreadyExists();
        if (wallOwner  == address(0))                     revert Unauthorized();
        if (installer  == address(0))                     revert Unauthorized();
        if (msg.value  > type(uint96).max)                revert ZeroValue(); // overflow guard

        bookings[bookingId] = Booking({
            advertiser:       msg.sender,
            amount:           uint96(msg.value),
            wallOwner:        wallOwner,
            fundedAt:         uint64(block.timestamp),
            proofDeadlineSec: DEFAULT_PROOF_DEADLINE,
            installer:        installer,
            proofSubmittedAt: 0,
            state:            BookingState.Funded,
            disputeWindowSec: DEFAULT_DISPUTE_WINDOW,
            proofContentHash: bytes32(0),
            metadataHash:     metadataHash
        });

        emit BookingFunded(
            bookingId, msg.sender, wallOwner, installer,
            uint96(msg.value), metadataHash
        );
    }

    /**
     * @notice Installer submits SHA-256 of IPFS proof manifest.
     *
     * @param bookingId        Booking to attach proof to
     * @param proofContentHash SHA-256(manifestBytes) — first 32 bytes of content hash
     *
     * @dev Full CID reconstructable off-chain:
     *      CIDv1 = multibase(varint(0x12) + varint(0x20) + proofContentHash)
     *      This pattern avoids storing a variable-length string and saves ~10k gas.
     */
    function submitProof(bytes32 bookingId, bytes32 proofContentHash)
        external
        inState(bookingId, BookingState.Funded)
    {
        Booking storage b = bookings[bookingId];
        if (msg.sender != b.installer) revert Unauthorized();

        unchecked {
            if (block.timestamp > uint256(b.fundedAt) + uint256(b.proofDeadlineSec))
                revert ProofDeadlineMissed();
        }

        b.proofContentHash = proofContentHash;
        b.proofSubmittedAt = uint64(block.timestamp);
        b.state            = BookingState.ProofSubmitted;

        emit ProofSubmitted(bookingId, proofContentHash, uint64(block.timestamp));
    }

    /**
     * @notice Advertiser approves installation proof.
     *         Releases escrowed BNB to wallOwner immediately.
     */
    function approveProof(bytes32 bookingId)
        external
        inState(bookingId, BookingState.ProofSubmitted)
    {
        Booking storage b = bookings[bookingId];
        if (msg.sender != b.advertiser) revert Unauthorized();

        _release(bookingId, b, b.wallOwner, BookingState.Approved);
    }

    /**
     * @notice Advertiser rejects proof within the dispute window.
     *         Refunds full escrowed amount to advertiser.
     *
     * @param rejectionReasonHash  keccak256(reasonString) stored off-chain
     */
    function rejectProof(bytes32 bookingId, bytes32 rejectionReasonHash)
        external
        inState(bookingId, BookingState.ProofSubmitted)
    {
        Booking storage b = bookings[bookingId];
        if (msg.sender != b.advertiser) revert Unauthorized();

        unchecked {
            if (block.timestamp > uint256(b.proofSubmittedAt) + uint256(b.disputeWindowSec))
                revert DisputeWindowClosed();
        }

        // Store rejection reason hash in proofContentHash slot (reuse, saves storage)
        b.proofContentHash = rejectionReasonHash;
        _release(bookingId, b, b.advertiser, BookingState.Rejected);
    }

    /**
     * @notice Auto-releases funds to wallOwner if advertiser is inactive past
     *         the dispute window.  Callable by anyone — no trust required.
     */
    function claimAfterTimeout(bytes32 bookingId)
        external
        inState(bookingId, BookingState.ProofSubmitted)
    {
        Booking storage b = bookings[bookingId];

        unchecked {
            if (block.timestamp <= uint256(b.proofSubmittedAt) + uint256(b.disputeWindowSec))
                revert DisputeWindowOpen();
        }

        _release(bookingId, b, b.wallOwner, BookingState.Approved);
    }

    /**
     * @notice Advertiser reclaims funds if installer never submits proof before
     *         the proof deadline.
     */
    function reclaimExpiredBooking(bytes32 bookingId)
        external
        inState(bookingId, BookingState.Funded)
    {
        Booking storage b = bookings[bookingId];
        if (msg.sender != b.advertiser) revert Unauthorized();

        unchecked {
            if (block.timestamp <= uint256(b.fundedAt) + uint256(b.proofDeadlineSec))
                revert ProofDeadlineNotReached();
        }

        _release(bookingId, b, b.advertiser, BookingState.Expired);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getBooking(bytes32 bookingId)
        external view returns (Booking memory)
    {
        return bookings[bookingId];
    }

    function disputeWindowEndsAt(bytes32 bookingId)
        external view returns (uint256)
    {
        Booking storage b = bookings[bookingId];
        if (b.proofSubmittedAt == 0) return 0;
        unchecked {
            return uint256(b.proofSubmittedAt) + uint256(b.disputeWindowSec);
        }
    }

    function proofDeadlineAt(bytes32 bookingId)
        external view returns (uint256)
    {
        Booking storage b = bookings[bookingId];
        if (b.fundedAt == 0) return 0;
        unchecked {
            return uint256(b.fundedAt) + uint256(b.proofDeadlineSec);
        }
    }

    function canClaimTimeout(bytes32 bookingId)
        external view returns (bool)
    {
        Booking storage b = bookings[bookingId];
        if (b.state != BookingState.ProofSubmitted) return false;
        unchecked {
            return block.timestamp > uint256(b.proofSubmittedAt) + uint256(b.disputeWindowSec);
        }
    }

    // =========================================================================
    // INTERNAL
    // =========================================================================

    /**
     * @dev Zeroes amount BEFORE transfer to prevent reentrancy.
     *      State is set before the external call as an additional guard.
     */
    function _release(
        bytes32 bookingId,
        Booking storage b,
        address recipient,
        BookingState newState
    ) internal {
        uint96 amt = b.amount;
        b.amount   = 0;       // CEI: zero storage before external call
        b.state    = newState;

        emit FundsReleased(bookingId, recipient, amt, newState);

        (bool ok,) = recipient.call{value: amt}('');
        if (!ok) revert TransferFailed();
    }
}
