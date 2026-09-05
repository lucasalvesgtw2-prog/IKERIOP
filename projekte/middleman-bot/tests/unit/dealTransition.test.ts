import { describe, expect, it, vi } from 'vitest';
import { ConflictError, InvalidStateError } from '../../src/core/errors.js';
import { applyTransition, assertDealStatus } from '../../src/services/dealTransition.js';

function fakeTx(options: { updatedCount?: number; deal?: Record<string, unknown> | null } = {}) {
  const updateMany = vi.fn().mockResolvedValue({ count: options.updatedCount ?? 1 });
  const findUnique = vi
    .fn()
    .mockResolvedValue(options.deal === undefined ? { id: 'deal-1' } : options.deal);
  const create = vi.fn().mockResolvedValue({});

  return {
    tx: { deal: { updateMany, findUnique }, stateTransition: { create } } as never,
    updateMany,
    findUnique,
    create,
  };
}

describe('applyTransition', () => {
  it('rejects a transition the state machine forbids, before touching the database', async () => {
    const { tx, updateMany } = fakeTx();

    await expect(
      applyTransition(tx, { dealId: 'deal-1', from: 'CREATED', to: 'COMPLETED' }),
    ).rejects.toBeInstanceOf(InvalidStateError);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('guards the write on the expected previous status', async () => {
    const { tx, updateMany } = fakeTx();

    await applyTransition(tx, { dealId: 'deal-1', from: 'CREATED', to: 'PARTNER_ADDED' });

    const call = updateMany.mock.calls[0]![0]!;
    expect(call.where).toEqual({ id: 'deal-1', status: 'CREATED' });
    expect(call.data.status).toBe('PARTNER_ADDED');
    expect(call.data.version).toEqual({ increment: 1 });
  });

  it('writes extra columns atomically with the state change', async () => {
    const { tx, updateMany } = fakeTx();

    await applyTransition(tx, {
      dealId: 'deal-1',
      from: 'CREATED',
      to: 'PARTNER_ADDED',
      data: { partnerDiscordId: 'partner-1' },
    });

    expect(updateMany.mock.calls[0]![0]!.data.partnerDiscordId).toBe('partner-1');
  });

  it('fails when a concurrent writer already moved the deal on', async () => {
    const { tx, create } = fakeTx({ updatedCount: 0 });

    await expect(
      applyTransition(tx, { dealId: 'deal-1', from: 'CREATED', to: 'PARTNER_ADDED' }),
    ).rejects.toBeInstanceOf(ConflictError);

    // No transition is recorded for a write that did not happen.
    expect(create).not.toHaveBeenCalled();
  });

  it('records every accepted transition', async () => {
    const { tx, create } = fakeTx();

    await applyTransition(tx, {
      dealId: 'deal-1',
      from: 'CREATED',
      to: 'PARTNER_ADDED',
      actorDiscordId: 'user-1',
      reason: 'Deal partner added',
    });

    expect(create.mock.calls[0]![0]!.data).toMatchObject({
      dealId: 'deal-1',
      fromStatus: 'CREATED',
      toStatus: 'PARTNER_ADDED',
      actorDiscordId: 'user-1',
      reason: 'Deal partner added',
    });
  });
});

describe('assertDealStatus', () => {
  it('passes when the deal is in an expected state', () => {
    expect(() => assertDealStatus('CREATED', ['CREATED'])).not.toThrow();
    expect(() =>
      assertDealStatus('WAITING_FOR_DEAL_DETAILS', ['ROLES_ASSIGNED', 'WAITING_FOR_DEAL_DETAILS']),
    ).not.toThrow();
  });

  it('throws a user-safe conflict otherwise', () => {
    expect(() => assertDealStatus('PAYMENT_CONFIRMED', ['CREATED'])).toThrow(ConflictError);

    try {
      assertDealStatus('PAYMENT_CONFIRMED', ['CREATED'], 'Custom message.');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ConflictError).userMessage).toBe('Custom message.');
      expect((error as ConflictError).userMessage).not.toContain('PAYMENT_CONFIRMED');
    }
  });
});
