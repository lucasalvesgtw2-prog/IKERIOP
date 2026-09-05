import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../src/core/errors.js';
import { Decimal } from '../../src/core/money.js';
import { MAX_OPEN_TICKETS_PER_USER, TicketService } from '../../src/services/ticketService.js';
import { type ResolvedGuildConfig } from '../../src/services/configService.js';
import { createFakePrisma } from '../support/fakePrisma.js';

const CONFIG: ResolvedGuildConfig = {
  guildId: 'guild-1',
  feePercentage: new Decimal('5'),
  minDealAmountUsd: new Decimal('5'),
  maxDealAmountUsd: new Decimal('100000'),
  enabledAssets: ['BTC', 'USDT'],
  ticketCloseDelaySeconds: 300,
};

function reserveInput(overrides: Partial<{ discordId: string; guildId: string }> = {}) {
  return {
    guildId: overrides.guildId ?? 'guild-1',
    discordId: overrides.discordId ?? 'user-1',
    username: 'buyer',
    displayName: 'Buyer',
    config: CONFIG,
  };
}

describe('TicketService.reserve', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: TicketService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new TicketService(prisma);
  });

  it('numbers the first ticket 0001 and matches the deal id to it', async () => {
    const reservation = await service.reserve(reserveInput());

    expect(reservation.sequence).toBe(1);
    expect(reservation.channelName).toBe('middleman-0001');
    expect(reservation.publicDealId).toBe('MM-0001');
  });

  it('gives every ticket a distinct, increasing number', async () => {
    const numbers: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const reservation = await service.reserve(reserveInput({ discordId: `user-${i}` }));
      numbers.push(reservation.publicDealId);
    }
    expect(numbers).toEqual(['MM-0001', 'MM-0002', 'MM-0003']);
  });

  it('never issues the same number twice under concurrent reservations', async () => {
    const reservations = await Promise.all(
      Array.from({ length: 10 }, (_, i) => service.reserve(reserveInput({ discordId: `u${i}` }))),
    );

    const ids = reservations.map((r) => r.publicDealId);
    expect(new Set(ids).size).toBe(10);
  });

  it('counts guilds separately', async () => {
    const a = await service.reserve(reserveInput({ guildId: 'guild-a' }));
    const b = await service.reserve(reserveInput({ guildId: 'guild-b', discordId: 'user-2' }));

    expect(a.sequence).toBe(1);
    expect(b.sequence).toBe(1);
  });

  it('creates the deal in CREATED with the configured fee and an expiry', async () => {
    const { deal } = await service.reserve(reserveInput());

    expect(deal.status).toBe('CREATED');
    expect(String(deal.feePercentage)).toBe('5');
    expect(deal.creatorDiscordId).toBe('user-1');
    expect(deal.expiresAt).toBeInstanceOf(Date);
    expect((deal.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('does not assign a buyer or seller yet', async () => {
    const { deal } = await service.reserve(reserveInput());
    expect(deal.buyerDiscordId ?? null).toBeNull();
    expect(deal.sellerDiscordId ?? null).toBeNull();
  });

  it('uses a placeholder channel id until the real channel exists', async () => {
    const { ticket } = await service.reserve(reserveInput());
    expect(String(ticket.channelId)).toMatch(/^pending:/);
  });

  it('refuses a banned user', async () => {
    prisma.state.users.push({ id: 'user-row', discordId: 'banned-user', banned: true });

    await expect(
      service.reserve(reserveInput({ discordId: 'banned-user' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('caps how many tickets one user may have open', async () => {
    for (let i = 0; i < MAX_OPEN_TICKETS_PER_USER; i += 1) {
      await service.reserve(reserveInput());
    }

    await expect(service.reserve(reserveInput())).rejects.toBeInstanceOf(ConflictError);
  });

  it('lets a user open a new ticket once an old one is closed', async () => {
    for (let i = 0; i < MAX_OPEN_TICKETS_PER_USER; i += 1) {
      await service.reserve(reserveInput());
    }

    (prisma.state.tickets[0] as { status: string }).status = 'CLOSED';

    await expect(service.reserve(reserveInput())).resolves.toBeDefined();
  });
});

describe('TicketService.attachChannel', () => {
  it('records the channel and writes an audit entry', async () => {
    const prisma = createFakePrisma();
    const service = new TicketService(prisma);
    const reservation = await service.reserve(reserveInput());

    await service.attachChannel(reservation, 'channel-123', 'user-1');

    expect(prisma.state.tickets[0]!.channelId).toBe('channel-123');

    const audit = prisma.state.auditLogs.at(-1) as Record<string, unknown>;
    expect(audit.action).toBe('TICKET_CREATED');
    expect(audit.dealId).toBe(reservation.deal.id);
    expect((audit.metadata as Record<string, unknown>).channelId).toBe('channel-123');
  });
});

describe('TicketService.abandon', () => {
  it('marks the reservation failed instead of leaving it looking open', async () => {
    const prisma = createFakePrisma();
    const service = new TicketService(prisma);
    const reservation = await service.reserve(reserveInput());

    await service.abandon(reservation, 'Discord refused');

    expect(prisma.state.tickets[0]!.status).toBe('CLOSED');
    expect(prisma.state.deals[0]!.status).toBe('FAILED');
  });

  it('does not reuse the abandoned number', async () => {
    const prisma = createFakePrisma();
    const service = new TicketService(prisma);

    const first = await service.reserve(reserveInput());
    await service.abandon(first, 'Discord refused');
    const second = await service.reserve(reserveInput({ discordId: 'user-2' }));

    expect(second.publicDealId).toBe('MM-0002');
  });
});

describe('TicketService.assertClosable', () => {
  const service = new TicketService(createFakePrisma());

  it('lets a participant close a deal that holds no funds', () => {
    for (const status of ['CREATED', 'ROLES_ASSIGNED', 'AWAITING_PAYMENT'] as const) {
      expect(() => service.assertClosable(status, false), status).not.toThrow();
    }
  });

  it('stops a participant closing a deal that holds escrowed funds', () => {
    for (const status of [
      'PAYMENT_CONFIRMED',
      'DEAL_IN_PROGRESS',
      'READY_FOR_PAYOUT_ADDRESS',
      'DISPUTED',
      'PAYOUT_REVIEW_REQUIRED',
    ] as const) {
      expect(() => service.assertClosable(status, false), status).toThrow(ForbiddenError);
    }
  });

  it('lets staff close a funded deal', () => {
    expect(() => service.assertClosable('PAYMENT_CONFIRMED', true)).not.toThrow();
  });
});

describe('TicketService.close', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: TicketService;

  beforeEach(async () => {
    prisma = createFakePrisma();
    service = new TicketService(prisma);
  });

  it('cancels a live deal and closes its ticket', async () => {
    const reservation = await service.reserve(reserveInput());

    const result = await service.close({
      ticketId: reservation.ticket.id,
      dealId: reservation.deal.id,
      actorDiscordId: 'user-1',
      reason: 'Closed by a participant',
    });

    expect(result).toEqual({ alreadyClosed: false, dealCancelled: true });
    expect(prisma.state.deals[0]!.status).toBe('CANCELLED');
    expect(prisma.state.tickets[0]!.status).toBe('CLOSED');
  });

  it('records the cancellation as a state transition', async () => {
    const reservation = await service.reserve(reserveInput());

    await service.close({
      ticketId: reservation.ticket.id,
      dealId: reservation.deal.id,
      actorDiscordId: 'user-1',
      reason: 'Closed by a participant',
    });

    const transition = prisma.state.stateTransitions[0] as Record<string, unknown>;
    expect(transition.fromStatus).toBe('CREATED');
    expect(transition.toStatus).toBe('CANCELLED');
    expect(transition.actorDiscordId).toBe('user-1');
  });

  it('is idempotent — a second close is a no-op, not an error', async () => {
    const reservation = await service.reserve(reserveInput());
    const args = {
      ticketId: reservation.ticket.id,
      dealId: reservation.deal.id,
      actorDiscordId: 'user-1',
      reason: 'Closed by a participant',
    };

    await service.close(args);
    const second = await service.close(args);

    expect(second).toEqual({ alreadyClosed: true, dealCancelled: false });
    // The audit trail records the close exactly once.
    const closeEntries = prisma.state.auditLogs.filter(
      (entry: { action?: unknown }) => entry.action === 'TICKET_CLOSED',
    );
    expect(closeEntries).toHaveLength(1);
  });

  it('leaves a funded deal alone and only closes the ticket', async () => {
    const reservation = await service.reserve(reserveInput());
    (prisma.state.deals[0] as { status: string }).status = 'PAYMENT_CONFIRMED';

    const result = await service.close({
      ticketId: reservation.ticket.id,
      dealId: reservation.deal.id,
      actorDiscordId: 'staff-1',
      reason: 'Closed by staff',
    });

    expect(result.dealCancelled).toBe(false);
    // The escrowed deal keeps its status so the funds stay accounted for.
    expect(prisma.state.deals[0]!.status).toBe('PAYMENT_CONFIRMED');
  });

  it('does not re-cancel a deal that already ended', async () => {
    const reservation = await service.reserve(reserveInput());
    (prisma.state.deals[0] as { status: string }).status = 'COMPLETED';

    const result = await service.close({
      ticketId: reservation.ticket.id,
      dealId: reservation.deal.id,
      actorDiscordId: 'staff-1',
      reason: 'Cleanup',
    });

    expect(result.dealCancelled).toBe(false);
    expect(prisma.state.deals[0]!.status).toBe('COMPLETED');
  });

  it('fails loudly when the deal changed underneath it', async () => {
    const reservation = await service.reserve(reserveInput());

    // Simulate a concurrent writer moving the deal on between the read and the
    // guarded update: the guarded UPDATE matches zero rows.
    prisma.deal.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.close({
        ticketId: reservation.ticket.id,
        dealId: reservation.deal.id,
        actorDiscordId: 'user-1',
        reason: 'Closed by a participant',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects an unknown ticket', async () => {
    await expect(
      service.close({
        ticketId: 'nope',
        dealId: 'nope',
        actorDiscordId: 'user-1',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('TicketService.requireByChannelId', () => {
  it('throws when the channel is not a ticket', async () => {
    const service = new TicketService(createFakePrisma());
    await expect(service.requireByChannelId('random-channel')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
