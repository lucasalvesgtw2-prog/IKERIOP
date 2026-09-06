import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../../src/core/errors.js';
import { DisputeService } from '../../src/services/disputeService.js';
import { type DealState } from '../../src/domain/deal/state.js';
import { createFakePrisma } from '../support/fakePrisma.js';

const BUYER = 'buyer-1';
const SELLER = 'seller-1';
const STAFF = 'staff-1';

function seed(prisma: ReturnType<typeof createFakePrisma>, status: DealState = 'DEAL_IN_PROGRESS') {
  prisma.state.users.push(
    { id: 'user-buyer', discordId: BUYER, banned: false },
    { id: 'user-seller', discordId: SELLER, banned: false },
  );

  const deal = {
    id: 'deal-1',
    publicId: 'MM-0001',
    creatorDiscordId: BUYER,
    buyerDiscordId: BUYER,
    sellerDiscordId: SELLER,
    status,
    version: 0,
  };

  prisma.state.deals.push(deal);
  return deal;
}

describe('canOpen', () => {
  const service = new DisputeService(createFakePrisma() as never);

  it('allows a dispute once funds are in escrow', () => {
    for (const status of [
      'PAYMENT_CONFIRMED',
      'DEAL_IN_PROGRESS',
      'WAITING_FOR_COMPLETION_CONFIRMATIONS',
      'BUYER_COMPLETED',
      'READY_FOR_PAYOUT_ADDRESS',
      'PAYOUT_REVIEW',
      'WAITING_FOR_SELLER_RECEIPT',
    ] as DealState[]) {
      expect(service.canOpen({ status } as never).allowed, status).toBe(true);
    }
  });

  it('refuses before a payment is confirmed, and explains why', () => {
    const result = service.canOpen({ status: 'AWAITING_PAYMENT' } as never);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('payment has been confirmed');
  });

  it('refuses once a payout is in flight, so unfreezing cannot double-pay', () => {
    for (const status of [
      'PAYOUT_PENDING',
      'PAYOUT_BROADCAST',
      'PAYOUT_CONFIRMING',
      'PAYOUT_CONFIRMED',
    ] as DealState[]) {
      const result = service.canOpen({ status } as never);
      expect(result.allowed, status).toBe(false);
      expect(result.reason).toContain('already been sent');
    }
  });

  it('refuses a second dispute on an already disputed deal', () => {
    expect(service.canOpen({ status: 'DISPUTED' } as never).allowed).toBe(false);
  });
});

