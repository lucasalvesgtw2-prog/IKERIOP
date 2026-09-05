import { describe, expect, it, vi } from 'vitest';
import { ExternalServiceError } from '../../src/core/errors.js';
import { toDecimal, type Decimal } from '../../src/core/money.js';
import { CachedPriceProvider, MockPriceProvider } from '../../src/prices/index.js';
import { type PriceProvider } from '../../src/prices/PriceProvider.js';

function stubProvider(prices: Record<string, string>): PriceProvider & { calls: number } {
  const provider = {
    name: 'stub',
    isMock: false,
    calls: 0,
    async getUsdPrice(asset: string): Promise<Decimal> {
      provider.calls += 1;
      const price = prices[asset.toUpperCase()];
      if (!price) throw new ExternalServiceError(`no price for ${asset}`);
      return toDecimal(price);
    },
    async getUsdPrices(assets: string[]): Promise<Map<string, Decimal>> {
      const result = new Map<string, Decimal>();
      for (const asset of assets)
        result.set(asset.toUpperCase(), await provider.getUsdPrice(asset));
      return result;
    },
  };
  return provider;
}

describe('MockPriceProvider', () => {
  it('is marked as mock so it can be refused in live mode', () => {
    expect(new MockPriceProvider().isMock).toBe(true);
  });

  it('returns deterministic prices', async () => {
    const provider = new MockPriceProvider();
    expect((await provider.getUsdPrice('BTC')).toFixed(2)).toBe('100000.00');
    expect((await provider.getUsdPrice('btc')).toFixed(2)).toBe('100000.00');
    expect((await provider.getUsdPrice('USDT')).toFixed(2)).toBe('1.00');
  });

  it('fails loudly for an unknown asset instead of guessing', async () => {
    await expect(new MockPriceProvider().getUsdPrice('DOGE')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});

describe('CachedPriceProvider sanity bounds', () => {
  const cached = (inner: PriceProvider) => new CachedPriceProvider(inner, null, 30);

  it('accepts an ordinary price', async () => {
    const provider = cached(stubProvider({ BTC: '100000' }));
    expect((await provider.getUsdPrice('BTC')).toFixed(2)).toBe('100000.00');
  });

  it('rejects a price low enough to make the bot demand absurd amounts', async () => {
    // At $1/BTC a $105 total would ask the buyer for 105 BTC.
    const provider = cached(stubProvider({ BTC: '1' }));
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('rejects a price high enough to make the bot accept near-nothing', async () => {
    const provider = cached(stubProvider({ BTC: '99999999999' }));
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('rejects a depegged stablecoin price', async () => {
    await expect(cached(stubProvider({ USDT: '0.01' })).getUsdPrice('USDT')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
    await expect(cached(stubProvider({ USDT: '50' })).getUsdPrice('USDT')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('rejects zero and negative prices', async () => {
    for (const price of ['0', '-1']) {
      await expect(cached(stubProvider({ BTC: price })).getUsdPrice('BTC')).rejects.toBeInstanceOf(
        ExternalServiceError,
      );
    }
  });

  it('accepts ordinary volatility within the band', async () => {
    for (const price of ['20000', '250000']) {
      await expect(cached(stubProvider({ BTC: price })).getUsdPrice('BTC')).resolves.toBeDefined();
    }
  });
});

describe('CachedPriceProvider caching', () => {
  it('serves a cached price without calling upstream again', async () => {
    const store = new Map<string, string>();
    const redis = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
    };

    const inner = stubProvider({ BTC: '100000' });
    const provider = new CachedPriceProvider(inner, redis as never, 30);

    await provider.getUsdPrice('BTC');
    await provider.getUsdPrice('BTC');

    expect(inner.calls).toBe(1);
  });

  it('survives a cache outage by going straight to the provider', async () => {
    const redis = {
      get: vi.fn(async () => {
        throw new Error('redis is down');
      }),
      set: vi.fn(async () => {
        throw new Error('redis is down');
      }),
    };

    const provider = new CachedPriceProvider(stubProvider({ BTC: '100000' }), redis as never, 30);
    expect((await provider.getUsdPrice('BTC')).toFixed(2)).toBe('100000.00');
  });
});
