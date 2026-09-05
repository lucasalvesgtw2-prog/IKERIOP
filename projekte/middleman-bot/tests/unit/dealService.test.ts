import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConflictError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from '../../src/core/errors.js';
import { DealService } from '../../src/services/dealService.js';
import { createFakePrisma } from '../support/fakePrisma.js';

const CREATOR = 'creator-1';
const PARTNER = 'partner-1';
const OUTSIDER = 'outsider-1';

function seedDeal(
  prisma: ReturnType<typeof createFakePrisma>,
  overrides: Record<string, unknown> = {},
) {
  prisma.state.users.push(
    { id: 'user-creator', discordId: CREATOR, banned: false },
    { id: 'user-partner', discordId: PARTNER, banned: false },
  );

  const deal = {
    id: 'deal-1',
    publicId: 'MM-0001',
    ticketId: 'ticket-1',
    guildId: 'guild-1',
    creatorDiscordId: CREATOR,
    partnerDiscordId: null,
    buyerDiscordId: null,
    sellerDiscordId: null,
    status: 'CREATED',
    version: 0,
    ...overrides,
  };

  prisma.state.deals.push(deal);
  return deal;
}

describe('validatePartner', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealService(prisma as never);
  });

  it('accepts an ordinary second user', async () => {
    const deal = seedDeal(prisma);
    await expect(
      service.validatePartner({
        deal: deal as never,
        partnerDiscordId: PARTNER,
        partnerIsBot: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('refuses a deal with yourself', async () => {
    const deal = seedDeal(prisma);
    await expect(
      service.validatePartner({
        deal: deal as never,
        partnerDiscordId: CREATOR,
        partnerIsBot: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a bot', async () => {
    const deal = seedDeal(prisma);
    await expect(
      service.validatePartner({
        deal: deal as never,
        partnerDiscordId: 'bot-1',
        partnerIsBot: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a banned user', async () => {
    const deal = seedDeal(prisma);
    prisma.state.users.push({ id: 'user-banned', discordId: 'banned-1', banned: true });

    await expect(
      service.validatePartner({
        deal: deal as never,
        partnerDiscordId: 'banned-1',
        partnerIsBot: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('addPartner', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealService(prisma as never);
  });

  it('records the partner and moves the deal to PARTNER_ADDED', async () => {
    const deal = seedDeal(prisma);

    const updated = await service.addPartner({
      deal: deal as never,
      partnerDiscordId: PARTNER,
      actorDiscordId: CREATOR,
    });

    expect(updated.status).toBe('PARTNER_ADDED');
    expect(updated.partnerDiscordId).toBe(PARTNER);
  });

  it('assigns no role yet — nobody is silently cast as the buyer', async () => {
    const deal = seedDeal(prisma);

    const updated = await service.addPartner({
      deal: deal as never,
      partnerDiscordId: PARTNER,
      actorDiscordId: CREATOR,
    });

    expect(updated.buyerDiscordId).toBeNull();
    expect(updated.sellerDiscordId).toBeNull();
    expect(prisma.state.dealParticipants).toHaveLength(0);
  });

  it('audits the addition', async () => {
    const deal = seedDeal(prisma);
    await service.addPartner({
      deal: deal as never,
      partnerDiscordId: PARTNER,
      actorDiscordId: CREATOR,
    });

    const entry = prisma.state.auditLogs.at(-1) as Record<string, unknown>;
    expect(entry.action).toBe('DEAL_PARTNER_ADDED');
    expect((entry.metadata as Record<string, unknown>).partnerDiscordId).toBe(PARTNER);
  });

  it('refuses to add a second partner', async () => {
    const deal = seedDeal(prisma, { status: 'PARTNER_ADDED', partnerDiscordId: PARTNER });

    await expect(
      service.addPartner({
        deal: deal as never,
        partnerDiscordId: OUTSIDER,
        actorDiscordId: CREATOR,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('role assignment validation', () => {
  const service = new DealService(createFakePrisma() as never);
  const participants: [string, string] = [CREATOR, PARTNER];

  it('rejects the same person as both buyer and seller', () => {
    expect(() =>
      service.assertAssignmentIsValid(
        { buyerDiscordId: CREATOR, sellerDiscordId: CREATOR },
        participants,
      ),
    ).toThrow(ValidationError);
  });

  it('rejects a third party in either role', () => {
    expect(() =>
      service.assertAssignmentIsValid(
        { buyerDiscordId: OUTSIDER, sellerDiscordId: PARTNER },
        participants,
      ),
    ).toThrow(ValidationError);

    expect(() =>
      service.assertAssignmentIsValid(
        { buyerDiscordId: CREATOR, sellerDiscordId: OUTSIDER },
        participants,
      ),
    ).toThrow(ValidationError);
  });

  it('accepts either permutation of the two participants', () => {
    expect(() =>
      service.assertAssignmentIsValid(
        { buyerDiscordId: CREATOR, sellerDiscordId: PARTNER },
        participants,
      ),
    ).not.toThrow();

    expect(() =>
      service.assertAssignmentIsValid(
        { buyerDiscordId: PARTNER, sellerDiscordId: CREATOR },
        participants,
      ),
    ).not.toThrow();
  });
});

describe('deriveAssignment', () => {
  const service = new DealService(createFakePrisma() as never);
  const deal = {
    id: 'deal-1',
    creatorDiscordId: CREATOR,
    partnerDiscordId: PARTNER,
  } as never;

  it('makes the other participant the seller, whichever buyer is chosen', () => {
    expect(service.deriveAssignment(deal, CREATOR)).toEqual({
      buyerDiscordId: CREATOR,
      sellerDiscordId: PARTNER,
    });
    expect(service.deriveAssignment(deal, PARTNER)).toEqual({
      buyerDiscordId: PARTNER,
      sellerDiscordId: CREATOR,
    });
  });

  it('can never derive the same person for both roles', () => {
    for (const buyer of [CREATOR, PARTNER]) {
      const assignment = service.deriveAssignment(deal, buyer);
      expect(assignment.buyerDiscordId).not.toBe(assignment.sellerDiscordId);
    }
  });

  it('refuses a buyer who is not in this ticket', () => {
    expect(() => service.deriveAssignment(deal, OUTSIDER)).toThrow(ValidationError);
  });

  it('refuses before a partner exists', () => {
    const withoutPartner = { id: 'deal-1', creatorDiscordId: CREATOR, partnerDiscordId: null };
    expect(() => service.deriveAssignment(withoutPartner as never, CREATOR)).toThrow(ConflictError);
  });
});

describe('assignRoles', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealService(prisma as never);
  });

  function readyDeal() {
    return seedDeal(prisma, { status: 'PARTNER_ADDED', partnerDiscordId: PARTNER });
  }

  it('sets both roles and moves to ROLES_ASSIGNED', async () => {
    const deal = readyDeal();

    const updated = await service.assignRoles({
      deal: deal as never,
      assignment: { buyerDiscordId: CREATOR, sellerDiscordId: PARTNER },
      actorDiscordId: CREATOR,
    });

    expect(updated.status).toBe('ROLES_ASSIGNED');
    expect(updated.buyerDiscordId).toBe(CREATOR);
    expect(updated.sellerDiscordId).toBe(PARTNER);
  });

  it('creates exactly one buyer row and one seller row', async () => {
    const deal = readyDeal();

    await service.assignRoles({
      deal: deal as never,
      assignment: { buyerDiscordId: PARTNER, sellerDiscordId: CREATOR },
      actorDiscordId: CREATOR,
    });

    const roles = prisma.state.dealParticipants.map((p) => p.role).sort();
    expect(roles).toEqual(['BUYER', 'SELLER']);

    const buyer = prisma.state.dealParticipants.find((p) => p.role === 'BUYER');
    expect(buyer!.discordId).toBe(PARTNER);
    expect(buyer!.isCreator).toBe(false);

    const seller = prisma.state.dealParticipants.find((p) => p.role === 'SELLER');
    expect(seller!.discordId).toBe(CREATOR);
    expect(seller!.isCreator).toBe(true);
  });

  it('refuses an assignment naming the same person twice', async () => {
    const deal = readyDeal();

    await expect(
      service.assignRoles({
        deal: deal as never,
        assignment: { buyerDiscordId: CREATOR, sellerDiscordId: CREATOR },
        actorDiscordId: CREATOR,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(prisma.state.dealParticipants).toHaveLength(0);
  });

  it('refuses an assignment naming an outsider', async () => {
    const deal = readyDeal();

    await expect(
      service.assignRoles({
        deal: deal as never,
        assignment: { buyerDiscordId: CREATOR, sellerDiscordId: OUTSIDER },
        actorDiscordId: CREATOR,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses to assign roles before a partner is added', async () => {
    const deal = seedDeal(prisma);

    await expect(
      service.assignRoles({
        deal: deal as never,
        assignment: { buyerDiscordId: CREATOR, sellerDiscordId: PARTNER },
        actorDiscordId: CREATOR,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses to assign roles twice', async () => {
    const deal = readyDeal();
    const assignment = { buyerDiscordId: CREATOR, sellerDiscordId: PARTNER };

    await service.assignRoles({ deal: deal as never, assignment, actorDiscordId: CREATOR });

    // A replayed click carries the stale deal object; the status check rejects it.
    await expect(
      service.assignRoles({ deal: deal as never, assignment, actorDiscordId: CREATOR }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(prisma.state.dealParticipants).toHaveLength(2);
  });
});

describe('swapRoles', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: DealService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new DealService(prisma as never);
  });

  async function assigned() {
    const deal = seedDeal(prisma, { status: 'PARTNER_ADDED', partnerDiscordId: PARTNER });
    return service.assignRoles({
      deal: deal as never,
      assignment: { buyerDiscordId: CREATOR, sellerDiscordId: PARTNER },
      actorDiscordId: CREATOR,
    });
  }

  it('exchanges the two roles', async () => {
    const deal = await assigned();

    const swapped = await service.swapRoles({ deal, actorDiscordId: CREATOR });

    expect(swapped.buyerDiscordId).toBe(PARTNER);
    expect(swapped.sellerDiscordId).toBe(CREATOR);
  });

  it('leaves exactly one buyer and one seller afterwards', async () => {
    const deal = await assigned();
    await service.swapRoles({ deal, actorDiscordId: CREATOR });

    expect(prisma.state.dealParticipants).toHaveLength(2);
    expect(prisma.state.dealParticipants.map((p) => p.role).sort()).toEqual(['BUYER', 'SELLER']);
    expect(prisma.state.dealParticipants.find((p) => p.role === 'BUYER')!.discordId).toBe(PARTNER);
  });

  it('can be applied twice, returning to the original assignment', async () => {
    const deal = await assigned();
    const once = await service.swapRoles({ deal, actorDiscordId: CREATOR });
    const twice = await service.swapRoles({ deal: once, actorDiscordId: CREATOR });

    expect(twice.buyerDiscordId).toBe(CREATOR);
    expect(twice.sellerDiscordId).toBe(PARTNER);
  });

  it('refuses once the deal has moved past the details step', async () => {
    const deal = await assigned();
    (prisma.state.deals[0] as { status: string }).status = 'WAITING_FOR_BUYER_APPROVAL';

    await expect(
      service.swapRoles({
        deal: { ...deal, status: 'WAITING_FOR_BUYER_APPROVAL' } as never,
        actorDiscordId: CREATOR,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('does not change the deal state', async () => {
    const deal = await assigned();
    const swapped = await service.swapRoles({ deal, actorDiscordId: CREATOR });
    expect(swapped.status).toBe('ROLES_ASSIGNED');
  });
});

describe('requestDealDetails', () => {
  it('moves a role-assigned deal to WAITING_FOR_DEAL_DETAILS', async () => {
    const prisma = createFakePrisma();
    const service = new DealService(prisma as never);
    const deal = seedDeal(prisma, {
      status: 'ROLES_ASSIGNED',
      partnerDiscordId: PARTNER,
      buyerDiscordId: CREATOR,
      sellerDiscordId: PARTNER,
    });

    const updated = await service.requestDealDetails({
      deal: deal as never,
      actorDiscordId: CREATOR,
    });

    expect(updated.status).toBe('WAITING_FOR_DEAL_DETAILS');
  });

  it('refuses from any other state', async () => {
    const prisma = createFakePrisma();
    const service = new DealService(prisma as never);
    const deal = seedDeal(prisma, { status: 'CREATED' });

    await expect(
      service.requestDealDetails({ deal: deal as never, actorDiscordId: CREATOR }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('requireById', () => {
  it('throws for an unknown deal', async () => {
    const service = new DealService(createFakePrisma() as never);
    await expect(service.requireById('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('the one-buyer-one-seller invariant', () => {
  it('is also enforced by the database, not only by this service', async () => {
    const prisma = createFakePrisma();
    const service = new DealService(prisma as never);
    const deal = seedDeal(prisma, { status: 'PARTNER_ADDED', partnerDiscordId: PARTNER });

    await service.assignRoles({
      deal: deal as never,
      assignment: { buyerDiscordId: CREATOR, sellerDiscordId: PARTNER },
      actorDiscordId: CREATOR,
    });

    // Bypass the service entirely and try to write a second buyer directly.
    await expect(
      prisma.dealParticipant.createMany({
        data: [{ dealId: 'deal-1', userId: 'user-partner', discordId: PARTNER, role: 'BUYER' }],
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('never lets an illegal state jump reach the database', async () => {
    const prisma = createFakePrisma();
    const deal = seedDeal(prisma, {
      status: 'PARTNER_ADDED',
      partnerDiscordId: PARTNER,
    });

    // Force a status the state machine cannot reach ROLES_ASSIGNED from and
    // call the low-level transition directly.
    const { applyTransition } = await import('../../src/services/dealTransition.js');

    await expect(
      prisma.$transaction((tx: never) =>
        applyTransition(tx, {
          dealId: deal.id,
          from: 'CREATED',
          to: 'PAYMENT_CONFIRMED',
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });
});
