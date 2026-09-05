import { type Deal, type Payout, type PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { toDbString, toDecimal, type Decimal } from '../core/money.js';
import { getEnv } from '../config/env.js';
import { type AssetNetworkPair } from '../config/assets.js';
import { calculateQuote } from '../domain/deal/quotes.js';
import { type DealState } from '../domain/deal/state.js';
import { type ChainAdapter } from '../chains/ChainAdapter.js';
import { type PriceProvider } from '../prices/PriceProvider.js';
import { type Signer } from '../wallets/Signer.js';
import { ManualBroadcastRequired } from '../wallets/manualSigner.js';
import { isPrismaErrorCode, UNIQUE_VIOLATION } from '../infra/prisma.js';
import { writeAudit } from './auditService.js';
import { applyTransition, assertDealStatus } from './dealTransition.js';

const log = createLogger('payout-service');

/**
 * Payouts.
 *
 * This is the only code in the system that can move money out, so the
 * protections are layered and none of them relies on the others:
 *
 *  1. `Payout.dealId` is UNIQUE — at most one payout row can ever exist per
 *     deal, enforced by the database.
 *  2. `idempotencyKey` is derived from the deal id, so a retry addresses the
 *     same row rather than creating a second.
 *  3. `Deal.payoutLockedAt` is set when authorisation happens and is never
 *     cleared, so the authorisation step cannot run twice.
 *  4. Every state change is a guarded update on the expected previous status.
 *  5. The `Signer` contract is idempotent on the key, and the mock signer
 *     honours it too, so the guarantee is exercised in development.
 *  6. On boot, `reconcile` asks the signer about every non-final payout before
 *     any new work happens. A crash immediately after broadcasting is resolved
 *     by finding the existing transaction, never by sending again.
 *
 * A Discord click never authorises a payout. Authorisation requires a staff
 * role, and the authoriser may not be the buyer or the seller.
 */
export interface PayoutDraft {
  payout: Payout;
  deal: Deal;
}

export class PayoutService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly prices: PriceProvider,
    private readonly signer: Signer,
  ) {}

  /** Stable key for a deal's one and only payout. */
  idempotencyKeyFor(dealId: string): string {
    return `payout:${dealId}`;
  }

  async findByDeal(dealId: string): Promise<Payout | null> {
    return this.prisma.payout.findUnique({ where: { dealId } });
  }

  /**
   * Validates a payout address for the seller's chosen rail.
   *
   * The adapter decides, so the check is the real encoding/checksum/network
   * check rather than a pattern match. A Bitcoin address for an Ethereum
   * payout, or a mainnet address on testnet, is refused.
   */
  validateAddress(address: string, pair: AssetNetworkPair, adapter: ChainAdapter): string {
    const result = adapter.validateAddress(address, pair.asset.symbol);

    if (!result.valid || !result.normalized) {
      throw new ValidationError(
        `Invalid payout address for ${pair.asset.symbol}/${pair.network.id}`,
        [
          '❌ Invalid payout address.',
          '',
          result.reason ?? 'That address could not be validated.',
          '',
          'Please enter a valid address for:',
          `**${pair.asset.symbol}**`,
          `**${pair.network.label}**`,
        ].join('\n'),
      );
    }

    return result.normalized;
  }

  /**
   * Records the seller's payout address and prices the payout.
   *
   * Creating the row is guarded by the unique constraint on `dealId`: if one
   * already exists the address is updated on it, and a second row is never
   * created.
   */
  async submitAddress(input: {
    deal: Deal;
    rawAddress: string;
    normalizedAddress: string;
    pair: AssetNetworkPair;
    sellerDiscordId: string;
    correlationId?: string;
  }): Promise<PayoutDraft> {
    assertDealStatus(input.deal.status as DealState, ['READY_FOR_PAYOUT_ADDRESS']);

    const amountUsd = toDecimal(
      String(input.deal.sellerPayoutUsd ?? input.deal.dealAmountUsd ?? '0'),
    );

    if (amountUsd.lessThanOrEqualTo(0)) {
      throw new ValidationError(
        `Deal ${input.deal.id} has no payout amount`,
        'This deal has no amount to pay out.',
      );
    }

    const env = getEnv();
    const usdPrice = await this.prices.getUsdPrice(input.pair.asset.symbol);

    const quote = calculateQuote({
      usdAmount: amountUsd,
      usdPrice,
      asset: input.pair.asset,
      ttlSeconds: env.PRICE_QUOTE_TTL_SECONDS,
    });

    const requiredConfirmations =
      input.pair.network.family === 'bitcoin' ? env.CONFIRMATIONS_BTC : env.CONFIRMATIONS_ETH;

    return this.prisma.$transaction(async (tx) => {
      const quoteRow = await tx.priceQuote.create({
        data: {
          dealId: input.deal.id,
          asset: quote.asset,
          network: input.pair.network.id,
          provider: this.prices.name,
          usdPrice: toDbString(quote.usdPrice, 18),
          usdAmount: toDbString(quote.usdAmount, 2),
          cryptoAmount: toDbString(quote.cryptoAmount, 18),
          assetDecimals: quote.assetDecimals,
          quotedAt: quote.quotedAt,
          expiresAt: quote.expiresAt,
        },
      });

      const existing = await tx.payout.findUnique({ where: { dealId: input.deal.id } });

      if (existing && existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
        throw new ConflictError(
          `Payout for deal ${input.deal.id} is already ${existing.status}`,
          'A payout for this deal has already been prepared. Please contact support.',
        );
      }

      const data = {
        status: 'AWAITING_AUTHORIZATION' as const,
        asset: quote.asset,
        network: input.pair.network.id,
        amountUsd: toDbString(quote.usdAmount, 2),
        cryptoAmount: toDbString(quote.cryptoAmount, 18),
        quoteId: quoteRow.id,
        destinationAddress: input.normalizedAddress,
        destinationAddressRaw: input.rawAddress,
        requiredConfirmations,
        signerBackend: this.signer.name,
        rejectedAt: null,
        rejectionReason: null,
        rejectedByDiscordId: null,
      };

      let payout: Payout;

      try {
        payout = existing
          ? await tx.payout.update({ where: { id: existing.id }, data })
          : await tx.payout.create({
              data: {
                ...data,
                dealId: input.deal.id,
                idempotencyKey: this.idempotencyKeyFor(input.deal.id),
              },
            });
      } catch (error) {
        if (isPrismaErrorCode(error, UNIQUE_VIOLATION)) {
          throw new ConflictError(
            `A payout already exists for deal ${input.deal.id}`,
            'A payout for this deal has already been prepared.',
          );
        }
        throw error;
      }

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'READY_FOR_PAYOUT_ADDRESS',
        to: 'PAYOUT_ADDRESS_SUBMITTED',
        actorDiscordId: input.sellerDiscordId,
        reason: 'Seller submitted a payout address',
        data: {
          payoutAddress: input.normalizedAddress,
          payoutCryptoAmount: toDbString(quote.cryptoAmount, 18),
        },
      });

      await writeAudit(tx, {
        action: 'PAYOUT_ADDRESS_SUBMITTED',
        dealId: deal.id,
        actorDiscordId: input.sellerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          asset: quote.asset,
          network: input.pair.network.id,
          address: input.normalizedAddress,
          amountUsd: quote.usdAmount.toFixed(2),
          cryptoAmount: quote.cryptoAmount.toFixed(quote.assetDecimals),
          usdPrice: quote.usdPrice.toString(),
        },
      });

      return { payout, deal };
    });
  }

  /** Moves a submitted address into the staff review queue. */
  async openReview(input: { deal: Deal; actorDiscordId?: string }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['PAYOUT_ADDRESS_SUBMITTED']);

    return this.prisma.$transaction((tx) =>
      applyTransition(tx, {
        dealId: input.deal.id,
        from: 'PAYOUT_ADDRESS_SUBMITTED',
        to: 'PAYOUT_REVIEW',
        actorDiscordId: input.actorDiscordId ?? null,
        reason: 'Payout awaiting authorisation',
      }),
    );
  }

  /**
   * Authorises a payout.
   *
   * Refuses if the authoriser is a party to the deal, and sets
   * `payoutLockedAt`, which is never cleared — so this step cannot run twice
   * for the same deal even if every other guard were bypassed.
   */
  async authorize(input: {
    deal: Deal;
    authorizerDiscordId: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; payout: Payout }> {
    assertDealStatus(input.deal.status as DealState, ['PAYOUT_REVIEW']);

    if (
      input.authorizerDiscordId === input.deal.buyerDiscordId ||
      input.authorizerDiscordId === input.deal.sellerDiscordId
    ) {
      throw new ForbiddenError(
        `Party ${input.authorizerDiscordId} attempted to authorise their own deal payout`,
        'A party to the deal cannot authorise its payout. This requires a middleman or admin.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.deal.updateMany({
        where: { id: input.deal.id, status: 'PAYOUT_REVIEW', payoutLockedAt: null },
        data: { payoutLockedAt: new Date() },
      });

      if (locked.count === 0) {
        throw new ConflictError(
          `Deal ${input.deal.id} is already locked for payout`,
          'This payout has already been authorised.',
        );
      }

      const authorized = await tx.payout.updateMany({
        where: { dealId: input.deal.id, status: 'AWAITING_AUTHORIZATION' },
        data: {
          status: 'AUTHORIZED',
          authorizedByDiscordId: input.authorizerDiscordId,
          authorizedAt: new Date(),
        },
      });

      if (authorized.count === 0) {
        throw new ConflictError(
          `Payout for deal ${input.deal.id} is not awaiting authorisation`,
          'This payout is not awaiting authorisation.',
        );
      }

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'PAYOUT_REVIEW',
        to: 'PAYOUT_PENDING',
        actorDiscordId: input.authorizerDiscordId,
        reason: 'Payout authorised by staff',
      });

      const payout = await tx.payout.findUnique({ where: { dealId: input.deal.id } });

      if (!payout) {
        throw new NotFoundError(`Payout for deal ${input.deal.id} disappeared`);
      }

      await writeAudit(tx, {
        action: 'PAYOUT_APPROVED',
        dealId: deal.id,
        actorDiscordId: input.authorizerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          address: payout.destinationAddress,
          asset: payout.asset,
          network: payout.network,
          amountUsd: String(payout.amountUsd),
          cryptoAmount: String(payout.cryptoAmount),
        },
      });

      log.info({ dealId: deal.id, authorizer: input.authorizerDiscordId }, 'payout authorised');

      return { deal, payout };
    });
  }

  /** Sends a rejected payout back to the seller for a different address. */
  async reject(input: {
    deal: Deal;
    reviewerDiscordId: string;
    reason: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['PAYOUT_REVIEW', 'PAYOUT_ADDRESS_SUBMITTED']);

    return this.prisma.$transaction(async (tx) => {
      await tx.payout.updateMany({
        where: { dealId: input.deal.id, status: { in: ['AWAITING_AUTHORIZATION', 'DRAFT'] } },
        data: {
          status: 'REJECTED',
          rejectedByDiscordId: input.reviewerDiscordId,
          rejectedAt: new Date(),
          rejectionReason: input.reason,
        },
      });

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: input.deal.status as DealState,
        to: 'READY_FOR_PAYOUT_ADDRESS',
        actorDiscordId: input.reviewerDiscordId,
        reason: `Payout rejected: ${input.reason}`,
        data: { payoutAddress: null, payoutCryptoAmount: null },
      });

      await writeAudit(tx, {
        action: 'PAYOUT_REJECTED',
        dealId: deal.id,
        actorDiscordId: input.reviewerDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return deal;
    });
  }

  /**
   * Signs and broadcasts an authorised payout.
   *
   * The signer is idempotent on the key, so a replay returns the existing
   * transaction. A `deduplicated` result is treated exactly like a fresh one:
   * the transaction exists, and the deal follows it.
   */
  async broadcast(input: {
    deal: Deal;
    payout: Payout;
    correlationId?: string;
  }): Promise<{ deal: Deal; txHash: string; deduplicated: boolean }> {
    assertDealStatus(input.deal.status as DealState, ['PAYOUT_PENDING']);

    if (input.payout.status !== 'AUTHORIZED' && input.payout.status !== 'SIGNING') {
      throw new ConflictError(
        `Payout ${input.payout.id} is ${input.payout.status} and cannot be broadcast`,
        'This payout is not ready to be sent.',
      );
    }

    // Marked SIGNING first so a crash mid-broadcast is visibly in flight and
    // gets reconciled rather than retried.
    await this.prisma.payout.updateMany({
      where: { id: input.payout.id, status: 'AUTHORIZED' },
      data: { status: 'SIGNING' },
    });

    let result;

    try {
      result = await this.signer.broadcast({
        idempotencyKey: input.payout.idempotencyKey,
        asset: input.payout.asset,
        network: input.payout.network,
        destinationAddress: input.payout.destinationAddress,
        amount: toDecimal(String(input.payout.cryptoAmount)),
        reference: input.deal.publicId,
      });
    } catch (error) {
      if (error instanceof ManualBroadcastRequired) {
        // Not a failure: the payout is prepared and waiting for a human.
        throw error;
      }

      await this.prisma.payout.updateMany({
        where: { id: input.payout.id, status: 'SIGNING' },
        data: { status: 'AUTHORIZED', failureReason: String(error).slice(0, 500) },
      });
      throw error;
    }

    return this.recordBroadcast({
      deal: input.deal,
      payout: input.payout,
      txHash: result.txHash,
      deduplicated: result.deduplicated,
      networkFee: result.networkFee ?? null,
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    });
  }

  /**
   * Attaches a broadcast transaction to a payout.
   *
   * Shared by the automatic path and by `/admin payout sent` for the manual
   * signer, so both go through the same guards and the same audit entry.
   */
  async recordBroadcast(input: {
    deal: Deal;
    payout: Payout;
    txHash: string;
    deduplicated: boolean;
    networkFee: Decimal | null;
    actorDiscordId?: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; txHash: string; deduplicated: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payout.updateMany({
        where: { id: input.payout.id, status: { in: ['SIGNING', 'AUTHORIZED'] } },
        data: {
          status: 'BROADCAST',
          txHash: input.txHash,
          broadcastAt: new Date(),
          networkFeeCrypto: input.networkFee ? toDbString(input.networkFee, 18) : null,
        },
      });

      if (updated.count === 0) {
        const current = await tx.payout.findUnique({ where: { id: input.payout.id } });

        // Already broadcast with the same hash: a replay, and a no-op.
        if (current?.txHash === input.txHash) {
          const deal = await tx.deal.findUnique({ where: { id: input.deal.id } });
          return { deal: deal ?? input.deal, txHash: input.txHash, deduplicated: true };
        }

        throw new ConflictError(
          `Payout ${input.payout.id} could not be marked broadcast`,
          'This payout has already been processed.',
        );
      }

      const currentDeal = await tx.deal.findUnique({ where: { id: input.deal.id } });
      let deal = currentDeal ?? input.deal;

      if ((deal.status as DealState) === 'PAYOUT_PENDING') {
        deal = await applyTransition(tx, {
          dealId: deal.id,
          from: 'PAYOUT_PENDING',
          to: 'PAYOUT_BROADCAST',
          actorDiscordId: input.actorDiscordId ?? null,
          reason: 'Payout broadcast',
          data: { payoutTxHash: input.txHash },
        });
      }

      await writeAudit(tx, {
        action: 'PAYOUT_BROADCAST',
        dealId: deal.id,
        actorDiscordId: input.actorDiscordId ?? null,
        correlationId: input.correlationId ?? null,
        metadata: {
          txHash: input.txHash,
          deduplicated: input.deduplicated,
          signer: this.signer.name,
          mock: this.signer.isMock,
        },
      });

      log.info(
        { dealId: deal.id, txHash: input.txHash, deduplicated: input.deduplicated },
        'payout broadcast recorded',
      );

      return { deal, txHash: input.txHash, deduplicated: input.deduplicated };
    });
  }

  /**
   * Reconciliation, run on boot and before any payout work.
   *
   * Every payout that might have a transaction in flight is checked against
   * the signer by its idempotency key. If the signer already has one, it is
   * recorded. This is how a crash immediately after broadcasting resolves —
   * by finding the existing transaction, never by sending a second.
   */
  async reconcile(): Promise<{ checked: number; recovered: number }> {
    const inFlight = await this.prisma.payout.findMany({
      where: { status: { in: ['AUTHORIZED', 'SIGNING', 'BROADCAST'] }, txHash: null },
    });

    let recovered = 0;

    for (const payout of inFlight) {
      try {
        const existing = await this.signer.lookup(payout.idempotencyKey);

        if (!existing) continue;

        const deal = await this.prisma.deal.findUnique({ where: { id: payout.dealId } });
        if (!deal) continue;

        await this.recordBroadcast({
          deal,
          payout,
          txHash: existing.txHash,
          deduplicated: true,
          networkFee: existing.networkFee ?? null,
        });

        recovered += 1;

        log.warn(
          { payoutId: payout.id, txHash: existing.txHash },
          'recovered an in-flight payout during reconciliation — no second payout was sent',
        );
      } catch (error) {
        log.error(
          { payoutId: payout.id, err: String(error) },
          'failed to reconcile a payout; leaving it in flight for staff',
        );
      }
    }

    return { checked: inFlight.length, recovered };
  }

  /** Advances a broadcast payout as it gathers confirmations. */
  async trackConfirmations(payout: Payout, adapter: ChainAdapter): Promise<Payout> {
    if (!payout.txHash) return payout;

    const status = await adapter.getTransactionStatus(payout.txHash, payout.asset);

    if (!status.found) return payout;

    if (status.failed) {
      // A reverted payout must never be retried automatically: staff decide.
      await this.prisma.payout.updateMany({
        where: { id: payout.id },
        data: {
          status: 'REVIEW_REQUIRED',
          failureReason: 'The payout transaction failed on chain',
        },
      });
      await this.escalate(payout.dealId, 'The payout transaction failed on chain');
      return { ...payout, status: 'REVIEW_REQUIRED' };
    }

    await this.prisma.payout.updateMany({
      where: { id: payout.id },
      data: { confirmations: status.confirmations },
    });

    if (status.confirmations < payout.requiredConfirmations) {
      await this.moveDeal(
        payout.dealId,
        'PAYOUT_BROADCAST',
        'PAYOUT_CONFIRMING',
        'Payout confirming',
      );
      return { ...payout, confirmations: status.confirmations };
    }

    await this.confirmPayout(payout, status.confirmations);
    return { ...payout, status: 'CONFIRMED', confirmations: status.confirmations };
  }

  private async confirmPayout(payout: Payout, confirmations: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.payout.updateMany({
        where: { id: payout.id, status: { in: ['BROADCAST', 'CONFIRMING'] } },
        data: { status: 'CONFIRMED', confirmations, confirmedAt: new Date() },
      });

      if (marked.count === 0) return;

      const deal = await tx.deal.findUnique({ where: { id: payout.dealId } });
      if (!deal) return;

      let current = deal;

      if ((current.status as DealState) === 'PAYOUT_BROADCAST') {
        current = await applyTransition(tx, {
          dealId: current.id,
          from: 'PAYOUT_BROADCAST',
          to: 'PAYOUT_CONFIRMING',
          reason: 'Payout confirming',
        });
      }

      if ((current.status as DealState) === 'PAYOUT_CONFIRMING') {
        current = await applyTransition(tx, {
          dealId: current.id,
          from: 'PAYOUT_CONFIRMING',
          to: 'PAYOUT_CONFIRMED',
          reason: `Payout confirmed with ${confirmations} confirmations`,
        });

        await applyTransition(tx, {
          dealId: current.id,
          from: 'PAYOUT_CONFIRMED',
          to: 'WAITING_FOR_SELLER_RECEIPT',
          reason: 'Waiting for the seller to confirm receipt',
        });
      }

      await writeAudit(tx, {
        action: 'PAYOUT_CONFIRMED',
        dealId: deal.id,
        metadata: { txHash: payout.txHash, confirmations },
      });
    });
  }

  /**
   * The seller confirms the funds arrived. This is what completes a deal.
   */
  async confirmReceipt(input: {
    deal: Deal;
    sellerDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    if (input.deal.sellerDiscordId !== input.sellerDiscordId) {
      throw new ForbiddenError(
        `Actor ${input.sellerDiscordId} is not the seller`,
        'Only the **Seller** can confirm that the funds arrived.',
      );
    }

    assertDealStatus(input.deal.status as DealState, ['WAITING_FOR_SELLER_RECEIPT']);

    return this.prisma.$transaction(async (tx) => {
      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'WAITING_FOR_SELLER_RECEIPT',
        to: 'COMPLETED',
        actorDiscordId: input.sellerDiscordId,
        reason: 'Seller confirmed receipt of the funds',
        data: {
          sellerReceivedFunds: true,
          sellerReceivedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        action: 'SELLER_CONFIRMED_RECEIPT',
        dealId: deal.id,
        actorDiscordId: input.sellerDiscordId,
        correlationId: input.correlationId ?? null,
      });

      return deal;
    });
  }

  /**
   * The seller reports the funds did not arrive.
   *
   * NO SECOND PAYOUT IS EVER SENT AUTOMATICALLY. The deal goes to
   * PAYOUT_REVIEW_REQUIRED, which has no path back into any payout state, and
   * staff are notified.
   */
  async reportNotReceived(input: {
    deal: Deal;
    sellerDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    if (input.deal.sellerDiscordId !== input.sellerDiscordId) {
      throw new ForbiddenError(
        `Actor ${input.sellerDiscordId} is not the seller`,
        'Only the **Seller** can report a missing payout.',
      );
    }

    assertDealStatus(input.deal.status as DealState, ['WAITING_FOR_SELLER_RECEIPT']);

    return this.prisma.$transaction(async (tx) => {
      await tx.payout.updateMany({
        where: { dealId: input.deal.id },
        data: { status: 'REVIEW_REQUIRED' },
      });

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'WAITING_FOR_SELLER_RECEIPT',
        to: 'PAYOUT_REVIEW_REQUIRED',
        actorDiscordId: input.sellerDiscordId,
        reason: 'Seller reported that the payout was not received',
      });

      await writeAudit(tx, {
        action: 'SELLER_REPORTED_MISSING_FUNDS',
        dealId: deal.id,
        actorDiscordId: input.sellerDiscordId,
        correlationId: input.correlationId ?? null,
      });

      log.warn(
        { dealId: deal.id },
        'seller reported a missing payout — no automatic re-payout will occur',
      );

      return deal;
    });
  }

  private async escalate(dealId: string, reason: string): Promise<void> {
    await writeAudit(this.prisma, {
      action: 'PAYOUT_REJECTED',
      dealId,
      metadata: { escalated: true, reason },
    });
  }

  private async moveDeal(
    dealId: string,
    from: DealState,
    to: DealState,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal || (deal.status as DealState) !== from) return;
      await applyTransition(tx, { dealId, from, to, reason });
    });
  }

  /** Payouts the worker should track on this pass. */
  async inFlightPayouts(limit = 50): Promise<Payout[]> {
    return this.prisma.payout.findMany({
      where: { status: { in: ['BROADCAST', 'CONFIRMING'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
