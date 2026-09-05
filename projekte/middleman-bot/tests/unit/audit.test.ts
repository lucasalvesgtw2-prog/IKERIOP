import { describe, expect, it, vi } from 'vitest';
import { Decimal } from '../../src/core/money.js';
import { sanitizeMetadata, writeAudit } from '../../src/services/auditService.js';

describe('sanitizeMetadata', () => {
  it('redacts every secret-looking key', () => {
    const result = sanitizeMetadata({
      dealId: 'MM-0001',
      token: 'super-secret',
      apiKey: 'k',
      api_key: 'k',
      privateKey: 'k',
      private_key: 'k',
      seedPhrase: 'a b c',
      mnemonic: 'a b c',
      password: 'p',
      authorization: 'Bearer x',
      sessionToken: 't',
      signature: 's',
    }) as Record<string, unknown>;

    expect(result.dealId).toBe('MM-0001');
    for (const key of [
      'token',
      'apiKey',
      'api_key',
      'privateKey',
      'private_key',
      'seedPhrase',
      'mnemonic',
      'password',
      'authorization',
      'sessionToken',
      'signature',
    ]) {
      expect(result[key], key).toBe('[REDACTED]');
    }
  });

  it('redacts secrets nested inside objects and arrays', () => {
    const result = sanitizeMetadata({
      payout: { destination: 'bc1q', signerToken: 'leak' },
      attempts: [{ apiKey: 'leak' }],
    }) as Record<string, Record<string, unknown>>;

    expect(result.payout!.destination).toBe('bc1q');
    expect(result.payout!.signerToken).toBe('[REDACTED]');
    expect((result.attempts as unknown as Record<string, unknown>[])[0]!.apiKey).toBe('[REDACTED]');
  });

  it('serialises Decimal and BigInt as strings rather than opaque objects', () => {
    const result = sanitizeMetadata({
      amount: new Decimal('105.00'),
      block: 123n,
    }) as Record<string, unknown>;

    expect(result.amount).toBe('105');
    expect(result.block).toBe('123');
  });

  it('serialises dates as ISO strings', () => {
    const result = sanitizeMetadata({ at: new Date('2026-09-05T17:00:00.000Z') }) as Record<
      string,
      unknown
    >;
    expect(result.at).toBe('2026-09-05T17:00:00.000Z');
  });

  it('truncates a very long string instead of storing it whole', () => {
    const result = sanitizeMetadata({ note: 'x'.repeat(5_000) }) as Record<string, string>;
    expect(result.note!.length).toBeLessThan(2_100);
    expect(result.note!.endsWith('…')).toBe(true);
  });

  it('stops recursing at a bounded depth', () => {
    let nested: Record<string, unknown> = { deep: 'value' };
    for (let i = 0; i < 12; i += 1) nested = { level: nested };

    // Nothing throws, and the result is finite.
    expect(() => JSON.stringify(sanitizeMetadata(nested))).not.toThrow();
  });

  it('caps array length', () => {
    const result = sanitizeMetadata(Array.from({ length: 200 }, (_, i) => i)) as unknown[];
    expect(result.length).toBe(50);
  });

  it('does not choke on a non-finite number', () => {
    const result = sanitizeMetadata({ n: Number.NaN }) as Record<string, unknown>;
    expect(result.n).toBe('NaN');
  });
});

describe('writeAudit', () => {
  it('writes the entry with sanitised metadata', async () => {
    const create = vi.fn().mockResolvedValue({});
    await writeAudit({ auditLog: { create } } as never, {
      action: 'TICKET_CREATED',
      dealId: 'deal-1',
      actorDiscordId: '123',
      metadata: { channelId: 'c1', token: 'secret' },
    });

    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]![0]!.data as Record<string, unknown>;
    expect(data.action).toBe('TICKET_CREATED');
    expect(data.dealId).toBe('deal-1');
    expect(data.metadata).toEqual({ channelId: 'c1', token: '[REDACTED]' });
  });

  it('never lets an audit failure break the operation it records', async () => {
    const create = vi.fn().mockRejectedValue(new Error('database is down'));

    await expect(
      writeAudit({ auditLog: { create } } as never, { action: 'TICKET_CLOSED' }),
    ).resolves.toBeUndefined();
  });
});
