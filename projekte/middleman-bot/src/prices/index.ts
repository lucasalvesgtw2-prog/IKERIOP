import { type Redis } from 'ioredis';
import { getEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { type PriceProvider } from './PriceProvider.js';
import { MockPriceProvider } from './mockPriceProvider.js';
import { CoinGeckoPriceProvider } from './coingeckoPriceProvider.js';
import { CachedPriceProvider } from './cachedPriceProvider.js';

const log = createLogger('prices');

/**
 * Builds the configured price provider, wrapped in the cache and the sanity
 * bounds. Selection is by `PRICE_PROVIDER`; env validation already refuses the
 * mock provider while LIVE_MODE=true.
 */
export function createPriceProvider(redis: Redis | null): PriceProvider {
  const env = getEnv();

  const inner: PriceProvider =
    env.PRICE_PROVIDER === 'coingecko'
      ? new CoinGeckoPriceProvider(env.PRICE_API_BASE_URL, env.PRICE_API_KEY)
      : new MockPriceProvider();

  if (inner.isMock) {
    log.warn('using the MOCK price provider — quotes are simulated, not market data');
  }

  return new CachedPriceProvider(inner, redis, env.PRICE_CACHE_TTL_SECONDS);
}

export { type PriceProvider } from './PriceProvider.js';
export { MockPriceProvider } from './mockPriceProvider.js';
export { CoinGeckoPriceProvider } from './coingeckoPriceProvider.js';
export { CachedPriceProvider, DEFAULT_PRICE_BOUNDS } from './cachedPriceProvider.js';
