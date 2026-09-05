import { describe, expect, it } from 'vitest';
import { MoneyError } from '../../src/core/money.js';
import {
  assertDealAmountWithinLimits,
  assertValidFeePercentage,
  calculateFees,
  DEFAULT_FEE_PERCENTAGE,
} from '../../src/domain/deal/fees.js';

describe('calculateFees', () => {
  it('defaults to a 5% fee', () => {
    expect(DEFAULT_FEE_PERCENTAGE).toBe('5');

    const result = calculateFees('100');
    expect(result.dealAmountUsd.toFixed(2)).toBe('100.00');
    expect(result.feeUsd.toFixed(2)).toBe('5.00');
    expect(result.buyerTotalUsd.toFixed(2)).toBe('105.00');
    expect(result.sellerPayoutUsd.toFixed(2)).toBe('100.00');
  });

  it('matches the specified example: $500 deal -> $25 fee -> $525 total', () => {
    const result = calculateFees('500');
    expect(result.feeUsd.toFixed(2)).toBe('25.00');
    expect(result.buyerTotalUsd.toFixed(2)).toBe('525.00');
  });

  it('keeps displayed parts summing to the displayed total', () => {
    // 33.33 * 5% = 1.6665 -> 1.67 (half up); total must use the ROUNDED fee.
    const result = calculateFees('33.33');
    expect(result.feeUsd.toFixed(2)).toBe('1.67');
    expect(result.buyerTotalUsd.toFixed(2)).toBe('35.00');
    expect(result.dealAmountUsd.plus(result.feeUsd).toFixed(2)).toBe(
      result.buyerTotalUsd.toFixed(2),
    );
  });

  it.each([
    ['0.01', '0.00', '0.01'],
    ['10', '0.50', '10.50'],
    ['19.99', '1.00', '20.99'],
    ['1000', '50.00', '1050.00'],
    ['99999.99', '5000.00', '104999.99'],
  ])('deal $%s -> fee $%s, total $%s', (deal, fee, total) => {
    const result = calculateFees(deal);
    expect(result.feeUsd.toFixed(2)).toBe(fee);
    expect(result.buyerTotalUsd.toFixed(2)).toBe(total);
  });

  it('supports a configurable percentage', () => {
    expect(calculateFees('100', '0').feeUsd.toFixed(2)).toBe('0.00');
    expect(calculateFees('100', '2.5').feeUsd.toFixed(2)).toBe('2.50');
    expect(calculateFees('100', '10').buyerTotalUsd.toFixed(2)).toBe('110.00');
  });

  it('never lets the seller payout include the fee', () => {
    const result = calculateFees('250', '5');
    expect(result.sellerPayoutUsd.toFixed(2)).toBe('250.00');
    expect(result.buyerTotalUsd.minus(result.sellerPayoutUsd).toFixed(2)).toBe('12.50');
  });

  it('rejects invalid amounts', () => {
    expect(() => calculateFees('0')).toThrow(MoneyError);
    expect(() => calculateFees('-1')).toThrow(MoneyError);
    expect(() => calculateFees('1.234')).toThrow(MoneyError);
  });

  it('rejects invalid fee percentages', () => {
    expect(() => calculateFees('100', '-1')).toThrow(MoneyError);
    expect(() => calculateFees('100', '51')).toThrow(MoneyError);
    expect(() => assertValidFeePercentage('0.12345')).toThrow(MoneyError);
    expect(assertValidFeePercentage('5').toFixed(0)).toBe('5');
  });
});

describe('assertDealAmountWithinLimits', () => {
  const limits = { minDealAmountUsd: '5', maxDealAmountUsd: '100000' };

  it('accepts amounts inside the range, inclusive', () => {
    expect(assertDealAmountWithinLimits('5', limits).toFixed(2)).toBe('5.00');
    expect(assertDealAmountWithinLimits('100000', limits).toFixed(2)).toBe('100000.00');
  });

  it('rejects amounts outside the range', () => {
    expect(() => assertDealAmountWithinLimits('4.99', limits)).toThrow(MoneyError);
    expect(() => assertDealAmountWithinLimits('100000.01', limits)).toThrow(MoneyError);
  });
});
