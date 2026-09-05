import { type Redis } from 'ioredis';
import { type Decimal, toDecimal } from '../core/money.js';
import { ExternalServiceError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type PriceProvider } from './PriceProvider.js';

const log = createLogger('price-cache');

/**
 * Caching and sanity-checking wrapper around any price provider.
 *
 * Two jobs:
 *
 *  * **Caching.** A quote is requested on every payment request; a short TTL
 *    keeps the upstream API from being hammered without letting a stale rate
 *    be used for long. The cache is Redis so several processes agree.
 *  * **Sanity bounds.** A provider that returns a wildly wrong number — a
 *    parsing change, a depegged feed, a compromised endpoint — must not be
 *    able to make the bot demand 100× too little crypto. A price outside the
 *    plausible band for the asset is rejected rather than acted on.
 */
export interface PriceBounds {
  min: string;
  max: string;
}

/**
 * Deliberately wide: this catches an order-of-magnitude error or a zeroed
 * feed, not ordinary volatility. Narrow bands would cause false rejections
 * during a real market move, which is its own kind of failure.
 */
export const DEFAULT_PRICE_BOUNDS: Readonly<Record<string, PriceBounds>> = {
  BTC: { min: '1000', max: '10000000' },
  ETH: { min: '50', max: '1000000' },
  USDT: { min: '0.5', max: '2' },
  USDC: { min: '0.5', max: '2' },
};

export class CachedPriceProvider implements PriceProvider {
  readonly name: string;
  readonly isMock: boolean;

  constructor(
    private readonly inner: PriceProvider,
    private readonly redis: Redis | null,
    private readonly ttlSeconds: number,
    private readonly bounds: Readonly<Record<string, PriceBounds>> = DEFAULT_PRICE_BOUNDS,
  ) {
    this.name = inner.name;
    this.isMock = inner.isMock;
  }

  async getUsdPrice(asset: string): Promise<Decimal> {
    const symbol = asset.toUpperCase();
    const cached = await this.readCache(symbol);

    if (cached) return cached;

    const price = this.assertWithinBounds(symbol, await this.inner.getUsdPrice(symbol));
    await this.writeCache(symbol, price);
    return price;
  }

  async getUsdPrices(assets: string[]): Promise<Map<string, Decimal>> {
    const result = new Map<string, Decimal>();
    const missing: string[] = [];

    for (const asset of assets) {
      const symbol = asset.toUpperCase();
      const cached = await this.readCache(symbol);
      if (cached) {
        result.set(symbol, cached);
      } else {
        missing.push(symbol);
      }
    }

    if (missing.length > 0) {
      const fetched = await this.inner.getUsdPrices(missing);
      for (const [symbol, price] of fetched) {
        const checked = this.assertWithinBounds(symbol, price);
        await this.writeCache(symbol, checked);
        result.set(symbol, checked);
      }
    }

    return result;
  }

  /**
   * Rejects a price outside the plausible band for the asset.
   *
   * Acting on a bad price is worse than failing: a BTC price of $1 would make
   * the bot ask for 105 BTC, and a price of $10,000,000 would make it accept
   * a payment worth almost nothing.
   */
  assertWithinBounds(symbol: string, price: Decimal): Decimal {
    const bounds = this.bounds[symbol];

    if (!price.isFinite() || price.lessThanOrEqualTo(0)) {
      throw new ExternalServiceError(`Price provider returned ${price.toString()} for ${symbol}`, {
        asset: symbol,
      });
    }

    if (!bounds) return price;

    if (price.lessThan(bounds.min) || price.greaterThan(bounds.max)) {
      log.error(
        { asset: symbol, price: price.toString(), bounds },
        'price outside the plausible band — refusing to use it',
      );
      throw new ExternalServiceError(
        `Price ${price.toString()} for ${symbol} is outside the plausible range`,
        { asset: symbol, price: price.toString() },
      );
    }

    return price;
  }

  private cacheKey(symbol: string): string {
    return `price:${this.inner.name}:${symbol}`;
  }

  private async readCache(symbol: string): Promise<Decimal | null> {
    if (!this.redis) return null;

    try {
      const raw = await this.redis.get(this.cacheKey(symbol));
      return raw ? toDecimal(raw) : null;
    } catch (error) {
      // A cache failure must never block a payment; it just costs a lookup.
      log.warn({ asset: symbol, err: String(error) }, 'price cache read failed');
      return null;
    }
  }

  private async writeCache(symbol: string, price: Decimal): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(this.cacheKey(symbol), price.toString(), 'EX', this.ttlSeconds);
    } catch (error) {
      log.warn({ asset: symbol, err: String(error) }, 'price cache write failed');
    }
  }
}
