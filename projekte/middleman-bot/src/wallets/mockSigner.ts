import { createHash } from 'node:crypto';
import { type Redis } from 'ioredis';
import { toDecimal, type Decimal } from '../core/money.js';
import { createLogger } from '../core/logger.js';
import { type BroadcastResult, type PayoutRequest, type Signer } from './Signer.js';

const log = createLogger('mock-signer');

/**
 * Simulated signer for development.
 *
 * It moves no money. What it does do is honour the contract that matters:
 * `broadcast` is idempotent on the idempotency key, and a second call with the
 * same key returns the first transaction with `deduplicated: true` rather than
 * producing a second one. That way the double-payout protection is exercised
 * for real in development, not only in production.
 *
 * The record lives in Redis so it survives a restart — which is exactly the
 * scenario the protection exists for.
 */
const KEY_PREFIX = 'mocksigner:tx';
const TTL_SECONDS = 30 * 24 * 3600;

export class MockSigner implements Signer {
  readonly name = 'mock';
  readonly isMock = true;
  readonly supportsMainnet = false;

  constructor(
    private readonly redis: Redis,
    private readonly feePerAsset: Readonly<Record<string, string>> = {
      BTC: '0.00002',
      ETH: '0.0005',
      USDT: '1',
      USDC: '1',
    },
  ) {}

  async estimateFee(request: PayoutRequest): Promise<Decimal> {
    return toDecimal(this.feePerAsset[request.asset.toUpperCase()] ?? '0');
  }

  async broadcast(request: PayoutRequest): Promise<BroadcastResult> {
    const existing = await this.lookup(request.idempotencyKey);

    if (existing) {
      log.warn(
        { idempotencyKey: request.idempotencyKey, txHash: existing.txHash },
        'broadcast replayed — returning the existing transaction instead of sending again',
      );
      return { ...existing, deduplicated: true };
    }

    // Derived from the key so a replay produces an identical hash even if the
    // stored record were lost.
    const txHash = createHash('sha256').update(`mock:${request.idempotencyKey}`).digest('hex');

    const result: BroadcastResult = {
      txHash: request.network === 'ethereum-sepolia' ? `0x${txHash}` : txHash,
      deduplicated: false,
      networkFee: await this.estimateFee(request),
    };

    await this.redis.set(
      this.key(request.idempotencyKey),
      JSON.stringify({ txHash: result.txHash, networkFee: result.networkFee?.toString() }),
      'EX',
      TTL_SECONDS,
    );

    log.warn(
      { idempotencyKey: request.idempotencyKey, txHash: result.txHash },
      'SIMULATED payout broadcast — mock mode only, no funds moved',
    );

    return result;
  }

  async lookup(idempotencyKey: string): Promise<BroadcastResult | null> {
    const raw = await this.redis.get(this.key(idempotencyKey));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as { txHash: string; networkFee?: string };
      const result: BroadcastResult = { txHash: parsed.txHash, deduplicated: true };
      if (parsed.networkFee) result.networkFee = toDecimal(parsed.networkFee);
      return result;
    } catch {
      return null;
    }
  }

  private key(idempotencyKey: string): string {
    return `${KEY_PREFIX}:${idempotencyKey}`;
  }
}
