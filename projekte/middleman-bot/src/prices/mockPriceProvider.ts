import { type Decimal, toDecimal } from '../core/money.js';
import { ExternalServiceError } from '../core/errors.js';
import { type PriceProvider } from './PriceProvider.js';

/**
 * Deterministic prices for development.
 *
 * Every message produced from a mock quote is labelled MOCK MODE, and env
 * validation refuses to start with this provider while LIVE_MODE=true. The
 * numbers are fixed rather than random so a developer can predict the crypto
 * amount a $105.00 total produces and check it by hand.
 */
const MOCK_PRICES: Readonly<Record<string, string>> = {
  BTC: '100000',
  ETH: '4000',
  USDT: '1',
  USDC: '1',
};

export class MockPriceProvider implements PriceProvider {
  readonly name = 'mock';
  readonly isMock = true;

  async getUsdPrice(asset: string): Promise<Decimal> {
    const price = MOCK_PRICES[asset.toUpperCase()];

    if (!price) {
      throw new ExternalServiceError(`No mock price for asset ${asset}`, { asset });
    }

    return toDecimal(price);
  }

  async getUsdPrices(assets: string[]): Promise<Map<string, Decimal>> {
    const result = new Map<string, Decimal>();
    for (const asset of assets) {
      result.set(asset.toUpperCase(), await this.getUsdPrice(asset));
    }
    return result;
  }
}
