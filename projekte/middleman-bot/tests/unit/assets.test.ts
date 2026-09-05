import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  NETWORKS,
  availableAssets,
  explorerTxUrl,
  getAsset,
  isValidPair,
  networksForAsset,
  resolvePair,
} from '../../src/config/assets.js';

describe('asset registry', () => {
  it('ships the four required assets', () => {
    for (const symbol of ['BTC', 'ETH', 'USDT', 'USDC']) {
      expect(getAsset(symbol)).toBeDefined();
    }
  });

  it('is case-insensitive on lookup', () => {
    expect(getAsset('btc')?.symbol).toBe('BTC');
  });

  it('only references networks that exist', () => {
    for (const asset of Object.values(ASSETS)) {
      for (const networkId of asset.networks) {
        expect(NETWORKS[networkId], `${asset.symbol} -> ${networkId}`).toBeDefined();
      }
    }
  });

  it('declares a contract for every non-native token network', () => {
    for (const asset of Object.values(ASSETS)) {
      if (!asset.contracts) continue;
      for (const networkId of Object.keys(asset.contracts)) {
        expect(asset.networks).toContain(networkId);
      }
    }
  });
});

describe('asset/network pairing', () => {
  it('accepts valid combinations', () => {
    expect(isValidPair('USDT', 'tron')).toBe(true);
    expect(isValidPair('BTC', 'bitcoin')).toBe(true);
    expect(isValidPair('ETH', 'ethereum')).toBe(true);
  });

  it('rejects combinations that would lose funds', () => {
    expect(isValidPair('BTC', 'ethereum')).toBe(false);
    expect(isValidPair('BTC', 'tron')).toBe(false);
    expect(isValidPair('ETH', 'tron')).toBe(false);
    expect(isValidPair('DOGE', 'bitcoin')).toBe(false);
  });

  it('resolves the token contract for a token pair and omits it for a native coin', () => {
    expect(resolvePair('USDT', 'tron')?.contract).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    expect(resolvePair('BTC', 'bitcoin')?.contract).toBeUndefined();
  });
});

describe('runtime mode gating', () => {
  it('never exposes a mainnet network outside mainnet mode', () => {
    for (const mode of ['mock', 'testnet'] as const) {
      for (const asset of Object.values(ASSETS)) {
        for (const network of networksForAsset(asset.symbol, mode)) {
          expect(network.testnet, `${asset.symbol}/${network.id} in ${mode}`).toBe(true);
        }
      }
    }
  });

  it('never exposes a testnet network in mainnet mode', () => {
    for (const asset of Object.values(ASSETS)) {
      for (const network of networksForAsset(asset.symbol, 'mainnet')) {
        expect(network.testnet).toBe(false);
      }
    }
  });

  it('offers at least one asset in every mode', () => {
    for (const mode of ['mock', 'testnet', 'mainnet'] as const) {
      expect(availableAssets(mode).length).toBeGreaterThan(0);
    }
  });
});

describe('explorer links', () => {
  it('builds a link for a known network', () => {
    expect(explorerTxUrl('bitcoin', 'abc123')).toBe('https://mempool.space/tx/abc123');
  });

  it('returns undefined for an unknown network', () => {
    expect(explorerTxUrl('nonsense', 'abc123')).toBeUndefined();
  });
});
