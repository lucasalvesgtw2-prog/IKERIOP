import { randomUUID } from 'node:crypto';
import { type Redis } from 'ioredis';
import { LockedError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('locks');

/**
 * Redis mutex.
 *
 * Used to serialise every mutating operation on a single deal, so two clicks
 * arriving at the same moment cannot both pass a state check. The database
 * transaction plus the `status` guard is the authoritative protection; this
 * lock removes the contention before it reaches the database and keeps the
 * user-visible behaviour ("please try again in a moment") predictable.
 *
 * Released with a compare-and-delete script so a lock whose TTL already
 * expired is never deleted by its previous owner.
 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export interface LockOptions {
  /** Lock lifetime. Must exceed the longest possible critical section. */
  ttlMs?: number;
  /** How long to wait for the lock before giving up. */
  waitMs?: number;
  /** Delay between acquisition attempts. */
  retryDelayMs?: number;
}

export interface AcquiredLock {
  key: string;
  token: string;
  release(): Promise<void>;
}

export function dealLockKey(dealId: string): string {
  return `lock:deal:${dealId}`;
}

export function payoutLockKey(dealId: string): string {
  return `lock:payout:${dealId}`;
}

export async function acquireLock(
  redis: Redis,
  key: string,
  options: LockOptions = {},
): Promise<AcquiredLock | null> {
  const ttlMs = options.ttlMs ?? 15_000;
  const waitMs = options.waitMs ?? 2_000;
  const retryDelayMs = options.retryDelayMs ?? 50;
  const token = randomUUID();
  const deadline = Date.now() + waitMs;

  for (;;) {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');

    if (result === 'OK') {
      return {
        key,
        token,
        release: async () => {
          try {
            await redis.eval(RELEASE_SCRIPT, 1, key, token);
          } catch (error) {
            log.warn({ key, err: String(error) }, 'failed to release lock');
          }
        },
      };
    }

    if (Date.now() + retryDelayMs > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

/** Runs `fn` while holding `key`, or throws `LockedError`. */
export async function withLock<T>(
  redis: Redis,
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const lock = await acquireLock(redis, key, options);

  if (!lock) {
    throw new LockedError(`Could not acquire lock ${key}`, { key });
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
