import { type Redis } from 'ioredis';
import { toDecimal, type Decimal } from '../core/money.js';
import { AppError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type BroadcastResult, type PayoutRequest, type Signer } from './Signer.js';

const log = createLogger('manual-signer');

/**
 * Human-in-the-loop signing.
 *
 * The bot never holds a key. It prepares the payout, an authorised middleman
 * sends the funds from a hardware wallet or wallet service, and records the
 * resulting transaction hash with `/admin payout sent`. The bot then verifies
 * that hash on chain like any other transaction.
 *
 * This is the recommended production configuration: a compromise of the bot or
 * its database cannot move funds, because the bot has nothing to move them
 * with.
 */
const KEY_PREFIX = 'manualsigner:tx';
const TTL_SECONDS = 30 * 24 * 3600;

/**
 * Signals that a human must act. Not an error condition — the payout is
 * correctly prepared and waiting.
 */
export class ManualBroadcastRequired extends AppError {
  constructor(public readonly idempotencyKey: string) {
    super('CONFIGURATION', `Manual broadcast required for ${idempotencyKey}`, {
      userMessage:
        'This payout is ready and is waiting for an authorised middleman to send it from the treasury wallet.',
      context: { idempotencyKey },
    });
  }
}

export class ManualSigner implements Signer {
  readonly name = 'manual';
  readonly isMock = false;
  readonly supportsMainnet = true;

  constructor(private readonly redis: Redis) {}

  async estimateFee(_request: PayoutRequest): Promise<Decimal> {
    // The human sending the funds sets the fee; the bot does not guess one.
    return toDecimal('0');
  }

  async broadcast(request: PayoutRequest): Promise<BroadcastResult> {
    const recorded = await this.lookup(request.idempotencyKey);

    if (recorded) {
      log.info(
        { idempotencyKey: request.idempotencyKey, txHash: recorded.txHash },
        'manual payout already recorded',
      );
      return { ...recorded, deduplicated: true };
    }

    // Deliberately throws rather than returning a partial result: an unknown
    // outcome must be reconciled, never retried blindly.
    throw new ManualBroadcastRequired(request.idempotencyKey);
  }

  /**
   * Records a hash a middleman actually broadcast.
   *
   * Refuses to overwrite an existing record, so a second hash cannot be
   * attached to a payout that already has one.
   */
  async recordBroadcast(idempotencyKey: string, txHash: string): Promise<BroadcastResult> {
    const existing = await this.lookup(idempotencyKey);

    if (existing) {
      if (existing.txHash !== txHash) {
        throw new AppError(
          'CONFLICT',
          `Payout ${idempotencyKey} already has transaction ${existing.txHash}`,
          {
            userMessage:
              'A transaction has already been recorded for this payout. It cannot be replaced.',
          },
        );
      }
      return { ...existing, deduplicated: true };
    }

    await this.redis.set(
      this.key(idempotencyKey),
      JSON.stringify({ txHash }),
      'EX',
      TTL_SECONDS,
      'NX',
    );

    return { txHash, deduplicated: false, requiresManualBroadcast: true };
  }

  async lookup(idempotencyKey: string): Promise<BroadcastResult | null> {
    const raw = await this.redis.get(this.key(idempotencyKey));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as { txHash: string };
      return { txHash: parsed.txHash, deduplicated: true, requiresManualBroadcast: true };
    } catch {
      return null;
    }
  }

  private key(idempotencyKey: string): string {
    return `${KEY_PREFIX}:${idempotencyKey}`;
  }
}
