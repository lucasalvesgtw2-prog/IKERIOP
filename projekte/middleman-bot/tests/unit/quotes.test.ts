import { describe, expect, it } from 'vitest';
import { getAsset } from '../../src/config/assets.js';
import { MoneyError, toDecimal } from '../../src/core/money.js';
import {
  calculateQuote,
  isQuoteExpired,
  paymentTolerance,
  verifyStoredQuote,
} from '../../src/domain/deal/quotes.js';

const BTC = getAsset('BTC')!;
const USDT = getAsset('USDT')!;
const ETH = getAsset('ETH')!;

const NOW = new Date('2026-09-05T17:00:00.000Z');

describe('calculateQuote', () => {
  it('matches the worked example: $105.00 at $100,000/BTC is 0.00105 BTC', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('105'),
      usdPrice: toDecimal('100000'),
      asset: BTC,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(quote.cryptoAmount.toFixed(8)).toBe('0.00105000');
    expect(quote.usdAmount.toFixed(2)).toBe('105.00');
    expect(quote.assetDecimals).toBe(8);
  });

  it('converts a stablecoin one-to-one', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('105'),
      usdPrice: toDecimal('1'),
      asset: USDT,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(quote.cryptoAmount.toFixed(6)).toBe('105.000000');
  });

  it('always rounds UP, so escrow is never short', () => {
    // 100 / 3 = 33.333… — the last unit must round up, not down.
    const quote = calculateQuote({
      usdAmount: toDecimal('100'),
      usdPrice: toDecimal('3'),
      asset: USDT,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(quote.cryptoAmount.toFixed(6)).toBe('33.333334');
    // Sending exactly this covers the USD amount.
    expect(quote.cryptoAmount.times('3').greaterThanOrEqualTo('100')).toBe(true);
  });

  it('never produces a zero amount for a positive USD value', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('0.01'),
      usdPrice: toDecimal('10000000'),
      asset: BTC,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(quote.cryptoAmount.greaterThan(0)).toBe(true);
  });

  it('keeps full precision for an 18-decimal asset', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('105'),
      usdPrice: toDecimal('4000'),
      asset: ETH,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(quote.cryptoAmount.toFixed(18)).toBe('0.026250000000000000');
  });

  it('sets the expiry from the ttl', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('105'),
      usdPrice: toDecimal('100000'),
      asset: BTC,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(quote.quotedAt).toEqual(NOW);
    expect(quote.expiresAt.getTime() - NOW.getTime()).toBe(900_000);
  });

  it('rejects an impossible input rather than producing a wrong amount', () => {
    const base = { asset: BTC, ttlSeconds: 900, now: NOW };

    expect(() =>
      calculateQuote({ ...base, usdAmount: toDecimal('0'), usdPrice: toDecimal('1') }),
    ).toThrow(MoneyError);
    expect(() =>
      calculateQuote({ ...base, usdAmount: toDecimal('105'), usdPrice: toDecimal('0') }),
    ).toThrow(MoneyError);
    expect(() =>
      calculateQuote({ ...base, usdAmount: toDecimal('105'), usdPrice: toDecimal('-1') }),
    ).toThrow(MoneyError);
    expect(() =>
      calculateQuote({
        ...base,
        ttlSeconds: 0,
        usdAmount: toDecimal('105'),
        usdPrice: toDecimal('1'),
      }),
    ).toThrow(MoneyError);
  });
});

describe('isQuoteExpired', () => {
  it('is false before the expiry and true at or after it', () => {
    const quote = { expiresAt: new Date(NOW.getTime() + 1_000) };
    expect(isQuoteExpired(quote, NOW)).toBe(false);
    expect(isQuoteExpired(quote, new Date(NOW.getTime() + 1_000))).toBe(true);
    expect(isQuoteExpired(quote, new Date(NOW.getTime() + 5_000))).toBe(true);
  });
});

describe('verifyStoredQuote', () => {
  it('re-derives the amount a stored quote claims', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('105'),
      usdPrice: toDecimal('100000'),
      asset: BTC,
      ttlSeconds: 900,
      now: NOW,
    });

    expect(
      verifyStoredQuote({
        usdAmount: quote.usdAmount,
        usdPrice: quote.usdPrice,
        cryptoAmount: quote.cryptoAmount,
        assetDecimals: quote.assetDecimals,
      }),
    ).toBe(true);
  });

  it('detects a tampered amount', () => {
    expect(
      verifyStoredQuote({
        usdAmount: '105.00',
        usdPrice: '100000',
        // Ten times too much crypto for the same USD figure.
        cryptoAmount: '0.01050000',
        assetDecimals: 8,
      }),
    ).toBe(false);
  });

  it('detects a tampered price', () => {
    expect(
      verifyStoredQuote({
        usdAmount: '105.00',
        usdPrice: '1',
        cryptoAmount: '0.00105000',
        assetDecimals: 8,
      }),
    ).toBe(false);
  });
});

describe('paymentTolerance', () => {
  it('is one unit at the asset precision', () => {
    expect(paymentTolerance(BTC).toFixed(8)).toBe('0.00000001');
    expect(paymentTolerance(USDT).toFixed(6)).toBe('0.000001');
  });

  it('is far too small to hide a meaningful shortfall', () => {
    const quote = calculateQuote({
      usdAmount: toDecimal('105'),
      usdPrice: toDecimal('1'),
      asset: USDT,
      ttlSeconds: 900,
      now: NOW,
    });

    // A 1% underpayment must be nowhere near the tolerance.
    const shortfall = quote.cryptoAmount.times('0.01');
    expect(shortfall.greaterThan(paymentTolerance(USDT))).toBe(true);
  });
});
