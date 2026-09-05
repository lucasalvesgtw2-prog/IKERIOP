import { type Decimal, toDecimal } from '../core/money.js';
import { ExternalServiceError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { getAsset } from '../config/assets.js';
import { type PriceProvider } from './PriceProvider.js';

const log = createLogger('coingecko');

/**
 * CoinGecko market data.
 *
 * The provider's only job is to answer "what is one unit of this asset worth
 * in USD". It performs no conversion arithmetic — that lives in the quote
 * service — so swapping providers cannot change how amounts are computed.
 */
export class CoinGeckoPriceProvider implements PriceProvider {
  readonly name = 'coingecko';
  readonly isMock = false;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly timeoutMs = 8_000,
  ) {}

  async getUsdPrice(asset: string): Promise<Decimal> {
    const prices = await this.getUsdPrices([asset]);
    const price = prices.get(asset.toUpperCase());

    if (!price) {
      throw new ExternalServiceError(`No price returned for ${asset}`, { asset });
    }

    return price;
  }

  async getUsdPrices(assets: string[]): Promise<Map<string, Decimal>> {
    const wanted = new Map<string, string>();

    for (const symbol of assets) {
      const definition = getAsset(symbol);
      if (!definition) {
        throw new ExternalServiceError(`Unknown asset ${symbol}`, { asset: symbol });
      }
      wanted.set(definition.priceId, definition.symbol);
    }

    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/simple/price`);
    url.searchParams.set('ids', [...wanted.keys()].join(','));
    url.searchParams.set('vs_currencies', 'usd');

    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }

    const payload = await this.fetchJson(url, headers);
    const result = new Map<string, Decimal>();

    for (const [priceId, symbol] of wanted) {
      const entry = payload[priceId];
      const raw = entry?.usd;

      if (raw === undefined || raw === null) {
        throw new ExternalServiceError(`Price provider returned no USD price for ${symbol}`, {
          asset: symbol,
        });
      }

      let price: Decimal;
      try {
        price = toDecimal(String(raw));
      } catch (error) {
        throw new ExternalServiceError(
          `Price provider returned an unusable price for ${symbol}`,
          {
            asset: symbol,
            raw: String(raw),
          },
          error,
        );
      }

      if (price.lessThanOrEqualTo(0)) {
        throw new ExternalServiceError(
          `Price provider returned a non-positive price for ${symbol}`,
          {
            asset: symbol,
          },
        );
      }

      result.set(symbol, price);
    }

    return result;
  }

  private async fetchJson(
    url: URL,
    headers: Record<string, string>,
  ): Promise<Record<string, { usd?: unknown } | undefined>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });

      if (!response.ok) {
        throw new ExternalServiceError(`Price provider responded ${response.status}`, {
          status: response.status,
        });
      }

      return (await response.json()) as Record<string, { usd?: unknown }>;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;

      log.warn({ err: String(error) }, 'price request failed');
      throw new ExternalServiceError('Price provider is unreachable', {}, error);
    } finally {
      clearTimeout(timer);
    }
  }
}
