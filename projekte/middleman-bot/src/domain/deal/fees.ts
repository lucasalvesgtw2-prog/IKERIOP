import {
  type Decimal,
  MoneyError,
  roundUsd,
  toDecimal,
  type DecimalInput,
} from '../../core/money.js';

/**
 * Fee engine.
 *
 * The canonical deal value is USD. The middleman fee is a percentage of the
 * deal value and is added on top of it — the seller's payout is the full deal
 * value, the buyer pays deal value + fee.
 *
 *   fee           = dealAmountUsd × (feePercentage / 100)
 *   buyerTotalUsd = dealAmountUsd + fee
 *   sellerPayout  = dealAmountUsd
 */

export const DEFAULT_FEE_PERCENTAGE = '5';

export interface FeeBreakdown {
  /** The agreed value of the goods/service. */
  dealAmountUsd: Decimal;
  /** The fee percentage that was applied, e.g. `5`. */
  feePercentage: Decimal;
  /** The middleman fee in USD. */
  feeUsd: Decimal;
  /** What the buyer must send: deal + fee. */
  buyerTotalUsd: Decimal;
  /** What the seller receives in USD terms: the full deal value. */
  sellerPayoutUsd: Decimal;
}

export interface FeeLimits {
  minDealAmountUsd: DecimalInput;
  maxDealAmountUsd: DecimalInput;
}

export function assertValidFeePercentage(percentage: DecimalInput): Decimal {
  const value = toDecimal(percentage);

  if (value.isNegative()) {
    throw new MoneyError('The fee percentage cannot be negative.');
  }
  if (value.greaterThan(50)) {
    throw new MoneyError('The fee percentage cannot exceed 50%.');
  }
  if (value.decimalPlaces() > 4) {
    throw new MoneyError('The fee percentage supports at most 4 decimal places.');
  }

  return value;
}

export function assertDealAmountWithinLimits(amountUsd: DecimalInput, limits: FeeLimits): Decimal {
  const amount = toDecimal(amountUsd);
  const min = toDecimal(limits.minDealAmountUsd);
  const max = toDecimal(limits.maxDealAmountUsd);

  if (amount.lessThan(min)) {
    throw new MoneyError(`The minimum deal amount is $${min.toFixed(2)} USD.`);
  }
  if (amount.greaterThan(max)) {
    throw new MoneyError(`The maximum deal amount is $${max.toFixed(2)} USD.`);
  }

  return amount;
}

/**
 * Computes the full USD breakdown for a deal.
 *
 * The fee is rounded to cents (HALF_UP) and the buyer total is derived from the
 * *rounded* fee, so `dealAmount + fee === buyerTotal` holds exactly for the
 * numbers the user is shown. Any other order of operations can produce a
 * displayed total that does not equal the sum of its displayed parts.
 */
export function calculateFees(
  dealAmountUsd: DecimalInput,
  feePercentage: DecimalInput = DEFAULT_FEE_PERCENTAGE,
): FeeBreakdown {
  const amount = toDecimal(dealAmountUsd);

  if (amount.lessThanOrEqualTo(0)) {
    throw new MoneyError('The deal amount must be greater than $0.00.');
  }
  if (amount.decimalPlaces() > 2) {
    throw new MoneyError('USD amounts support at most 2 decimal places.');
  }

  const percentage = assertValidFeePercentage(feePercentage);

  const dealAmount = roundUsd(amount);
  const feeUsd = roundUsd(dealAmount.times(percentage).dividedBy(100));
  const buyerTotalUsd = roundUsd(dealAmount.plus(feeUsd));

  return {
    dealAmountUsd: dealAmount,
    feePercentage: percentage,
    feeUsd,
    buyerTotalUsd,
    sellerPayoutUsd: dealAmount,
  };
}
