import { describe, expect, it } from 'vitest';
import {
  Decimal,
  MoneyError,
  formatCrypto,
  formatUsd,
  formatUsdPrice,
  parseUserUsdAmount,
  roundCryptoUp,
  roundUsd,
  toDbString,
  toDecimal,
} from '../../src/core/money.js';

describe('toDecimal', () => {
  it('accepts strings, numbers and Decimals', () => {
    expect(toDecimal('100.50').toFixed(2)).toBe('100.50');
    expect(toDecimal(100.5).toFixed(2)).toBe('100.50');
    expect(toDecimal(new Decimal('100.5')).toFixed(2)).toBe('100.50');
  });

  it('rejects junk', () => {
    expect(() => toDecimal('abc')).toThrow(MoneyError);
    expect(() => toDecimal('')).toThrow(MoneyError);
    expect(() => toDecimal('  ')).toThrow(MoneyError);
    expect(() => toDecimal(Number.NaN)).toThrow(MoneyError);
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe('decimal arithmetic is exact', () => {
  it('does not exhibit the float 0.1 + 0.2 problem', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toDecimal('0.1').plus(toDecimal('0.2')).equals(new Decimal('0.3'))).toBe(true);
  });

  it('keeps precision on large USD values', () => {
    const total = toDecimal('99999999.99').plus('0.01');
    expect(total.toFixed(2)).toBe('100000000.00');
  });
});

describe('parseUserUsdAmount', () => {
  it('accepts plain, $-prefixed and comma-grouped input', () => {
    expect(parseUserUsdAmount('100').toFixed(2)).toBe('100.00');
    expect(parseUserUsdAmount('$100.50').toFixed(2)).toBe('100.50');
    expect(parseUserUsdAmount(' 1,234.56 ').toFixed(2)).toBe('1234.56');
  });

  it('rejects crypto amounts and other non-USD input', () => {
    expect(() => parseUserUsdAmount('0.001 BTC')).toThrow(MoneyError);
    expect(() => parseUserUsdAmount('100 USD')).toThrow(MoneyError);
    expect(() => parseUserUsdAmount('abc')).toThrow(MoneyError);
    expect(() => parseUserUsdAmount('-100')).toThrow(MoneyError);
    expect(() => parseUserUsdAmount('0')).toThrow(MoneyError);
    expect(() => parseUserUsdAmount('')).toThrow(MoneyError);
  });

  it('rejects sub-cent precision', () => {
    expect(() => parseUserUsdAmount('100.123')).toThrow(MoneyError);
  });
});

describe('rounding', () => {
  it('rounds USD half up to cents', () => {
    expect(roundUsd('100.005').toFixed(2)).toBe('100.01');
    expect(roundUsd('100.004').toFixed(2)).toBe('100.00');
  });

  it('always rounds crypto UP so the escrow is never under-funded', () => {
    // 8 decimals (BTC): the trailing 1 must push the last satoshi up.
    expect(roundCryptoUp('0.000000011', 8).toFixed(8)).toBe('0.00000002');
    // 6 decimals (USDT): likewise.
    expect(roundCryptoUp('105.0000001', 6).toFixed(6)).toBe('105.000001');
    // An exact value is left untouched.
    expect(roundCryptoUp('105.000000', 6).toFixed(6)).toBe('105.000000');
  });

  it('rejects an impossible precision', () => {
    expect(() => roundCryptoUp('1', -1)).toThrow(MoneyError);
    expect(() => roundCryptoUp('1', 1.5)).toThrow(MoneyError);
  });
});

describe('formatting', () => {
  it('formats USD with grouping', () => {
    expect(formatUsd('100')).toBe('$100.00');
    expect(formatUsd('1234.5')).toBe('$1,234.50');
    expect(formatUsd('1000000')).toBe('$1,000,000.00');
    expect(formatUsd('0')).toBe('$0.00');
    expect(formatUsd('-5.5')).toBe('-$5.50');
  });

  it('formats crypto without exponent notation', () => {
    expect(formatCrypto('0.00000001', 8)).toBe('0.00000001');
    expect(formatCrypto('0.00000001', 8, 'BTC')).toBe('0.00000001 BTC');
    expect(formatCrypto('105', 6, 'USDT')).toBe('105.000000 USDT');
  });

  it('formats prices with extra precision for sub-dollar assets', () => {
    expect(formatUsdPrice('100000')).toBe('$100,000.00');
    expect(formatUsdPrice('0.00001234')).toBe('$0.00001234');
  });

  it('serialises for the database as a fixed-point string', () => {
    expect(toDbString('105', 2)).toBe('105.00');
    expect(toDbString('0.1', 18)).toBe('0.100000000000000000');
  });
});
