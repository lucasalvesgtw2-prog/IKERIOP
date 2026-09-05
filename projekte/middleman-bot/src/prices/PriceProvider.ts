import { type Decimal } from '../core/money.js';

/**
 * Market data abstraction.
 *
 * Implementations must return the USD price of ONE unit of the asset. All
 * conversion arithmetic lives in `src/domain/deal/quotes.ts`, never in a
 * provider, so swapping providers cannot change how amounts are computed.
 */
export interface PriceProvider {
  /** Stable identifier stored on every quote for auditability. */
  readonly name: string;

  /** Whether this provider is safe to use with real money. */
  readonly isMock: boolean;

  /** USD price of one unit of `asset` (e.g. "BTC"). */
  getUsdPrice(asset: string): Promise<Decimal>;

  /** Batched variant. Implementations may fall back to sequential lookups. */
  getUsdPrices(assets: string[]): Promise<Map<string, Decimal>>;
}
