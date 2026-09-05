import { type Deal, type DealDetails, type PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { parseUserUsdAmount, toDbString, type Decimal } from '../core/money.js';
import { validateTextField } from '../core/text.js';
import { type DealState } from '../domain/deal/state.js';
import {
  assertDealAmountWithinLimits,
  calculateFees,
  type FeeBreakdown,
} from '../domain/deal/fees.js';
import { writeAudit } from './auditService.js';
import { applyTransition, assertDealStatus } from './dealTransition.js';

const log = createLogger('deal-details');

/** Field limits. Enforced server-side; the modal's own limits are only a hint. */
export const DETAIL_LIMITS = {
  item: { min: 2, max: 100 },
  description: { min: 5, max: 1_000 },
  additionalTerms: { max: 1_000 },
  changeRequest: { min: 5, max: 1_000 },
} as const;

/** Raw modal input, before any validation. */
export interface RawDealDetails {
  item: string;
  description: string;
  additionalTerms: string;
  dealAmount: string;
}

/** Validated details plus the USD breakdown derived from them. */
export interface ValidatedDealDetails {
  item: string;
  description: string;
  additionalTerms: string | null;
  fees: FeeBreakdown;
}

export interface DealAmountLimits {
  minDealAmountUsd: Decimal;
  maxDealAmountUsd: Decimal;
}

/**
 * Deal details and the buyer's approval of them.
 *
 * Two rules shape this service:
 *
 *   * The deal amount is USD, always. The modal field is parsed as a plain
 *     dollar figure and anything that looks like a crypto amount is rejected
 *     outright — the settlement currency is a separate, later choice.
 *   * The buyer's approval is explicit and re-earned. Every new revision of the
 *     details clears `buyerApproved`, so a seller cannot edit a deal the buyer
 *     already agreed to and have the old approval carry over.
 */
export class DealDetailsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Validates raw modal input.
   *
   * Pure and synchronous, so the whole of it is exercised by unit tests without
   * a database — this is where a bad amount has to be stopped.
   */
  validate(
    raw: RawDealDetails,
    limits: DealAmountLimits,
    feePercentage: Decimal,
  ): ValidatedDealDetails {
    const item = validateTextField(raw.item, {
      label: 'Item / Service',
      minLength: DETAIL_LIMITS.item.min,
      maxLength: DETAIL_LIMITS.item.max,
      singleLine: true,
    });

    const description = validateTextField(raw.description, {
      label: 'Description',
      minLength: DETAIL_LIMITS.description.min,
      maxLength: DETAIL_LIMITS.description.max,
    });

    const additionalTerms = validateTextField(raw.additionalTerms, {
      label: 'Additional Terms',
      maxLength: DETAIL_LIMITS.additionalTerms.max,
      required: false,
    });

    // Throws on "0.001 BTC", "100 USD", a negative, or sub-cent precision.
    const amount = parseUserUsdAmount(raw.dealAmount);

    assertDealAmountWithinLimits(amount, {
      minDealAmountUsd: limits.minDealAmountUsd,
      maxDealAmountUsd: limits.maxDealAmountUsd,
    });

    return {
      item,
      description,
      additionalTerms: additionalTerms.length > 0 ? additionalTerms : null,
      // The fee percentage comes from the deal, not from live configuration:
      // an administrator changing the fee must not alter a deal in flight.
      fees: calculateFees(amount, feePercentage),
    };
  }

  /** The current revision of the details, or null before any were submitted. */
  async currentRevision(dealId: string): Promise<DealDetails | null> {
    return this.prisma.dealDetails.findFirst({
      where: { dealId },
      orderBy: { revision: 'desc' },
    });
  }

  /**
   * Stores a new revision of the details and asks the buyer to approve them.
   *
   * The revision number is derived inside the transaction so two submissions
   * cannot collide on `@@unique([dealId, revision])`.
   */
  async submit(input: {
    deal: Deal;
    details: ValidatedDealDetails;
    sellerDiscordId: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; revision: DealDetails }> {
    assertDealStatus(input.deal.status as DealState, ['WAITING_FOR_DEAL_DETAILS']);

    const { fees } = input.details;

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.dealDetails.findFirst({
        where: { dealId: input.deal.id },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      });

      const revisionNumber = (latest?.revision ?? 0) + 1;

      const revision = await tx.dealDetails.create({
        data: {
          dealId: input.deal.id,
          revision: revisionNumber,
          item: input.details.item,
          description: input.details.description,
          additionalTerms: input.details.additionalTerms,
          dealAmountUsd: toDbString(fees.dealAmountUsd, 2),
          submittedByDiscordId: input.sellerDiscordId,
        },
      });

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'WAITING_FOR_DEAL_DETAILS',
        to: 'WAITING_FOR_BUYER_APPROVAL',
        actorDiscordId: input.sellerDiscordId,
        reason: `Deal details submitted (revision ${revisionNumber})`,
        data: {
          item: input.details.item,
          description: input.details.description,
          additionalTerms: input.details.additionalTerms,
          dealAmountUsd: toDbString(fees.dealAmountUsd, 2),
          feeUsd: toDbString(fees.feeUsd, 2),
          buyerTotalUsd: toDbString(fees.buyerTotalUsd, 2),
          sellerPayoutUsd: toDbString(fees.sellerPayoutUsd, 2),
          // A resubmission must be approved again from scratch.
          buyerApproved: false,
          buyerApprovedAt: null,
        },
      });

      await writeAudit(tx, {
        action: 'DEAL_DETAILS_SUBMITTED',
        dealId: deal.id,
        actorDiscordId: input.sellerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          revision: revisionNumber,
          item: input.details.item,
          dealAmountUsd: fees.dealAmountUsd.toFixed(2),
          feeUsd: fees.feeUsd.toFixed(2),
          buyerTotalUsd: fees.buyerTotalUsd.toFixed(2),
          feePercentage: fees.feePercentage.toString(),
        },
      });

      log.info(
        { dealId: deal.id, revision: revisionNumber, dealAmountUsd: fees.dealAmountUsd.toFixed(2) },
        'deal details submitted',
      );

      return { deal, revision };
    });
  }

  /**
   * Records the buyer's approval.
   *
   * `buyerApproved` and the state change are written in the same guarded
   * update, so the flag can never be true while the deal sits in a state that
   * predates approval, and vice versa.
   */
  async approve(input: {
    deal: Deal;
    buyerDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['WAITING_FOR_BUYER_APPROVAL']);

    return this.prisma.$transaction(async (tx) => {
      const revision = await tx.dealDetails.findFirst({
        where: { dealId: input.deal.id },
        orderBy: { revision: 'desc' },
      });

      if (!revision) {
        throw new NotFoundError(`Deal ${input.deal.id} has no details to approve`, {
          dealId: input.deal.id,
        });
      }

      const approvedAt = new Date();

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'WAITING_FOR_BUYER_APPROVAL',
        to: 'BUYER_APPROVED',
        actorDiscordId: input.buyerDiscordId,
        reason: `Buyer approved revision ${revision.revision}`,
        data: { buyerApproved: true, buyerApprovedAt: approvedAt },
      });

      await tx.dealDetails.update({
        where: { id: revision.id },
        data: { approvedAt },
      });

      await writeAudit(tx, {
        action: 'BUYER_APPROVED',
        dealId: deal.id,
        actorDiscordId: input.buyerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          revision: revision.revision,
          dealAmountUsd: String(revision.dealAmountUsd),
        },
      });

      log.info({ dealId: deal.id, revision: revision.revision }, 'buyer approved the deal');

      return deal;
    });
  }

  /**
   * Records a change request and sends the deal back to the seller.
   *
   * `buyerApproved` is explicitly cleared here as well as on resubmission: a
   * deal that is waiting for new details must never carry a stale approval,
   * whichever path it took to get there.
   */
  async requestChanges(input: {
    deal: Deal;
    buyerDiscordId: string;
    rawReason: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; reason: string }> {
    assertDealStatus(input.deal.status as DealState, ['WAITING_FOR_BUYER_APPROVAL']);

    const reason = validateTextField(input.rawReason, {
      label: 'Requested changes',
      minLength: DETAIL_LIMITS.changeRequest.min,
      maxLength: DETAIL_LIMITS.changeRequest.max,
    });

    return this.prisma.$transaction(async (tx) => {
      const revision = await tx.dealDetails.findFirst({
        where: { dealId: input.deal.id },
        orderBy: { revision: 'desc' },
      });

      if (!revision) {
        throw new NotFoundError(`Deal ${input.deal.id} has no details to reject`, {
          dealId: input.deal.id,
        });
      }

      if (revision.approvedAt) {
        throw new ConflictError(
          `Revision ${revision.revision} of deal ${input.deal.id} is already approved`,
          'This version of the deal has already been approved.',
        );
      }

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'WAITING_FOR_BUYER_APPROVAL',
        to: 'WAITING_FOR_DEAL_DETAILS',
        actorDiscordId: input.buyerDiscordId,
        reason: `Buyer requested changes to revision ${revision.revision}`,
        data: { buyerApproved: false, buyerApprovedAt: null },
      });

      await tx.dealDetails.update({
        where: { id: revision.id },
        data: { changeRequestReason: reason, rejectedAt: new Date() },
      });

      await writeAudit(tx, {
        action: 'BUYER_REQUESTED_CHANGES',
        dealId: deal.id,
        actorDiscordId: input.buyerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: { revision: revision.revision, reason },
      });

      log.info({ dealId: deal.id, revision: revision.revision }, 'buyer requested changes');

      return { deal, reason };
    });
  }
}
