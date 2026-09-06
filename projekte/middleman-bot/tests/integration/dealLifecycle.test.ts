import { describe, expect, it } from 'vitest';
import { Decimal, formatCrypto, formatUsd, toDecimal } from '../../src/core/money.js';
import { calculateFees } from '../../src/domain/deal/fees.js';
import { calculateQuote } from '../../src/domain/deal/quotes.js';
import { getAsset, resolvePair } from '../../src/config/assets.js';
import { allowedTransitions, canTransition, type DealState } from '../../src/domain/deal/state.js';
import { DealService } from '../../src/services/dealService.js';
import { DealDetailsService } from '../../src/services/dealDetailsService.js';
import { CurrencyService } from '../../src/services/currencyService.js';
import { CompletionService } from '../../src/services/completionService.js';
import { PaymentService } from '../../src/services/paymentService.js';
import { WalletService } from '../../src/services/walletService.js';
import { MockPriceProvider } from '../../src/prices/index.js';
import { createFakePrisma } from '../support/fakePrisma.js';

/**
 * A full deal, driven through the services in the order the Discord flow
 * drives them.
 *
 * The unit tests prove each step in isolation; this proves they compose — that
 * the state one service leaves behind is the state the next one expects.
 */
const CREATOR = 'creator-1';
const PARTNER = 'partner-1';

