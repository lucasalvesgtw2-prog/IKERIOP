import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigurationError, ConflictError } from '../../src/core/errors.js';
import { toDecimal, type Decimal } from '../../src/core/money.js';
import { resolvePair } from '../../src/config/assets.js';
import { verifyStoredQuote } from '../../src/domain/deal/quotes.js';
import { PaymentService } from '../../src/services/paymentService.js';
import { WalletService } from '../../src/services/walletService.js';
import { MockPriceProvider } from '../../src/prices/index.js';
import { createFakePrisma } from '../support/fakePrisma.js';

const BUYER_PAIR = resolvePair('BTC', 'bitcoin')!;
const USDT_PAIR = resolvePair('USDT', 'tron')!;

function seedDeal(
  prisma: ReturnType<typeof createFakePrisma>,
  overrides: Record<string, unknown> = {},
) {
  const deal = {
    id: 'deal-1',
    publicId: 'MM-0001',
    creatorDiscordId: 'buyer-1',
    buyerDiscordId: 'buyer-1',
    sellerDiscordId: 'seller-1',
    status: 'CURRENCY_SELECTION',
    dealAmountUsd: '100.00',
    feeUsd: '5.00',
    buyerTotalUsd: '105.00',
    feePercentage: '5',
    buyerAsset: 'BTC',
    buyerNetwork: 'bitcoin',
    sellerAsset: 'BTC',
    sellerNetwork: 'bitcoin',
    version: 0,
    ...overrides,
  };
  prisma.state.deals.push(deal);
  return deal;
}

function seedWallet(
  prisma: ReturnType<typeof createFakePrisma>,
  overrides: Record<string, unknown> = {},
) {
  const wallet = {
    id: 'wallet-1',
    kind: 'DEPOSIT',
    asset: 'BTC',
    network: 'bitcoin',
    address: 'bc1qexampledepositaddress',
    active: true,
    inUse: false,
    createdAt: new Date(),
    ...overrides,
  };
  prisma.state.wallets.push(wallet);
  return wallet;
}

function build(prisma: ReturnType<typeof createFakePrisma>) {
  const wallets = new WalletService(prisma as never);
  return new PaymentService(prisma as never, new MockPriceProvider(), wallets);
}

