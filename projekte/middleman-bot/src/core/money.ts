import { Decimal } from 'decimal.js';
import { AppError } from './errors.js';

/**
 * Financial arithmetic for the escrow bot.
 *
 * RULES (see docs/ARCHITECTURE.md):
 *  1. The canonical value of every deal is USD. Crypto is only a settlement rail.
 *  2. Never use JavaScript floating point (`number`) for money. Every amount is a
 *     `Decimal` in memory and a `DECIMAL(...)` column in PostgreSQL.
 *  3. USD is rounded to 2 decimals, HALF_UP, and only at display/persist time.
 *  4. Crypto amounts are rounded UP to the asset's precision so an under-payment
 *     can never be produced by rounding.
 */

// 34 significant digits is comfortably above wei-precision requirements.
Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export { Decimal };

export const USD_DECIMALS = 2;

/**
 * A money-handling failure.
 *
 * It extends `AppError` with the VALIDATION code because every message thrown
 * from this module is written to be read by the person who typed the value —
 * "Enter the deal amount as a plain number in USD" is exactly what the seller
 * needs to see. Without this, the interaction error boundary would fall back
 * to a generic "Something went wrong" and the user would never learn what was
 * wrong with their input.
 */
export class MoneyError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message, { userMessage: message });
  }
}

export type DecimalInput = Decimal | string | number;

/**
 * Converts an input into a Decimal.
 *
 * `number` is accepted only because Prisma and JSON payloads occasionally hand
 * one over; it is routed through `String()` so the value is never widened by a
 * second float conversion. Prefer passing strings.
 */
export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;

  const raw = typeof value === 'number' ? String(value) : value.trim();

  if (raw.length === 0) {
    throw new MoneyError('Empty value cannot be converted to a decimal');
  }

  let parsed: Decimal;
  try {
    parsed = new Decimal(raw);
  } catch {
    throw new MoneyError(`"${raw}" is not a valid decimal number`);
  }

  if (!parsed.isFinite()) {
    throw new MoneyError(`"${raw}" is not a finite decimal number`);
  }

  return parsed;
}

/**
 * Parses free-form user input (e.g. a Discord modal field) into a USD amount.
 * Accepts `$1,234.56`, `1234.56`, `1 234,56` is rejected on purpose: an
 * ambiguous separator must not be silently guessed for a financial value.
 */
export function parseUserUsdAmount(input: string): Decimal {
  const cleaned = input.trim().replace(/^\$/, '').replace(/\s/g, '').replace(/,/g, '');

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new MoneyError('Enter the deal amount as a plain number in USD, for example: 100.00');
  }

  const value = new Decimal(cleaned);

  if (value.decimalPlaces() > USD_DECIMALS) {
    throw new MoneyError('USD amounts support at most 2 decimal places.');
  }

  if (value.lessThanOrEqualTo(0)) {
    throw new MoneyError('The deal amount must be greater than $0.00.');
  }

  return value;
}

/** Rounds a USD value to cents (HALF_UP). */
export function roundUsd(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(USD_DECIMALS, Decimal.ROUND_HALF_UP);
}

/**
 * Rounds a crypto amount UP to the asset precision.
 *
 * Rounding up means the buyer is asked for at most one "dust" unit more than
 * the exact quote, which keeps the received amount at or above the required
 * USD value. Rounding down could under-fund the escrow.
 */
export function roundCryptoUp(value: DecimalInput, decimals: number): Decimal {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new MoneyError(`Invalid crypto precision: ${decimals}`);
  }
  return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_UP);
}

/** Groups the integer part of a fixed-point string with thousands separators. */
function groupThousands(fixed: string): string {
  const [whole = '0', fraction = ''] = fixed.split('.');
  const negative = whole.startsWith('-');
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Formats a USD value for display: `$1,234.56`. */
export function formatUsd(value: DecimalInput, decimals: number = USD_DECIMALS): string {
  const fixed = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals);
  const negative = fixed.startsWith('-');
  return `${negative ? '-' : ''}$${groupThousands(negative ? fixed.slice(1) : fixed)}`;
}

/** Formats a crypto amount with the asset's precision and no exponent form. */
export function formatCrypto(value: DecimalInput, decimals: number, symbol?: string): string {
  const fixed = toDecimal(value).toFixed(decimals, Decimal.ROUND_DOWN);
  return symbol ? `${fixed} ${symbol}` : fixed;
}

/**
 * Formats a USD unit price for the audit trail. Sub-dollar assets keep 8
 * decimals so a quote for a cheap token stays reconstructable.
 */
export function formatUsdPrice(value: DecimalInput): string {
  const price = toDecimal(value);
  return formatUsd(price, price.abs().greaterThanOrEqualTo(1) ? 2 : 8);
}

/** Serialises a Decimal for storage — never a float, always a string. */
export function toDbString(value: DecimalInput, decimals: number): string {
  return toDecimal(value).toFixed(decimals);
}
