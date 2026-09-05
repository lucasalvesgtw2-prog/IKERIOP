import { type Deal, type Payment, type PriceQuote, type PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { toDbString, toDecimal, type Decimal } from '../core/money.js';
import { newUuid } from '../core/ids.js';
import { getEnv } from '../config/env.js';
import { type AssetNetworkPair } from '../config/assets.js';
import { calculateQuote, isQuoteExpired, paymentTolerance } from '../domain/deal/quotes.js';
import { type DealState } from '../domain/deal/state.js';
import { type PriceProvider } from '../prices/PriceProvider.js';
import { writeAudit } from './auditService.js';
import { applyTransition, assertDealStatus } from './dealTransition.js';
import { type WalletService } from './walletService.js';

const log = createLogger('payment-service');

/**
 * Payment requests.
 *
 * The crypto amount a buyer is asked for is computed here, on the server, from
 * a price the server fetched. A client never supplies an amount, and the quote
 * used is persisted in full — price, USD amount, asset precision, timestamp —
 * so the figure can be re-derived and audited long afterwards.
 */
export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly prices: PriceProvider,
    private readonly wallets: WalletService,
  ) {}

  /** Required confirmations for a network, snapshotted onto the payment row. */
  requiredConfirmations(networkFamily: string): number {
    const env = getEnv();

    switch (networkFamily) {
      case 'bitcoin':
        return env.CONFIRMATIONS_BTC;
      case 'evm':
        return env.CONFIRMATIONS_ETH;
      case 'tron':
        return env.CONFIRMATIONS_TRON;
      default:
        return env.CONFIRMATIONS_BTC;
    }
  }

  /**
   * Creates the payment request the buyer pays against.
   *
   * Runs once per attempt and is guarded on CURRENCY_SELECTION, so a double
   * click cannot mint two requests. A re-quote after expiry goes through
   * `requote`, which supersedes the old row rather than adding a second live
   * one.
   */
  async createRequest(input: {
    deal: Deal;
    buyerPair: AssetNetworkPair;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; payment: Payment; quote: PriceQuote }> {
    assertDealStatus(input.deal.status as DealState, ['CURRENCY_SELECTION']);

    const buyerTotalUsd = toDecimal(String(input.deal.buyerTotalUsd ?? '0'));

    if (buyerTotalUsd.lessThanOrEqualTo(0)) {
      throw new ValidationError(
        `Deal ${input.deal.id} has no buyer total`,
        'This deal has no agreed amount yet.',
      );
    }

    const env = getEnv();

    // Fetched before the transaction: an external call must not hold a
    // database transaction open.
    const usdPrice = await this.prices.getUsdPrice(input.buyerPair.asset.symbol);

    const quote = calculateQuote({
      usdAmount: buyerTotalUsd,
      usdPrice,
      asset: input.buyerPair.asset,
      ttlSeconds: env.PRICE_QUOTE_TTL_SECONDS,
    });

    const wallet = await this.wallets.reserveDepositAddress(
      input.buyerPair.asset.symbol,
      input.buyerPair.network.id,
    );

    const requiredConfirmations = this.requiredConfirmations(input.buyerPair.network.family);
    const tolerance = paymentTolerance(input.buyerPair.asset);

    return this.prisma.$transaction(async (tx) => {
      const quoteRow = await tx.priceQuote.create({
        data: {
          dealId: input.deal.id,
          asset: quote.asset,
          network: input.buyerPair.network.id,
          provider: this.prices.name,
          usdPrice: toDbString(quote.usdPrice, 18),
          usdAmount: toDbString(quote.usdAmount, 2),
          cryptoAmount: toDbString(quote.cryptoAmount, 18),
          assetDecimals: quote.assetDecimals,
          quotedAt: quote.quotedAt,
          expiresAt: quote.expiresAt,
        },
      });

      const payment = await tx.payment.create({
        data: {
          dealId: input.deal.id,
          status: 'PENDING',
          asset: quote.asset,
          network: input.buyerPair.network.id,
          expectedUsd: toDbString(quote.usdAmount, 2),
          expectedCryptoAmount: toDbString(quote.cryptoAmount, 18),
          toleranceCryptoAmount: toDbString(tolerance, 18),
          quoteId: quoteRow.id,
          depositAddress: wallet.address,
          walletId: wallet.id,
          requiredConfirmations,
          expiresAt: new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60_000),
          // Derived from the deal and the quote, so a retry of this exact
          // request cannot create a second payment row.
          idempotencyKey: `payment:${input.deal.id}:${quoteRow.id}`,
        },
      });

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'CURRENCY_SELECTION',
        to: 'PAYMENT_REQUEST_CREATED',
        actorDiscordId: input.actorDiscordId,
        reason: 'Payment request created',
        data: {
          paymentCryptoAmount: toDbString(quote.cryptoAmount, 18),
          paymentAddress: wallet.address,
        },
      });

      await writeAudit(tx, {
        action: 'PAYMENT_REQUEST_CREATED',
        dealId: deal.id,
        actorDiscordId: input.actorDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          asset: quote.asset,
          network: input.buyerPair.network.id,
          usdPrice: quote.usdPrice.toString(),
          usdAmount: quote.usdAmount.toFixed(2),
          cryptoAmount: quote.cryptoAmount.toFixed(quote.assetDecimals),
          quotedAt: quote.quotedAt,
          expiresAt: quote.expiresAt,
          requiredConfirmations,
          provider: this.prices.name,
          mock: this.prices.isMock,
        },
      });

      log.info(
        {
          dealId: deal.id,
          asset: quote.asset,
          cryptoAmount: quote.cryptoAmount.toFixed(quote.assetDecimals),
          usdAmount: quote.usdAmount.toFixed(2),
        },
        'payment request created',
      );

      return { deal, payment, quote: quoteRow };
    });
  }

  /** Moves the deal to AWAITING_PAYMENT once the instructions are posted. */
  async armMonitoring(input: {
    deal: Deal;
    actorDiscordId?: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['PAYMENT_REQUEST_CREATED']);

    return this.prisma.$transaction((tx) =>
      applyTransition(tx, {
        dealId: input.deal.id,
        from: 'PAYMENT_REQUEST_CREATED',
        to: 'AWAITING_PAYMENT',
        actorDiscordId: input.actorDiscordId ?? null,
        reason: 'Awaiting the buyer payment',
      }),
    );
  }

  /** The live payment for a deal, if one exists. */
  async activePayment(dealId: string): Promise<(Payment & { quote: PriceQuote | null }) | null> {
    return this.prisma.payment.findFirst({
      where: { dealId, status: { notIn: ['EXPIRED', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      include: { quote: true },
    });
  }

  async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError(`Payment ${paymentId} not found`, { paymentId });
    return payment;
  }

  /**
   * Whether a payment's quote has expired and the buyer needs a new one.
   *
   * An expired quote is never silently extended: the market moved, so the
   * crypto amount is no longer worth the agreed USD.
   */
  isQuoteStale(quote: PriceQuote | null, now: Date = new Date()): boolean {
    if (!quote) return true;
    return isQuoteExpired({ expiresAt: quote.expiresAt }, now);
  }

  /**
   * Replaces an expired, unpaid request with a fresh quote.
   *
   * The old payment is marked EXPIRED in the same transaction, so exactly one
   * live request exists per deal at any moment. Refused once any funds have
   * been seen — re-quoting a partially paid request would change the amount
   * out from under money already in flight.
   */
  async requote(input: {
    deal: Deal;
    payment: Payment;
    buyerPair: AssetNetworkPair;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<{ deal: Deal; payment: Payment; quote: PriceQuote }> {
    assertDealStatus(input.deal.status as DealState, ['AWAITING_PAYMENT']);

    if (input.payment.status !== 'PENDING') {
      throw new ConflictError(
        `Payment ${input.payment.id} is ${input.payment.status} and cannot be re-quoted`,
        'A payment has already been detected for this deal. Please wait for it to confirm.',
      );
    }

    const env = getEnv();
    const usdPrice = await this.prices.getUsdPrice(input.buyerPair.asset.symbol);
    const expectedUsd = toDecimal(String(input.payment.expectedUsd));

    const quote = calculateQuote({
      usdAmount: expectedUsd,
      usdPrice,
      asset: input.buyerPair.asset,
      ttlSeconds: env.PRICE_QUOTE_TTL_SECONDS,
    });

    return this.prisma.$transaction(async (tx) => {
      const superseded = await tx.payment.updateMany({
        where: { id: input.payment.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });

      if (superseded.count === 0) {
        throw new ConflictError(
          `Payment ${input.payment.id} changed while being re-quoted`,
          'This payment has already changed. Please use the latest message in this ticket.',
        );
      }

      const quoteRow = await tx.priceQuote.create({
        data: {
          dealId: input.deal.id,
          asset: quote.asset,
          network: input.buyerPair.network.id,
          provider: this.prices.name,
          usdPrice: toDbString(quote.usdPrice, 18),
          usdAmount: toDbString(quote.usdAmount, 2),
          cryptoAmount: toDbString(quote.cryptoAmount, 18),
          assetDecimals: quote.assetDecimals,
          quotedAt: quote.quotedAt,
          expiresAt: quote.expiresAt,
        },
      });

      const payment = await tx.payment.create({
        data: {
          dealId: input.deal.id,
          status: 'PENDING',
          asset: quote.asset,
          network: input.buyerPair.network.id,
          expectedUsd: toDbString(quote.usdAmount, 2),
          expectedCryptoAmount: toDbString(quote.cryptoAmount, 18),
          toleranceCryptoAmount: toDbString(paymentTolerance(input.buyerPair.asset), 18),
          quoteId: quoteRow.id,
          // The same address is kept: it is already reserved to this deal, and
          // a buyer who copied it before the quote expired must not be sending
          // to an address the bot has stopped watching.
          depositAddress: input.payment.depositAddress,
          walletId: input.payment.walletId,
          requiredConfirmations: input.payment.requiredConfirmations,
          expiresAt: new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60_000),
          idempotencyKey: `payment:${input.deal.id}:${quoteRow.id}`,
        },
      });

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'AWAITING_PAYMENT',
        to: 'PAYMENT_REQUEST_CREATED',
        actorDiscordId: input.actorDiscordId,
        reason: 'Quote expired — new payment request created',
        data: { paymentCryptoAmount: toDbString(quote.cryptoAmount, 18) },
      });

      await writeAudit(tx, {
        action: 'PAYMENT_REQUEST_CREATED',
        dealId: deal.id,
        actorDiscordId: input.actorDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          requote: true,
          supersededPaymentId: input.payment.id,
          usdPrice: quote.usdPrice.toString(),
          cryptoAmount: quote.cryptoAmount.toFixed(quote.assetDecimals),
        },
      });

      return { deal, payment, quote: quoteRow };
    });
  }

  /** Correlation id for a monitoring run, so its log lines group together. */
  newMonitorRunId(): string {
    return newUuid();
  }

  /** Convenience for tests and panels: the amount as a plain Decimal. */
  expectedCrypto(payment: Payment): Decimal {
    return toDecimal(String(payment.expectedCryptoAmount));
  }
}