describe('createRequest', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: PaymentService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = build(prisma);
    seedWallet(prisma);
  });

  it('computes the crypto amount on the server from the buyer total', async () => {
    const deal = seedDeal(prisma);

    const { payment } = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    // $105.00 at the mock rate of $100,000/BTC.
    expect(toDecimal(String(payment.expectedCryptoAmount)).toFixed(8)).toBe('0.00105000');
    expect(String(payment.expectedUsd)).toBe('105.00');
  });

  it('stores a quote that can be re-derived later', async () => {
    const deal = seedDeal(prisma);
    const { quote } = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    expect(
      verifyStoredQuote({
        usdAmount: quote.usdAmount as unknown as Decimal,
        usdPrice: quote.usdPrice as unknown as Decimal,
        cryptoAmount: quote.cryptoAmount as unknown as Decimal,
        assetDecimals: quote.assetDecimals,
      }),
    ).toBe(true);
    expect(quote.provider).toBe('mock');
    expect(quote.expiresAt.getTime()).toBeGreaterThan(quote.quotedAt.getTime());
  });

  it('reserves a deposit address and marks it in use', async () => {
    const deal = seedDeal(prisma);
    const { payment } = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    expect(payment.depositAddress).toBe('bc1qexampledepositaddress');
    expect(prisma.state.wallets[0]!.inUse).toBe(true);
  });

  it('never reuses an address that is already expecting money', async () => {
    const first = seedDeal(prisma);
    await service.createRequest({
      deal: first as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    const second = seedDeal(prisma, { id: 'deal-2', publicId: 'MM-0002' });

    await expect(
      service.createRequest({
        deal: second as never,
        buyerPair: BUYER_PAIR,
        actorDiscordId: 'buyer-2',
      }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('fails clearly when no deposit address is configured for the rail', async () => {
    const deal = seedDeal(prisma, { buyerAsset: 'USDT', buyerNetwork: 'tron' });

    await expect(
      service.createRequest({
        deal: deal as never,
        buyerPair: USDT_PAIR,
        actorDiscordId: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('snapshots the required confirmations onto the payment', async () => {
    const deal = seedDeal(prisma);
    const { payment } = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    // Lowering the configured value later must not retroactively confirm this.
    expect(payment.requiredConfirmations).toBeGreaterThan(0);
  });

  it('moves the deal to PAYMENT_REQUEST_CREATED and records the address', async () => {
    const deal = seedDeal(prisma);
    const { deal: updated } = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    expect(updated.status).toBe('PAYMENT_REQUEST_CREATED');
    expect(updated.paymentAddress).toBe('bc1qexampledepositaddress');
  });

  it('audits the request with everything needed to reconstruct the amount', async () => {
    const deal = seedDeal(prisma);
    await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    const entry = prisma.state.auditLogs.at(-1) as Record<string, unknown>;
    expect(entry.action).toBe('PAYMENT_REQUEST_CREATED');
    expect(entry.metadata).toMatchObject({
      asset: 'BTC',
      network: 'bitcoin',
      usdAmount: '105.00',
      cryptoAmount: '0.00105000',
      provider: 'mock',
      mock: true,
    });
  });

  it('refuses outside the currency step, so a double click cannot mint two requests', async () => {
    const deal = seedDeal(prisma);
    await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    // The replayed click carries the stale deal object.
    await expect(
      service.createRequest({
        deal: deal as never,
        buyerPair: BUYER_PAIR,
        actorDiscordId: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(prisma.state.payments).toHaveLength(1);
  });

  it('gives the payment an idempotency key derived from the deal and quote', async () => {
    const deal = seedDeal(prisma);
    const { payment, quote } = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    expect(payment.idempotencyKey).toBe(`payment:${deal.id}:${quote.id}`);
  });
});

describe('requote', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: PaymentService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = build(prisma);
    seedWallet(prisma);
  });

  async function armed() {
    const deal = seedDeal(prisma);
    const created = await service.createRequest({
      deal: deal as never,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });
    const awaiting = await service.armMonitoring({ deal: created.deal });
    return { deal: awaiting, payment: created.payment };
  }

  it('supersedes the old request so only one is ever live', async () => {
    const { deal, payment } = await armed();

    const result = await service.requote({
      deal,
      payment,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    expect(prisma.state.payments).toHaveLength(2);
    expect(prisma.state.payments[0]!.status).toBe('EXPIRED');
    expect(result.payment.status).toBe('PENDING');
  });

  it('keeps the same deposit address', async () => {
    const { deal, payment } = await armed();

    const result = await service.requote({
      deal,
      payment,
      buyerPair: BUYER_PAIR,
      actorDiscordId: 'buyer-1',
    });

    // A buyer who copied the address before the quote expired must not be
    // sending to an address the bot stopped watching.
    expect(result.payment.depositAddress).toBe(payment.depositAddress);
  });

  it('refuses once any funds have been seen', async () => {
    const { deal, payment } = await armed();
    (prisma.state.payments[0] as { status: string }).status = 'DETECTED';

    await expect(
      service.requote({
        deal,
        payment: { ...payment, status: 'DETECTED' } as never,
        buyerPair: BUYER_PAIR,
        actorDiscordId: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses outside AWAITING_PAYMENT', async () => {
    const { payment } = await armed();
    const deal = { ...prisma.state.deals[0], status: 'PAYMENT_CONFIRMED' };

    await expect(
      service.requote({
        deal: deal as never,
        payment,
        buyerPair: BUYER_PAIR,
        actorDiscordId: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('isQuoteStale', () => {
  const service = build(createFakePrisma());

  it('treats a missing quote as stale', () => {
    expect(service.isQuoteStale(null)).toBe(true);
  });

  it('is true only after the expiry', () => {
    const now = new Date('2026-09-05T17:00:00.000Z');
    expect(service.isQuoteStale({ expiresAt: new Date(now.getTime() + 1000) } as never, now)).toBe(
      false,
    );
    expect(service.isQuoteStale({ expiresAt: new Date(now.getTime() - 1000) } as never, now)).toBe(
      true,
    );
  });
});
