import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/core/errors.js';
import {
  CUSTOM_ID_VERSION,
  MAX_CUSTOM_ID_LENGTH,
  NO_NONCE,
  buildCustomId,
  isFreshNonce,
  newRenderNonce,
  parseCustomId,
} from '../../src/bot/interactions/customId.js';

describe('buildCustomId', () => {
  it('produces a versioned, five-segment id', () => {
    const id = buildCustomId({ domain: 'ticket', action: 'close', target: 'MM-0001', nonce: 'a1' });
    expect(id).toBe(`${CUSTOM_ID_VERSION}:ticket:close:MM-0001:a1`);
  });

  it('fills in placeholders for an unbound component', () => {
    expect(buildCustomId({ domain: 'ticket', action: 'open' })).toBe(
      `${CUSTOM_ID_VERSION}:ticket:open:-:-`,
    );
  });

  it('rejects a segment containing the separator, which would forge extra segments', () => {
    expect(() => buildCustomId({ domain: 'ticket', action: 'close:payout' })).toThrow(
      ValidationError,
    );
    expect(() => buildCustomId({ domain: 'ticket', action: 'x', target: 'a:b:c:d' })).toThrow(
      ValidationError,
    );
  });

  it('rejects segments with characters that do not belong in an id', () => {
    for (const bad of ['tick et', 'ticket\n', 'tîcket', '<@123>', '']) {
      expect(() => buildCustomId({ domain: bad, action: 'open' }), bad).toThrow(ValidationError);
    }
  });

  it('never exceeds the Discord custom id limit', () => {
    const id = buildCustomId({
      domain: 'payout',
      action: 'authorize',
      // A uuid is the longest target the bot ever uses.
      target: '3f6d2b1e-9c4a-4f7b-8d21-0a5e6c7b8d9f',
      nonce: newRenderNonce(),
    });
    expect(id.length).toBeLessThanOrEqual(MAX_CUSTOM_ID_LENGTH);
  });

  it('refuses to build an id that would be too long', () => {
    expect(() =>
      buildCustomId({
        domain: 'a'.repeat(64),
        action: 'b'.repeat(64),
        target: 'c'.repeat(64),
      }),
    ).toThrow(ValidationError);
  });
});

describe('parseCustomId', () => {
  it('round-trips a built id', () => {
    const id = buildCustomId({ domain: 'ticket', action: 'close', target: 'MM-1', nonce: 'zz' });
    expect(parseCustomId(id)).toEqual({
      domain: 'ticket',
      action: 'close',
      target: 'MM-1',
      nonce: 'zz',
    });
  });

  it('returns null for anything malformed rather than throwing', () => {
    for (const bad of [
      '',
      'ticket:close',
      'v1:ticket:close:MM-1',
      'v1:ticket:close:MM-1:nonce:extra',
      'v0:ticket:close:MM-1:n',
      'v2:ticket:close:MM-1:n',
      'v1:tick et:close:MM-1:n',
      'v1:ticket:close:MM-1:<script>',
      'x'.repeat(MAX_CUSTOM_ID_LENGTH + 1),
    ]) {
      expect(parseCustomId(bad), bad).toBeNull();
    }
  });

  it('rejects a non-string input without throwing', () => {
    expect(parseCustomId(undefined as unknown as string)).toBeNull();
    expect(parseCustomId(42 as unknown as string)).toBeNull();
  });
});

describe('nonce freshness', () => {
  it('accepts a component that is not bound to a render', () => {
    expect(isFreshNonce(NO_NONCE, null)).toBe(true);
  });

  it('accepts a matching nonce', () => {
    expect(isFreshNonce('abc', 'abc')).toBe(true);
  });

  it('rejects a stale nonce from an earlier render', () => {
    expect(isFreshNonce('old', 'new')).toBe(false);
  });

  it('rejects a bound component when no nonce is known', () => {
    expect(isFreshNonce('abc', null)).toBe(false);
    expect(isFreshNonce('abc', undefined)).toBe(false);
    expect(isFreshNonce('abc', '')).toBe(false);
  });

  it('generates distinct nonces', () => {
    const nonces = new Set(Array.from({ length: 200 }, () => newRenderNonce()));
    expect(nonces.size).toBe(200);
  });
});