describe('a complete deal, end to end', () => {
  it('runs from an empty ticket to funds held in escrow', async () => {
    const prisma = createFakePrisma();
    const deals = new DealService(prisma as never);
    const details = new DealDetailsService(prisma as never);
    const currencies = new CurrencyService(prisma as never);
    const completion = new CompletionService(prisma as never);
    const wallets = new WalletService(prisma as never);
    const payments = new PaymentService(prisma as never, new MockPriceProvider(), wallets);

    prisma.state.users.push(
      { id: 'u1', discordId: CREATOR, banned: false },
      { id: 'u2', discordId: PARTNER, banned: false },
    );
    prisma.state.wallets.push({
      id: 'wallet-1',
      kind: 'DEPOSIT',
      asset: 'USDT',
      network: 'tron',
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      active: true,
      inUse: false,
      createdAt: new Date(),
    });

    let deal = {
      id: 'deal-1',
      publicId: 'MM-0001',
      ticketId: 'ticket-1',
      guildId: 'guild-1',
      creatorDiscordId: CREATOR,
      partnerDiscordId: null,
      buyerDiscordId: null,
      sellerDiscordId: null,
      status: 'CREATED',
      feePercentage: '5',
      buyerApproved: false,
      buyerCompleted: false,
      sellerCompleted: false,
      version: 0,
    } as never;

    prisma.state.deals.push(deal as never);

    // 1. The partner is added.
    deal = (await deals.addPartner({
      deal,
      partnerDiscordId: PARTNER,
      actorDiscordId: CREATOR,
    })) as never;
    expect((deal as { status: string }).status).toBe('PARTNER_ADDED');

    // 2. Roles: the creator is the buyer, so the partner sells.
    deal = (await deals.assignRoles({
      deal,
      assignment: deals.deriveAssignment(deal, CREATOR),
      actorDiscordId: CREATOR,
    })) as never;
    expect((deal as { buyerDiscordId: string }).buyerDiscordId).toBe(CREATOR);
    expect((deal as { sellerDiscordId: string }).sellerDiscordId).toBe(PARTNER);

    // 3. The seller is asked for the details.
    deal = (await deals.requestDealDetails({ deal, actorDiscordId: CREATOR })) as never;

    // 4. The seller submits them: $100.00 USD.
    const validated = details.validate(
      {
        item: 'Steam Account',
        description: 'Level 50 gaming account with the listed items.',
        additionalTerms: 'Login details are provided after the payment is confirmed.',
        dealAmount: '100',
      },
      { minDealAmountUsd: new Decimal('5'), maxDealAmountUsd: new Decimal('100000') },
      new Decimal('5'),
    );

    const submitted = await details.submit({
      deal,
      details: validated,
      sellerDiscordId: PARTNER,
    });
    deal = submitted.deal as never;

    // The canonical figures, exactly as the specification requires.
    expect(formatUsd(validated.fees.dealAmountUsd)).toBe('$100.00');
    expect(formatUsd(validated.fees.feeUsd)).toBe('$5.00');
    expect(formatUsd(validated.fees.buyerTotalUsd)).toBe('$105.00');
    expect((deal as { status: string }).status).toBe('WAITING_FOR_BUYER_APPROVAL');

    // 5. The buyer approves.
    deal = (await details.approve({ deal, buyerDiscordId: CREATOR })) as never;
    expect((deal as { buyerApproved: boolean }).buyerApproved).toBe(true);

    // 6. Currencies: the buyer pays USDT, the seller wants BTC.
    deal = (await currencies.beginSelection({ deal, actorDiscordId: CREATOR })) as never;

    deal = (await currencies.setCurrency({
      deal,
      role: 'buyer',
      pair: resolvePair('USDT', 'tron')!,
      actorDiscordId: CREATOR,
    })) as never;

    deal = (await currencies.setCurrency({
      deal,
      role: 'seller',
      pair: resolvePair('BTC', 'bitcoin')!,
      actorDiscordId: PARTNER,
    })) as never;

    expect(currencies.bothCurrenciesSelected(deal)).toBe(true);

    // 7. The payment request. $105.00 at the mock rate of $1.00/USDT.
    const request = await payments.createRequest({
      deal,
      buyerPair: resolvePair('USDT', 'tron')!,
      actorDiscordId: CREATOR,
    });
    deal = request.deal as never;

    expect(formatCrypto(toDecimal(String(request.payment.expectedCryptoAmount)), 6, 'USDT')).toBe(
      '105.000000 USDT',
    );
    expect(request.payment.depositAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

    // 8. Monitoring is armed.
    deal = (await payments.armMonitoring({ deal })) as never;
    expect((deal as { status: string }).status).toBe('AWAITING_PAYMENT');

    // The audit trail holds every step that mattered.
    const actions = prisma.state.auditLogs.map((a) => a.action);
    expect(actions).toEqual([
      'DEAL_PARTNER_ADDED',
      'ROLES_ASSIGNED',
      'DEAL_DETAILS_SUBMITTED',
      'BUYER_APPROVED',
      'PAYMENT_CURRENCY_SELECTED',
      'PAYOUT_CURRENCY_SELECTED',
      'PAYMENT_REQUEST_CREATED',
    ]);

    // 9. Payment confirmed by the monitor (simulated here), then both parties
    //    confirm the deal itself is done.
    (prisma.state.deals[0] as { status: string }).status = 'PAYMENT_CONFIRMED';
    deal = (await deals.requireById('deal-1')) as never;

    deal = (await completion.beginDeal({ deal })) as never;
    deal = (await completion.openConfirmations({ deal, actorDiscordId: CREATOR })) as never;

    const first = await completion.confirm({ deal, actorDiscordId: CREATOR });
    expect(first.bothConfirmed).toBe(false);
    expect(first.deal.status).toBe('BUYER_COMPLETED');

    const second = await completion.confirm({ deal: first.deal, actorDiscordId: PARTNER });
    expect(second.bothConfirmed).toBe(true);
    expect(second.deal.status).toBe('READY_FOR_PAYOUT_ADDRESS');
  });

  it('keeps the seller whole when the two sides use different currencies', () => {
    // The buyer pays $105 in USDT; the seller receives $100 in BTC. Neither
    // leg changes the deal's USD value.
    const fees = calculateFees('100', '5');

    const buyerLeg = calculateQuote({
      usdAmount: fees.buyerTotalUsd,
      usdPrice: toDecimal('1'),
      asset: getAsset('USDT')!,
      ttlSeconds: 900,
    });

    const sellerLeg = calculateQuote({
      usdAmount: fees.sellerPayoutUsd,
      usdPrice: toDecimal('100000'),
      asset: getAsset('BTC')!,
      ttlSeconds: 900,
    });

    expect(formatCrypto(buyerLeg.cryptoAmount, 6, 'USDT')).toBe('105.000000 USDT');
    expect(formatCrypto(sellerLeg.cryptoAmount, 8, 'BTC')).toBe('0.00100000 BTC');

    // The fee is the difference, and it is never taken out of the seller's leg.
    expect(fees.buyerTotalUsd.minus(fees.sellerPayoutUsd).toFixed(2)).toBe('5.00');
  });
});

describe('the state machine forbids every shortcut this flow could take', () => {
  it('cannot skip any step of the happy path', () => {
    const illegalJumps: Array<[DealState, DealState]> = [
      ['CREATED', 'COMPLETED'],
      ['CREATED', 'PAYMENT_CONFIRMED'],
      ['PARTNER_ADDED', 'WAITING_FOR_DEAL_DETAILS'],
      ['WAITING_FOR_DEAL_DETAILS', 'BUYER_APPROVED'],
      ['WAITING_FOR_BUYER_APPROVAL', 'CURRENCY_SELECTION'],
      ['CURRENCY_SELECTION', 'AWAITING_PAYMENT'],
      ['AWAITING_PAYMENT', 'PAYMENT_CONFIRMED'],
      ['PAYMENT_CONFIRMED', 'READY_FOR_PAYOUT_ADDRESS'],
      ['DEAL_IN_PROGRESS', 'READY_FOR_PAYOUT_ADDRESS'],
      ['READY_FOR_PAYOUT_ADDRESS', 'PAYOUT_PENDING'],
      ['PAYOUT_ADDRESS_SUBMITTED', 'PAYOUT_BROADCAST'],
      ['PAYOUT_REVIEW', 'PAYOUT_BROADCAST'],
      ['WAITING_FOR_SELLER_RECEIPT', 'PAYOUT_PENDING'],
    ];

    for (const [from, to] of illegalJumps) {
      expect(canTransition(from, to), `${from} -> ${to} must be illegal`).toBe(false);
    }
  });

  it('offers no route back to a payout once the seller reports missing funds', () => {
    const seen = new Set<DealState>(['PAYOUT_REVIEW_REQUIRED']);
    const queue: DealState[] = ['PAYOUT_REVIEW_REQUIRED'];

    while (queue.length > 0) {
      for (const next of allowedTransitions(queue.shift()!)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }

    for (const payoutState of [
      'PAYOUT_PENDING',
      'PAYOUT_BROADCAST',
      'PAYOUT_CONFIRMING',
      'READY_FOR_PAYOUT_ADDRESS',
      'PAYOUT_REVIEW',
    ] as DealState[]) {
      expect(seen.has(payoutState), `reachable: ${payoutState}`).toBe(false);
    }
  });
});
