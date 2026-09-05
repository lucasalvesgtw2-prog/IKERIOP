import { type Deal, type PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type DealState } from '../domain/deal/state.js';
import { writeAudit } from './auditService.js';
import { applyTransition, assertDealStatus } from './dealTransition.js';

const log = createLogger('completion-service');

/**
 * Completion confirmations.
 *
 * Both parties must independently confirm that the deal itself is finished
 * before any payout is possible. The two confirmations are separate boolean
 * facts on the deal, each written with its own guarded update, so:
 *
 *  * the order they arrive in does not matter;
 *  * clicking twice is a no-op rather than a second confirmation; and
 *  * one party can never confirm on the other's behalf — the caller's identity
 *    decides which flag is written, and it is checked here, not by the button.
 */
export type CompletionParty = 'buyer' | 'seller';

export interface CompletionState {
  deal: Deal;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  bothConfirmed: boolean;
  /** True when this call is what completed the pair. */
  justCompleted: boolean;
}

export class CompletionService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Opens the "carry out the deal" phase once the payment is confirmed. */
  async beginDeal(input: { deal: Deal; actorDiscordId?: string }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['PAYMENT_CONFIRMED']);

    return this.prisma.$transaction((tx) =>
      applyTransition(tx, {
        dealId: input.deal.id,
        from: 'PAYMENT_CONFIRMED',
        to: 'DEAL_IN_PROGRESS',
        actorDiscordId: input.actorDiscordId ?? null,
        reason: 'Funds are in escrow; the deal can proceed',
      }),
    );
  }

  /** Opens the confirmation step. Either party clicking first triggers it. */
  async openConfirmations(input: { deal: Deal; actorDiscordId: string }): Promise<Deal> {
    if ((input.deal.status as DealState) === 'WAITING_FOR_COMPLETION_CONFIRMATIONS') {
      return input.deal;
    }

    assertDealStatus(input.deal.status as DealState, ['DEAL_IN_PROGRESS']);

    return this.prisma.$transaction((tx) =>
      applyTransition(tx, {
        dealId: input.deal.id,
        from: 'DEAL_IN_PROGRESS',
        to: 'WAITING_FOR_COMPLETION_CONFIRMATIONS',
        actorDiscordId: input.actorDiscordId,
        reason: 'Waiting for both parties to confirm completion',
      }),
    );
  }

  /**
   * Determines which side the actor is, refusing anyone else.
   *
   * Doing this from the stored deal rather than from the button means a
   * participant cannot confirm as the other party by using their control.
   */
  partyOf(deal: Deal, discordId: string): CompletionParty {
    if (deal.buyerDiscordId === discordId) return 'buyer';
    if (deal.sellerDiscordId === discordId) return 'seller';

    throw new ForbiddenError(
      `Actor ${discordId} is not a party to deal ${deal.id}`,
      'Only the Buyer and the Seller can confirm that the deal is complete.',
    );
  }

  /**
   * Records one party's confirmation.
   *
   * The write is guarded on the flag still being false, so a double click is
   * absorbed silently instead of being counted twice or raising an error at
   * the user.
   */
  async confirm(input: {
    deal: Deal;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<CompletionState> {
    const party = this.partyOf(input.deal, input.actorDiscordId);

    assertDealStatus(
      input.deal.status as DealState,
      [
        'DEAL_IN_PROGRESS',
        'WAITING_FOR_COMPLETION_CONFIRMATIONS',
        'BUYER_COMPLETED',
        'SELLER_COMPLETED',
      ],
      'The deal is not at the completion stage yet.',
    );

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.deal.findUnique({ where: { id: input.deal.id } });

      if (!current) {
        throw new ConflictError(
          `Deal ${input.deal.id} disappeared`,
          'This deal could not be found. Please contact support.',
        );
      }

      const field = party === 'buyer' ? 'buyerCompleted' : 'sellerCompleted';
      const alreadyConfirmed = party === 'buyer' ? current.buyerCompleted : current.sellerCompleted;

      if (!alreadyConfirmed) {
        const updated = await tx.deal.updateMany({
          where: { id: current.id, [field]: false },
          data: {
            [field]: true,
            [party === 'buyer' ? 'buyerCompletedAt' : 'sellerCompletedAt']: new Date(),
            version: { increment: 1 },
          },
        });

        if (updated.count > 0) {
          await writeAudit(tx, {
            action: party === 'buyer' ? 'BUYER_COMPLETED' : 'SELLER_COMPLETED',
            dealId: current.id,
            actorDiscordId: input.actorDiscordId,
            correlationId: input.correlationId ?? null,
            metadata: { party },
          });
        }
      }

      const refreshed = await tx.deal.findUnique({ where: { id: current.id } });

      if (!refreshed) {
        throw new ConflictError(
          `Deal ${current.id} disappeared during confirmation`,
          'This deal could not be updated. Please contact support.',
        );
      }

      const buyerConfirmed = refreshed.buyerCompleted;
      const sellerConfirmed = refreshed.sellerCompleted;
      const bothConfirmed = buyerConfirmed && sellerConfirmed;

      // The intermediate states record who confirmed first. Only when both
      // have confirmed does the deal reach the payout track.
      const status = refreshed.status as DealState;
      let deal = refreshed;

      if (status === 'WAITING_FOR_COMPLETION_CONFIRMATIONS') {
        deal = await applyTransition(tx, {
          dealId: refreshed.id,
          from: status,
          to: party === 'buyer' ? 'BUYER_COMPLETED' : 'SELLER_COMPLETED',
          actorDiscordId: input.actorDiscordId,
          reason: `${party} confirmed completion`,
        });
      }

      if (bothConfirmed) {
        const from = deal.status as DealState;

        if (from === 'BUYER_COMPLETED' || from === 'SELLER_COMPLETED') {
          deal = await applyTransition(tx, {
            dealId: deal.id,
            from,
            to: 'READY_FOR_PAYOUT_ADDRESS',
            actorDiscordId: input.actorDiscordId,
            reason: 'Both parties confirmed completion',
          });
        }
      }

      log.info(
        { dealId: deal.id, party, buyerConfirmed, sellerConfirmed, bothConfirmed },
        'completion confirmation recorded',
      );

      return {
        deal,
        buyerConfirmed,
        sellerConfirmed,
        bothConfirmed,
        justCompleted: bothConfirmed && !alreadyConfirmed,
      };
    });
  }
}
