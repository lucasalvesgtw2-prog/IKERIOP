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

function stripUndefined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
