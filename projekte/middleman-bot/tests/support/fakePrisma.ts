import { vi } from 'vitest';

/**
 * A hand-rolled Prisma stub.
 *
 * It models just enough of the client for the ticket service: the tables it
 * touches, `$transaction` (which runs the callback against the same store, so
 * the sequencing under test is real), and a per-guild ticket counter whose
 * increment is atomic from the caller's point of view.
 *
 * It is deliberately not a general Prisma emulator — anything beyond the ticket
 * flow belongs in an integration test against a real database.
 */

export interface FakeRow {
  [key: string]: unknown;
}

export interface FakePrismaState {
  users: FakeRow[];
  tickets: FakeRow[];
  deals: FakeRow[];
  counters: Map<string, number>;
  auditLogs: FakeRow[];
  stateTransitions: FakeRow[];
  dealParticipants: FakeRow[];
  dealDetails: FakeRow[];
  payments: FakeRow[];
  priceQuotes: FakeRow[];
  wallets: FakeRow[];
  payouts: FakeRow[];
  disputes: FakeRow[];
  supportActions: FakeRow[];
}

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${(sequence += 1)}`;

/**
 * `state` is precisely typed so assertions against it are checked; the model
 * delegates stay loose because they only need to be call-compatible.
 */
export type FakePrismaClient = { state: FakePrismaState } & Record<string, any>;

export function createFakePrisma(seed: Partial<FakePrismaState> = {}): FakePrismaClient {
  const state: FakePrismaState = {
    users: seed.users ?? [],
    tickets: seed.tickets ?? [],
    deals: seed.deals ?? [],
    counters: seed.counters ?? new Map(),
    auditLogs: seed.auditLogs ?? [],
    stateTransitions: seed.stateTransitions ?? [],
    dealParticipants: seed.dealParticipants ?? [],
    dealDetails: seed.dealDetails ?? [],
    payments: seed.payments ?? [],
    priceQuotes: seed.priceQuotes ?? [],
    wallets: seed.wallets ?? [],
    payouts: seed.payouts ?? [],
    disputes: seed.disputes ?? [],
    supportActions: seed.supportActions ?? [],
  };

  const client: any = {
    state,

    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.users.find((u) => u.discordId === where.discordId);
        return row ? { ...row } : null;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = state.users.find((u) => u.discordId === where.discordId);
        if (existing) {
          Object.assign(existing, stripUndefined(update));
          return existing;
        }
        const created: FakeRow = { id: nextId('user'), banned: false, ...create };
        state.users.push(created);
        return created;
      }),
    },

    ticket: {
      count: vi.fn(
        async ({ where }: any) =>
          state.tickets.filter(
            (t) =>
              t.openedById === where.openedById &&
              t.guildId === where.guildId &&
              t.status === where.status,
          ).length,
      ),
      create: vi.fn(async ({ data }: any) => {
        const created: FakeRow = { id: nextId('ticket'), ...data };
        state.tickets.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.tickets.find((t) => t.id === where.id);
        if (!row) throw new Error('ticket not found');
        Object.assign(row, stripUndefined(data));
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.tickets.find((t) =>
          where.id !== undefined ? t.id === where.id : t.channelId === where.channelId,
        );
        // A snapshot, like a real query result — a caller must not be able to
        // observe a later write through a row it read earlier.
        return row ? { ...row } : null;
      }),
    },

    deal: {
      create: vi.fn(async ({ data }: any) => {
        const created: FakeRow = { id: nextId('deal'), version: 0, ...data };
        state.deals.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.deals.find((d) => d.id === where.id);
        if (!row) throw new Error('deal not found');
        Object.assign(row, stripUndefined(data));
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rows = state.deals.filter(
          (d) => d.id === where.id && (where.status === undefined || d.status === where.status),
        );
        for (const row of rows) {
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && 'increment' in (value as object)) {
              row[key] = ((row[key] as number) ?? 0) + (value as { increment: number }).increment;
            } else {
              row[key] = value;
            }
          }
        }
        return { count: rows.length };
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.deals.find((d) => d.id === where.id);
        return row ? { ...row } : null;
      }),
    },

    dealParticipant: {
      createMany: vi.fn(async ({ data }: any) => {
        const rows = Array.isArray(data) ? data : [data];
        for (const row of rows) {
          // Mirrors @@unique([dealId, role]) and @@unique([dealId, userId]).
          // Without these the test double would happily accept the exact
          // corruption the schema exists to prevent.
          const roleTaken = state.dealParticipants.some(
            (p) => p.dealId === row.dealId && p.role === row.role,
          );
          const userTaken = state.dealParticipants.some(
            (p) => p.dealId === row.dealId && p.userId === row.userId,
          );
          if (roleTaken || userTaken) {
            const error: any = new Error('Unique constraint failed on deal_participants');
            error.code = 'P2002';
            throw error;
          }
          state.dealParticipants.push({ id: nextId('participant'), ...row });
        }
        return { count: rows.length };
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.dealParticipants.length;
        state.dealParticipants = state.dealParticipants.filter((p) => p.dealId !== where.dealId);
        return { count: before - state.dealParticipants.length };
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.dealParticipants
          .filter((p) => where?.dealId === undefined || p.dealId === where.dealId)
          .map((p) => ({ ...p })),
      ),
    },

    dealDetails: {
      create: vi.fn(async ({ data }: any) => {
        // Mirrors @@unique([dealId, revision]).
        const clash = state.dealDetails.some(
          (d) => d.dealId === data.dealId && d.revision === data.revision,
        );
        if (clash) {
          const error: any = new Error('Unique constraint failed on deal_details');
          error.code = 'P2002';
          throw error;
        }
        const created: FakeRow = { id: nextId('details'), ...data };
        state.dealDetails.push(created);
        return { ...created };
      }),
      findFirst: vi.fn(async ({ where, orderBy, select }: any) => {
        let rows = state.dealDetails.filter((d) => d.dealId === where.dealId);
        if (orderBy?.revision === 'desc') {
          rows = [...rows].sort((a, b) => (b.revision as number) - (a.revision as number));
        }
        const row = rows[0];
        if (!row) return null;
        if (select) {
          return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
        }
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.dealDetails.find((d) => d.id === where.id);
        if (!row) throw new Error('deal details not found');
        Object.assign(row, stripUndefined(data));
        return { ...row };
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.dealDetails
          .filter((d) => where?.dealId === undefined || d.dealId === where.dealId)
          .map((d) => ({ ...d })),
      ),
    },

    priceQuote: {
      create: vi.fn(async ({ data }: any) => {
        const created: FakeRow = { id: nextId('quote'), ...data };
        state.priceQuotes.push(created);
        return { ...created };
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.priceQuotes.find((q) => q.id === where.id);
        return row ? { ...row } : null;
      }),
    },

    payment: {
      create: vi.fn(async ({ data }: any) => {
        // Mirrors @@unique([idempotencyKey]) and @@unique([network, txHash]).
        if (state.payments.some((p) => p.idempotencyKey === data.idempotencyKey)) {
          const error: any = new Error('Unique constraint failed on payments.idempotencyKey');
          error.code = 'P2002';
          throw error;
        }
        if (
          data.txHash &&
          state.payments.some((p) => p.network === data.network && p.txHash === data.txHash)
        ) {
          const error: any = new Error('Unique constraint failed on payments.network_txHash');
          error.code = 'P2002';
          throw error;
        }
        const created: FakeRow = { confirmations: 0, txHash: null, ...data, id: nextId('payment') };
        state.payments.push(created);
        return { ...created };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.payments.find((p) => p.id === where.id);
        if (!row) throw new Error('payment not found');
        applyUpdate(row, data);
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rows = state.payments.filter(
          (p) =>
            (where.id === undefined || p.id === where.id) &&
            (where.status === undefined || p.status === where.status) &&
            (where.dealId === undefined || p.dealId === where.dealId),
        );
        for (const row of rows) applyUpdate(row, data);
        return { count: rows.length };
      }),
      findFirst: vi.fn(async ({ where, orderBy, include }: any) => {
        let rows = state.payments.filter((p) => {
          if (where.dealId !== undefined && p.dealId !== where.dealId) return false;
          if (where.status?.notIn && where.status.notIn.includes(p.status)) return false;
          if (typeof where.status === 'string' && p.status !== where.status) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') rows = [...rows].reverse();
        const row = rows[0];
        if (!row) return null;
        const result: FakeRow = { ...row };
        if (include?.quote) {
          result.quote = state.priceQuotes.find((q) => q.id === row.quoteId) ?? null;
        }
        return result;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.payments.find((p) =>
          where.id !== undefined ? p.id === where.id : p.idempotencyKey === where.idempotencyKey,
        );
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.payments
          .filter((p) => {
            if (where?.status?.in && !where.status.in.includes(p.status)) return false;
            if (where?.dealId !== undefined && p.dealId !== where.dealId) return false;
            return true;
          })
          .map((p) => ({ ...p })),
      ),
    },

    wallet: {
      create: vi.fn(async ({ data }: any) => {
        const created: FakeRow = { active: true, inUse: false, id: nextId('wallet'), ...data };
        state.wallets.push(created);
        return { ...created };
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const row = state.wallets.find((w) =>
          Object.entries(where).every(([key, value]) => w[key] === value),
        );
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.wallets
          .filter((w) =>
            where ? Object.entries(where).every(([key, value]) => w[key] === value) : true,
          )
          .map((w) => ({ ...w })),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.wallets.find((w) => w.id === where.id);
        if (!row) throw new Error('wallet not found');
        applyUpdate(row, data);
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rows = state.wallets.filter((w) =>
          Object.entries(where).every(([key, value]) => w[key] === value),
        );
        for (const row of rows) applyUpdate(row, data);
        return { count: rows.length };
      }),
    },

    ticketCounter: {
      upsert: vi.fn(async ({ where, create }: any) => {
        const current = state.counters.get(where.guildId);
        const value = current === undefined ? create.value : current + 1;
        state.counters.set(where.guildId, value);
        return { guildId: where.guildId, value };
      }),
    },

    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        const created: FakeRow = { id: nextId('audit'), ...data };
        state.auditLogs.push(created);
        return created;
      }),
    },

    stateTransition: {
      create: vi.fn(async ({ data }: any) => {
        const created: FakeRow = { id: nextId('transition'), ...data };
        state.stateTransitions.push(created);
        return created;
      }),
    },

    // The callback receives the same client, so a transaction sees its own
    // writes exactly as it would against PostgreSQL.
    $transaction: vi.fn(async (fn: any) => fn(client)),
  };

  return client;
}

/** Applies a Prisma-style update payload, including `{ increment }`. */
function applyUpdate(row: FakeRow, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && 'increment' in (value as object)) {
      row[key] = ((row[key] as number) ?? 0) + (value as { increment: number }).increment;
    } else {
      row[key] = value;
    }
  }
}

function stripUndefined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
