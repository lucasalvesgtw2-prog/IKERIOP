import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/core/errors.js';
import { Decimal, MoneyError, toDecimal } from '../../src/core/money.js';
import { DealDetailsService } from '../../src/services/dealDetailsService.js';
import { createFakePrisma } from '../support/fakePrisma.js';

const SELLER = 'seller-1';
const BUYER = 'buyer-1';

const LIMITS = {
  minDealAmountUsd: new Decimal('5'),
  maxDealAmountUsd: new Decimal('100000'),
};

const FEE = new Decimal('5');

const GOOD_INPUT = {
  item: 'Steam Account',
  description: 'Level 50 gaming account with the listed items.',
  additionalTerms: 'Seller must provide login information after payment is confirmed.',
  dealAmount: '100',
};

function seedDeal(
  prisma: ReturnType<typeof createFakePrisma>,
  overrides: Record<string, unknown> = {},
) {
  const deal = {
    id: 'deal-1',
    publicId: 'MM-0001',
    guildId: 'guild-1',
    creatorDiscordId: SELLER,
    partnerDiscordId: BUYER,
    buyerDiscordId: BUYER,
    sellerDiscordId: SELLER,
    status: 'WAITING_FOR_DEAL_DETAILS',
    feePercentage: '5',
    buyerApproved: false,
    version: 0,
    ...overrides,
  };
  prisma.state.deals.push(deal);
  return deal;
}

describe('validate', () => {
  const service = new DealDetailsService(createFakePrisma() as never);

  it('accepts the example from the specification and computes the USD breakdown', () => {
    const result = service.validate(GOOD_INPUT, LIMITS, FEE);

    expect(result.item).toBe('Steam Account');
    expect(result.fees.dealAmountUsd.toFixed(2)).toBe('100.00');
    expect(result.fees.feeUsd.toFixed(2)).toBe('5.00');
    expect(result.fees.buyerTotalUsd.toFixed(2)).toBe('105.00');
    expect(result.fees.sellerPayoutUsd.toFixed(2)).toBe('100.00');
  });

  it('treats the amount as USD, never as a crypto amount', () => {
    for (const amount of ['0.001 BTC', '0.001BTC', '100 USDT', '1 ETH']) {
      expect(
        () => service.validate({ ...GOOD_INPUT, dealAmount: amount }, LIMITS, FEE),
        amount,
      ).toThrow(MoneyError);
    }
  });

  it('accepts a $ prefix and thousands separators', () => {
    expect(
      service
        .validate({ ...GOOD_INPUT, dealAmount: '$1,250.00' }, LIMITS, FEE)
        .fees.dealAmountUsd.toFixed(2),
    ).toBe('1250.00');
  });

  it('rejects zero, negative and sub-cent amounts', () => {
    for (const amount of ['0', '-100', '100.001', '', 'abc']) {
      expect(
        () => service.validate({ ...GOOD_INPUT, dealAmount: amount }, LIMITS, FEE),
        amount,
      ).toThrow(MoneyError);
    }
  });

  it('enforces the configured minimum and maximum', () => {
    expect(() => service.validate({ ...GOOD_INPUT, dealAmount: '4.99' }, LIMITS, FEE)).toThrow(
      MoneyError,
    );
    expect(() => service.validate({ ...GOOD_INPUT, dealAmount: '100000.01' }, LIMITS, FEE)).toThrow(
      MoneyError,
    );
    expect(() =>
      service.validate({ ...GOOD_INPUT, dealAmount: '100000' }, LIMITS, FEE),
    ).not.toThrow();
  });

  it('uses the fee percentage it is given, not a hard-coded 5', () => {
    const result = service.validate(GOOD_INPUT, LIMITS, new Decimal('2.5'));
    expect(result.fees.feeUsd.toFixed(2)).toBe('2.50');
    expect(result.fees.buyerTotalUsd.toFixed(2)).toBe('102.50');
  });

  it('requires an item and a description', () => {
    expect(() => service.validate({ ...GOOD_INPUT, item: '' }, LIMITS, FEE)).toThrow(
      ValidationError,
    );
    expect(() => service.validate({ ...GOOD_INPUT, description: '' }, LIMITS, FEE)).toThrow(
      ValidationError,
    );
  });

  it('treats additional terms as optional and stores absence as null', () => {
    const result = service.validate({ ...GOOD_INPUT, additionalTerms: '   ' }, LIMITS, FEE);
    expect(result.additionalTerms).toBeNull();
  });

  it('rejects over-long fields', () => {
    expect(() => service.validate({ ...GOOD_INPUT, item: 'x'.repeat(101) }, LIMITS, FEE)).toThrow(
      ValidationError,
    );
    expect(() =>
      service.validate({ ...GOOD_INPUT, description: 'x'.repeat(1_001) }, LIMITS, FEE),
    ).toThrow(ValidationError);
  });
});

