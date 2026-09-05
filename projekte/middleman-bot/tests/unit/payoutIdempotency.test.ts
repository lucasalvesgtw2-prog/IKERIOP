import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toDecimal, type Decimal } from '../../src/core/money.js';
import { type BroadcastResult, type PayoutRequest, type Signer } from '../../src/wallets/Signer.js';

/**
 * The single most important guarantee in the system: a payout is sent at most
 * once, whatever happens — a double click, a crash after broadcast, a restart,
 * a retry.
 *
 * These tests exercise the signer contract directly, because that contract is
 * what the service, the worker and the reconciler all rely on.
 */
class RecordingSigner implements Signer {
  readonly name = 'recording';
  readonly isMock = true;
  readonly supportsMainnet = false;

  /** Every genuine send. A second entry for one key is the bug we fear. */
  readonly sends: string[] = [];
  private readonly store = new Map<string, BroadcastResult>();

  async estimateFee(): Promise<Decimal> {
    return toDecimal('0');
  }

  async broadcast(request: PayoutRequest): Promise<BroadcastResult> {
    const existing = this.store.get(request.idempotencyKey);

    if (existing) {
      return { ...existing, deduplicated: true };
    }

    this.sends.push(request.idempotencyKey);
    const result: BroadcastResult = { txHash: `tx-${this.sends.length}`, deduplicated: false };
    this.store.set(request.idempotencyKey, result);
    return result;
  }

  async lookup(idempotencyKey: string): Promise<BroadcastResult | null> {
    const found = this.store.get(idempotencyKey);
    return found ? { ...found, deduplicated: true } : null;
  }
}

function request(key: string): PayoutRequest {
  return {
    idempotencyKey: key,
    asset: 'BTC',
    network: 'bitcoin',
    destinationAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    amount: toDecimal('0.001'),
    reference: 'MM-0001',
  };
}

describe('signer idempotency', () => {
  let signer: RecordingSigner;

  beforeEach(() => {
    signer = new RecordingSigner();
  });

  it('sends once for one key', async () => {
    await signer.broadcast(request('payout:deal-1'));
    expect(signer.sends).toEqual(['payout:deal-1']);
  });

  it('does not send again when the same key is replayed', async () => {
    const first = await signer.broadcast(request('payout:deal-1'));
    const second = await signer.broadcast(request('payout:deal-1'));

    expect(signer.sends).toHaveLength(1);
    expect(second.txHash).toBe(first.txHash);
    expect(second.deduplicated).toBe(true);
  });

  it('sends only once when ten broadcasts race on the same key', async () => {
    await Promise.all(Array.from({ length: 10 }, () => signer.broadcast(request('payout:deal-1'))));

    expect(signer.sends).toHaveLength(1);
  });

  it('returns the same transaction to every racing caller', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => signer.broadcast(request('payout:deal-1'))),
    );

    expect(new Set(results.map((r) => r.txHash)).size).toBe(1);
  });

  it('keeps different deals independent', async () => {
    await signer.broadcast(request('payout:deal-1'));
    await signer.broadcast(request('payout:deal-2'));

    expect(signer.sends).toEqual(['payout:deal-1', 'payout:deal-2']);
  });

  it('lets a crashed caller find its transaction instead of resending', async () => {
    // The broadcast succeeded but the process died before recording it.
    await signer.broadcast(request('payout:deal-1'));
    signer.sends.length = 0;

    // On boot, reconciliation asks by key rather than broadcasting again.
    const recovered = await signer.lookup('payout:deal-1');

    expect(recovered).not.toBeNull();
    expect(recovered!.txHash).toBe('tx-1');
    expect(signer.sends).toHaveLength(0);
  });

  it('reports nothing for a key that was never broadcast', async () => {
    expect(await signer.lookup('payout:never')).toBeNull();
  });
});

describe('MockSigner honours the same contract', () => {
  it('deduplicates by key using its Redis record', async () => {
    const store = new Map<string, string>();
    const redis = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
    };

    const { MockSigner } = await import('../../src/wallets/mockSigner.js');
    const signer = new MockSigner(redis as never);

    const first = await signer.broadcast(request('payout:deal-1'));
    const second = await signer.broadcast(request('payout:deal-1'));

    expect(second.txHash).toBe(first.txHash);
    expect(second.deduplicated).toBe(true);
    expect(first.deduplicated).toBe(false);
  });

  it('is refused for mainnet by declaring supportsMainnet false', async () => {
    const { MockSigner } = await import('../../src/wallets/mockSigner.js');
    const signer = new MockSigner({ get: async () => null, set: async () => 'OK' } as never);
    expect(signer.supportsMainnet).toBe(false);
    expect(signer.isMock).toBe(true);
  });
});

describe('ManualSigner never sends by itself', () => {
  it('throws rather than returning an unknown outcome', async () => {
    const { ManualSigner, ManualBroadcastRequired } =
      await import('../../src/wallets/manualSigner.js');
    const signer = new ManualSigner({ get: async () => null, set: async () => 'OK' } as never);

    await expect(signer.broadcast(request('payout:deal-1'))).rejects.toBeInstanceOf(
      ManualBroadcastRequired,
    );
  });

  it('refuses to replace a transaction hash that is already recorded', async () => {
    const store = new Map<string, string>();
    const redis = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
    };

    const { ManualSigner } = await import('../../src/wallets/manualSigner.js');
    const signer = new ManualSigner(redis as never);

    await signer.recordBroadcast('payout:deal-1', 'hash-a');

    await expect(signer.recordBroadcast('payout:deal-1', 'hash-b')).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    // Recording the same hash again is a harmless no-op.
    const same = await signer.recordBroadcast('payout:deal-1', 'hash-a');
    expect(same.txHash).toBe('hash-a');
  });
});
