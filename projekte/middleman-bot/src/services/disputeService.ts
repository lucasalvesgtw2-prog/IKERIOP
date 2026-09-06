import { type Deal, type Dispute, type PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { validateTextField } from '../core/text.js';
import { DISPUTABLE_STATES, isPayoutInFlight, type DealState } from '../domain/deal/state.js';
import { writeAudit } from './auditService.js';
import { applyTransition } from './dealTransition.js';

const log = createLogger('dispute-service');

export const DISPUTE_REASON_LIMITS = { min: 10, max: 1_500 } as const;

/**
 * Disputes.
 *
 * Opening a dispute freezes the deal: the payout is blocked and only staff can
 * decide what happens next. Two rules shape the design:
 *
 *  * A dispute cannot be opened once a payout is in flight. Un-freezing such a
 *    deal could otherwise produce a second payout, and the state machine
 *    enforces the same thing independently.
 *  * Resolving a dispute never broadcasts anything. It returns the deal to the
 *    payout *review* step at the earliest, so a payout is still explicitly
 *    authorised by a human afterwards.
 */
export type DisputeResolution =
  'RESOLVED_RELEASE_TO_SELLER' | 'RESOLVED_REFUND_TO_BUYER' | 'RESOLVED_OTHER';

export class DisputeService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Whether this deal can be disputed right now, and why not if it cannot. */
  canOpen(deal: Deal): { allowed: boolean; reason?: string } {
    const status = deal.status as DealState;

    if (status === 'DISPUTED') {
      return { allowed: false, reason: 'This deal is already under dispute.' };
    }

    if (isPayoutInFlight(status)) {
      return {
        allowed: false,
        reason:
          'The payout for this deal has already been sent and cannot be frozen. Please contact support directly.',
      };
    }

    if (!DISPUTABLE_STATES.has(status)) {
      return {
        allowed: false,
        reason:
          'A dispute can only be opened once the payment has been confirmed. Before that, either party can simply close the ticket.',
      };
    }

    return { allowed: true };
  }

  /**
   * Opens a dispute.
   *
   * Only a party to the deal may open one; staff act through the resolution
   * commands instead, so an "opened by" entry always names a real participant.
   */
  async open(input: {
    deal: Deal;
    openerDiscordId: string;
    rawReason: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; dispute: Dispute }> {
    if (
      input.openerDiscordId !== input.deal.buyerDiscordId &&
      input.openerDiscordId !== input.deal.sellerDiscordId
    ) {
      throw new ForbiddenError(
        `Actor ${input.openerDiscordId} is not a party to deal ${input.deal.id}`,
        'Only the Buyer and the Seller can open a dispute for this deal.',
      );
    }

    const check = this.canOpen(input.deal);

    if (!check.allowed) {
      throw new ConflictError(
        `Deal ${input.deal.id} cannot be disputed from ${input.deal.status}`,
        check.reason ?? 'This deal cannot be disputed at the moment.',
      );
    }

    const reason = validateTextField(input.rawReason, {
      label: 'Dispute reason',
      minLength: DISPUTE_REASON_LIMITS.min,
      maxLength: DISPUTE_REASON_LIMITS.max,
    });

    const frozenFrom = input.deal.status;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { discordId: input.openerDiscordId } });

      if (!user) {
        throw new NotFoundError(`User ${input.openerDiscordId} is not registered`, {
          discordId: input.openerDiscordId,
        });
      }

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: frozenFrom as DealState,
        to: 'DISPUTED',
        actorDiscordId: input.openerDiscordId,
        reason: 'Dispute opened',
      });

      const dispute = await tx.dispute.create({
        data: {
          dealId: deal.id,
          status: 'OPEN',
          openedById: user.id,
          openedByDiscordId: input.openerDiscordId,
          reason,
          // Recorded so staff can restore the deal to exactly where it was.
          frozenFromStatus: frozenFrom,
        },
      });

      await writeAudit(tx, {
        action: 'DISPUTE_OPENED',
        dealId: deal.id,
        actorDiscordId: input.openerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: { disputeId: dispute.id, frozenFromStatus: frozenFrom, reason },
      });

      log.warn(
        { dealId: deal.id, disputeId: dispute.id, frozenFrom },
        'dispute opened — payout is blocked',
      );

      return { deal, dispute };
    });
  }

  /** The open dispute for a deal, if there is one. */
  async openDisputeFor(dealId: string): Promise<Dispute | null> {
    return this.prisma.dispute.findFirst({
      where: { dealId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** A staff member takes ownership of a dispute. */
  async claim(input: { dealId: string; staffDiscordId: string }): Promise<Dispute> {
    const dispute = await this.openDisputeFor(input.dealId);

    if (!dispute) {
      throw new NotFoundError(`No open dispute for deal ${input.dealId}`, {
        dealId: input.dealId,
      });
    }

    const claimed = await this.prisma.dispute.updateMany({
      where: { id: dispute.id, status: 'OPEN' },
      data: {
        status: 'UNDER_REVIEW',
        claimedByDiscordId: input.staffDiscordId,
        claimedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new ConflictError(
        `Dispute ${dispute.id} is already claimed`,
        'This dispute has already been claimed by another staff member.',
      );
    }

    await this.prisma.supportAction.create({
      data: {
        dealId: input.dealId,
        actorDiscordId: input.staffDiscordId,
        type: 'DISPUTE_CLAIMED',
        metadata: { disputeId: dispute.id },
      },
    });

    return { ...dispute, status: 'UNDER_REVIEW' };
  }

  /**
   * Resolves a dispute.
   *
   * The outcome decides where the deal goes, and none of the destinations is a
   * broadcast:
   *
   *  * release  → back to the payout track, at the address or review step, so
   *               a human still authorises the payout afterwards;
   *  * refund   → the deal is cancelled and the refund is handled by staff
   *               out of band, because the bot has no automatic refund path;
   *  * other    → the deal is closed as completed or failed, as staff decide.
   */
  async resolve(input: {
    deal: Deal;
    staffDiscordId: string;
    resolution: DisputeResolution;
    note: string;
    correlationId?: string;
  }): Promise<Deal> {
    if ((input.deal.status as DealState) !== 'DISPUTED') {
      throw new ConflictError(
        `Deal ${input.deal.id} is not disputed`,
        'This deal is not currently under dispute.',
      );
    }

    const dispute = await this.openDisputeFor(input.deal.id);

    if (!dispute) {
      throw new NotFoundError(`No open dispute for deal ${input.deal.id}`);
    }

    const target = this.destinationFor(input.resolution, dispute.frozenFromStatus as DealState);

    return this.prisma.$transaction(async (tx) => {
      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'DISPUTED',
        to: target,
        actorDiscordId: input.staffDiscordId,
        reason: `Dispute resolved: ${input.resolution}`,
        ...(target === 'COMPLETED' ? { data: { completedAt: new Date() } } : {}),
      });

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: input.resolution,
          resolvedByDiscordId: input.staffDiscordId,
          resolvedAt: new Date(),
          resolution: input.note,
        },
      });

      await tx.supportAction.create({
        data: {
          dealId: deal.id,
          actorDiscordId: input.staffDiscordId,
          type: 'DISPUTE_RESOLVED',
          note: input.note,
          metadata: { disputeId: dispute.id, resolution: input.resolution, movedTo: target },
        },
      });

      await writeAudit(tx, {
        action: 'DISPUTE_RESOLVED',
        dealId: deal.id,
        actorDiscordId: input.staffDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          disputeId: dispute.id,
          resolution: input.resolution,
          movedTo: target,
          note: input.note,
        },
      });

      log.info(
        { dealId: deal.id, resolution: input.resolution, movedTo: target },
        'dispute resolved',
      );

      return deal;
    });
  }

  /**
   * Where a resolved deal goes.
   *
   * Never `PAYOUT_PENDING` or `PAYOUT_BROADCAST`: resolving a dispute must not
   * be able to send money on its own.
   */
  destinationFor(resolution: DisputeResolution, frozenFrom: DealState): DealState {
    switch (resolution) {
      case 'RESOLVED_RELEASE_TO_SELLER':
        // Back to review if an address was already submitted, otherwise back
        // to the address step.
        return frozenFrom === 'PAYOUT_REVIEW' || frozenFrom === 'PAYOUT_ADDRESS_SUBMITTED'
          ? 'PAYOUT_REVIEW'
          : 'READY_FOR_PAYOUT_ADDRESS';

      case 'RESOLVED_REFUND_TO_BUYER':
        // The bot has no automatic refund path; staff move the funds and the
        // deal is closed as cancelled.
        return 'CANCELLED';

      case 'RESOLVED_OTHER':
        return 'COMPLETED';
    }
  }

  /** Adds a staff note to a deal without changing its state. */
  async addNote(input: { dealId: string; staffDiscordId: string; note: string }): Promise<void> {
    await this.prisma.supportAction.create({
      data: {
        dealId: input.dealId,
        actorDiscordId: input.staffDiscordId,
        type: 'NOTE_ADDED',
        note: validateTextField(input.note, { label: 'Note', maxLength: 2_000 }),
      },
    });
  }

  async listOpen(limit = 25): Promise<Dispute[]> {
    return this.prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
