import { type Redis } from 'ioredis';
import { RateLimitError } from '../core/errors.js';

/**
 * Fixed-window rate limiter backed by Redis.
 *
 * Applied per (user, action) to every interaction handler. It protects the
 * bot's own resources and the upstream price/chain APIs from a user hammering
 * a button; it is not a substitute for the state machine, which is what
 * actually prevents duplicate effects.
 */
export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const RATE_LIMITS: Readonly<Record<string, RateLimitRule>> = {
  'ticket:create': { limit: 3, windowMs: 60_000 },
  'deal:mutate': { limit: 20, windowMs: 60_000 },
  'modal:submit': { limit: 10, windowMs: 60_000 },
  'payout:submit': { limit: 5, windowMs: 300_000 },
  'price:quote': { limit: 10, windowMs: 60_000 },
  'dispute:open': { limit: 3, windowMs: 300_000 },
  default: { limit: 30, windowMs: 60_000 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function ruleFor(action: string): RateLimitRule {
  return RATE_LIMITS[action] ?? RATE_LIMITS.default!;
}

export async function checkRateLimit(
  redis: Redis,
  action: string,
  identity: string,
): Promise<RateLimitResult> {
  const rule = ruleFor(action);
  const window = Math.floor(Date.now() / rule.windowMs);
  const key = `rl:${action}:${identity}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, rule.windowMs);
  }

  const windowEndsAt = (window + 1) * rule.windowMs;

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterMs: Math.max(0, windowEndsAt - Date.now()),
  };
}

export async function enforceRateLimit(
  redis: Redis,
  action: string,
  identity: string,
): Promise<void> {
  const result = await checkRateLimit(redis, action, identity);
  if (!result.allowed) {
    throw new RateLimitError(`Rate limit exceeded for ${action}`, result.retryAfterMs);
  }
}