describe('open', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DisputeService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DisputeService(prisma as never);
  });

  it('freezes the deal and records the reason', async () => {
    const deal = seed(prisma);

    const { deal: frozen, dispute } = await service.open({
      deal: deal as never,
      openerDiscordId: BUYER,
      rawReason: 'The seller has not delivered the account details.',
    });

    expect(frozen.status).toBe('DISPUTED');
    expect(dispute.status).toBe('OPEN');
    expect(dispute.reason).toBe('The seller has not delivered the account details.');
  });

  it('remembers where the deal was, so staff can restore it', async () => {
    const deal = seed(prisma, 'READY_FOR_PAYOUT_ADDRESS');

    const { dispute } = await service.open({
      deal: deal as never,
      openerDiscordId: SELLER,
      rawReason: 'The buyer is refusing to confirm the completed deal.',
    });

    expect(dispute.frozenFromStatus).toBe('READY_FOR_PAYOUT_ADDRESS');
  });

  it('can be opened by either party', async () => {
    for (const opener of [BUYER, SELLER]) {
      const fresh = createFakePrisma();
      const svc = new DisputeService(fresh as never);
      const deal = seed(fresh);

      await expect(
        svc.open({
          deal: deal as never,
          openerDiscordId: opener,
          rawReason: 'Something went wrong with this deal.',
        }),
      ).resolves.toBeDefined();
    }
  });

  it('refuses anyone who is not a party to the deal', async () => {
    const deal = seed(prisma);

    await expect(
      service.open({
        deal: deal as never,
        openerDiscordId: 'stranger',
        rawReason: 'I want to interfere with this deal.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('requires a substantive reason', async () => {
    const deal = seed(prisma);

    for (const reason of ['', '   ', 'bad']) {
      await expect(
        service.open({ deal: deal as never, openerDiscordId: BUYER, rawReason: reason }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it('refuses when a payout is already in flight', async () => {
    const deal = seed(prisma, 'PAYOUT_BROADCAST');

    await expect(
      service.open({
        deal: deal as never,
        openerDiscordId: BUYER,
        rawReason: 'I changed my mind about this deal.',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('audits the freeze', async () => {
    const deal = seed(prisma);
    await service.open({
      deal: deal as never,
      openerDiscordId: BUYER,
      rawReason: 'The item was never delivered to me.',
    });

    const entry = prisma.state.auditLogs.at(-1) as Record<string, unknown>;
    expect(entry.action).toBe('DISPUTE_OPENED');
  });
});

describe('destinationFor', () => {
  const service = new DisputeService(createFakePrisma() as never);

  it('never sends a resolved deal straight to a broadcast', () => {
    const outcomes = (
      ['RESOLVED_RELEASE_TO_SELLER', 'RESOLVED_REFUND_TO_BUYER', 'RESOLVED_OTHER'] as const
    ).flatMap((resolution) =>
      (['PAYMENT_CONFIRMED', 'READY_FOR_PAYOUT_ADDRESS', 'PAYOUT_REVIEW'] as DealState[]).map(
        (from) => service.destinationFor(resolution, from),
      ),
    );

    for (const destination of outcomes) {
      expect(['PAYOUT_PENDING', 'PAYOUT_BROADCAST']).not.toContain(destination);
    }
  });

  it('returns a release to the review step when an address already exists', () => {
    expect(service.destinationFor('RESOLVED_RELEASE_TO_SELLER', 'PAYOUT_REVIEW')).toBe(
      'PAYOUT_REVIEW',
    );
    expect(service.destinationFor('RESOLVED_RELEASE_TO_SELLER', 'PAYOUT_ADDRESS_SUBMITTED')).toBe(
      'PAYOUT_REVIEW',
    );
  });

  it('returns a release to the address step otherwise', () => {
    expect(service.destinationFor('RESOLVED_RELEASE_TO_SELLER', 'DEAL_IN_PROGRESS')).toBe(
      'READY_FOR_PAYOUT_ADDRESS',
    );
  });

  it('cancels the deal for a refund, since the bot has no automatic refund path', () => {
    expect(service.destinationFor('RESOLVED_REFUND_TO_BUYER', 'DEAL_IN_PROGRESS')).toBe(
      'CANCELLED',
    );
  });
});

describe('resolve', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DisputeService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DisputeService(prisma as never);
  });

  async function disputed(from: DealState = 'READY_FOR_PAYOUT_ADDRESS') {
    const deal = seed(prisma, from);
    const { deal: frozen } = await service.open({
      deal: deal as never,
      openerDiscordId: BUYER,
      rawReason: 'The seller stopped responding to me entirely.',
    });
    return frozen;
  }

  it('returns a released deal to the payout review step, not to a broadcast', async () => {
    const deal = await disputed('PAYOUT_REVIEW');

    const resolved = await service.resolve({
      deal,
      staffDiscordId: STAFF,
      resolution: 'RESOLVED_RELEASE_TO_SELLER',
      note: 'The seller provided proof of delivery.',
    });

    expect(resolved.status).toBe('PAYOUT_REVIEW');
  });

  it('cancels the deal for a refund', async () => {
    const deal = await disputed();

    const resolved = await service.resolve({
      deal,
      staffDiscordId: STAFF,
      resolution: 'RESOLVED_REFUND_TO_BUYER',
      note: 'The seller never delivered; support will refund the buyer.',
    });

    expect(resolved.status).toBe('CANCELLED');
  });

  it('records the outcome on the dispute and as a support action', async () => {
    const deal = await disputed();

    await service.resolve({
      deal,
      staffDiscordId: STAFF,
      resolution: 'RESOLVED_RELEASE_TO_SELLER',
      note: 'Both parties agreed to continue.',
    });

    expect(prisma.state.disputes[0]!.status).toBe('RESOLVED_RELEASE_TO_SELLER');
    expect(prisma.state.disputes[0]!.resolvedByDiscordId).toBe(STAFF);
    expect(prisma.state.supportActions.at(-1)!.type).toBe('DISPUTE_RESOLVED');
  });

  it('refuses to resolve a deal that is not disputed', async () => {
    const deal = seed(prisma, 'DEAL_IN_PROGRESS');

    await expect(
      service.resolve({
        deal: deal as never,
        staffDiscordId: STAFF,
        resolution: 'RESOLVED_OTHER',
        note: 'Nothing to resolve.',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('claim', () => {
  it('can only be claimed once', async () => {
    const prisma = createFakePrisma();
    const service = new DisputeService(prisma as never);
    const deal = seed(prisma);

    await service.open({
      deal: deal as never,
      openerDiscordId: BUYER,
      rawReason: 'The seller has gone quiet on me.',
    });

    await service.claim({ dealId: deal.id, staffDiscordId: STAFF });

    await expect(
      service.claim({ dealId: deal.id, staffDiscordId: 'staff-2' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