describe('submit', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealDetailsService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealDetailsService(prisma as never);
  });

  it('stores revision 1 and asks the buyer to approve', async () => {
    const deal = seedDeal(prisma);
    const details = service.validate(GOOD_INPUT, LIMITS, FEE);

    const { deal: updated, revision } = await service.submit({
      deal: deal as never,
      details,
      sellerDiscordId: SELLER,
    });

    expect(revision.revision).toBe(1);
    expect(updated.status).toBe('WAITING_FOR_BUYER_APPROVAL');
    expect(String(updated.dealAmountUsd)).toBe('100.00');
    expect(String(updated.feeUsd)).toBe('5.00');
    expect(String(updated.buyerTotalUsd)).toBe('105.00');
    expect(String(updated.sellerPayoutUsd)).toBe('100.00');
  });

  it('stores the USD amount as an exact decimal string, never a float', async () => {
    const deal = seedDeal(prisma);
    const details = service.validate({ ...GOOD_INPUT, dealAmount: '33.33' }, LIMITS, FEE);

    await service.submit({ deal: deal as never, details, sellerDiscordId: SELLER });

    expect(String(prisma.state.deals[0]!.dealAmountUsd)).toBe('33.33');
    expect(String(prisma.state.deals[0]!.feeUsd)).toBe('1.67');
    expect(String(prisma.state.deals[0]!.buyerTotalUsd)).toBe('35.00');
  });

  it('audits the submission with the full breakdown', async () => {
    const deal = seedDeal(prisma);
    const details = service.validate(GOOD_INPUT, LIMITS, FEE);

    await service.submit({ deal: deal as never, details, sellerDiscordId: SELLER });

    const entry = prisma.state.auditLogs.at(-1) as Record<string, unknown>;
    expect(entry.action).toBe('DEAL_DETAILS_SUBMITTED');
    expect(entry.metadata).toMatchObject({
      revision: 1,
      dealAmountUsd: '100.00',
      feeUsd: '5.00',
      buyerTotalUsd: '105.00',
    });
  });

  it('refuses to submit outside the details step', async () => {
    const deal = seedDeal(prisma, { status: 'WAITING_FOR_BUYER_APPROVAL' });
    const details = service.validate(GOOD_INPUT, LIMITS, FEE);

    await expect(
      service.submit({ deal: deal as never, details, sellerDiscordId: SELLER }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('approve', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealDetailsService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealDetailsService(prisma as never);
  });

  async function submitted(overrides: Record<string, unknown> = {}) {
    const deal = seedDeal(prisma, overrides);
    const details = service.validate(GOOD_INPUT, LIMITS, FEE);
    const { deal: updated } = await service.submit({
      deal: deal as never,
      details,
      sellerDiscordId: SELLER,
    });
    return updated;
  }

  it('sets buyerApproved and moves to BUYER_APPROVED', async () => {
    const deal = await submitted();

    const approved = await service.approve({ deal, buyerDiscordId: BUYER });

    expect(approved.status).toBe('BUYER_APPROVED');
    expect(approved.buyerApproved).toBe(true);
    expect(approved.buyerApprovedAt).toBeInstanceOf(Date);
  });

  it('stamps the approved revision', async () => {
    const deal = await submitted();
    await service.approve({ deal, buyerDiscordId: BUYER });

    expect(prisma.state.dealDetails[0]!.approvedAt).toBeInstanceOf(Date);
  });

  it('cannot approve twice — the second click loses the guarded update', async () => {
    const deal = await submitted();
    await service.approve({ deal, buyerDiscordId: BUYER });

    await expect(service.approve({ deal, buyerDiscordId: BUYER })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('cannot approve before any details exist', async () => {
    const deal = seedDeal(prisma, { status: 'WAITING_FOR_BUYER_APPROVAL' });

    await expect(
      service.approve({ deal: deal as never, buyerDiscordId: BUYER }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cannot approve a deal that is still waiting for details', async () => {
    const deal = seedDeal(prisma, { status: 'WAITING_FOR_DEAL_DETAILS' });

    await expect(
      service.approve({ deal: deal as never, buyerDiscordId: BUYER }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('requestChanges', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealDetailsService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealDetailsService(prisma as never);
  });

  async function submitted() {
    const deal = seedDeal(prisma);
    const details = service.validate(GOOD_INPUT, LIMITS, FEE);
    const { deal: updated } = await service.submit({
      deal: deal as never,
      details,
      sellerDiscordId: SELLER,
    });
    return updated;
  }

  it('sends the deal back to the seller', async () => {
    const deal = await submitted();

    const { deal: updated, reason } = await service.requestChanges({
      deal,
      buyerDiscordId: BUYER,
      rawReason: 'The price is too high for this account.',
    });

    expect(updated.status).toBe('WAITING_FOR_DEAL_DETAILS');
    expect(reason).toBe('The price is too high for this account.');
  });

  it('records the reason on the rejected revision', async () => {
    const deal = await submitted();
    await service.requestChanges({
      deal,
      buyerDiscordId: BUYER,
      rawReason: 'Please add the item list.',
    });

    expect(prisma.state.dealDetails[0]!.changeRequestReason).toBe('Please add the item list.');
    expect(prisma.state.dealDetails[0]!.rejectedAt).toBeInstanceOf(Date);
  });

  it('requires a reason', async () => {
    const deal = await submitted();

    await expect(
      service.requestChanges({ deal, buyerDiscordId: BUYER, rawReason: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.requestChanges({ deal, buyerDiscordId: BUYER, rawReason: 'no' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses to reject an already approved revision', async () => {
    const deal = await submitted();
    await service.approve({ deal, buyerDiscordId: BUYER });

    await expect(
      service.requestChanges({
        deal: { ...deal, status: 'WAITING_FOR_BUYER_APPROVAL' } as never,
        buyerDiscordId: BUYER,
        rawReason: 'Actually, I changed my mind.',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('the approval must be re-earned after every change', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealDetailsService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealDetailsService(prisma as never);
  });

  it('clears buyerApproved when a new revision is submitted', async () => {
    const deal = seedDeal(prisma);

    // Revision 1, approved.
    const first = await service.submit({
      deal: deal as never,
      details: service.validate(GOOD_INPUT, LIMITS, FEE),
      sellerDiscordId: SELLER,
    });
    const approved = await service.approve({ deal: first.deal, buyerDiscordId: BUYER });
    expect(approved.buyerApproved).toBe(true);

    // The seller edits the deal again — simulating staff reopening the step.
    (prisma.state.deals[0] as { status: string }).status = 'WAITING_FOR_DEAL_DETAILS';

    const second = await service.submit({
      deal: { ...approved, status: 'WAITING_FOR_DEAL_DETAILS' } as never,
      details: service.validate({ ...GOOD_INPUT, dealAmount: '900' }, LIMITS, FEE),
      sellerDiscordId: SELLER,
    });

    // The old approval must NOT carry over to the new, more expensive deal.
    expect(second.deal.buyerApproved).toBe(false);
    expect(second.deal.buyerApprovedAt).toBeNull();
    expect(second.revision.revision).toBe(2);
    expect(String(second.deal.dealAmountUsd)).toBe('900.00');
  });

  it('numbers revisions sequentially through a change-request cycle', async () => {
    const deal = seedDeal(prisma);

    let current = (
      await service.submit({
        deal: deal as never,
        details: service.validate(GOOD_INPUT, LIMITS, FEE),
        sellerDiscordId: SELLER,
      })
    ).deal;

    for (let i = 0; i < 2; i += 1) {
      const rejected = await service.requestChanges({
        deal: current,
        buyerDiscordId: BUYER,
        rawReason: 'Please lower the price a little.',
      });
      current = (
        await service.submit({
          deal: rejected.deal,
          details: service.validate(GOOD_INPUT, LIMITS, FEE),
          sellerDiscordId: SELLER,
        })
      ).deal;
    }

    expect(prisma.state.dealDetails.map((d) => d.revision)).toEqual([1, 2, 3]);
    expect(current.buyerApproved).toBe(false);
  });

  it('keeps the fee of the deal, not the fee configured later', async () => {
    // The deal was created when the fee was 5%; an admin later raises it.
    const deal = seedDeal(prisma, { feePercentage: '5' });
    const details = service.validate(GOOD_INPUT, LIMITS, toDecimal(String(deal.feePercentage)));

    const { deal: updated } = await service.submit({
      deal: deal as never,
      details,
      sellerDiscordId: SELLER,
    });

    expect(String(updated.feeUsd)).toBe('5.00');
    expect(String(updated.buyerTotalUsd)).toBe('105.00');
  });
});
