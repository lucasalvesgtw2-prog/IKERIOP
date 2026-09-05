import { type AssetDefinition } from '../../config/assets.js';
import { MoneyError, roundCryptoUp, roundUsd, toDecimal, type Decimal } from '../../core/money.js';

/**
 * USD → crypto conversion.
 *
 * This is the only place in the codebase where a USD amount becomes a crypto
 * amount. Keeping it here — pure, with no I/O — means the arithmetic is
 * identical whatever provider supplied the price, and that every stored quote
 * can be recomputed and checked later.
 *
 *   cryptoAmount = ceil(usdAmount / usdPrice, assetDecimals)
 *
 * Rounding is UP, always. Rounding down would ask the buyer for fractionally
 * less than the deal is worth, and escrow would be short.
 */
export interface QuoteInput {
  usdAmount: Decimal;
  usdPrice: Decimal;
  asset: AssetDefinition;
  /** How long the quote stays valid. */
  ttlSeconds: number;
  /** Injected so a test can pin the clock. */
  now?: Date;
}

export interface Quote {
  asset: string;
  assetDecimals: number;
  /** USD value of one unit of the asset. */
  usdPrice: Decimal;
  /** The USD amount this quote was applied to. */
  usdAmount: Decimal;
  /** The crypto amount the payer must send. */
  cryptoAmount: Decimal;
  quotedAt: Date;
  expiresAt: Date;
}

export function calculateQuote(input: QuoteInput): Quote {
  const usdAmount = roundUsd(input.usdAmount);
  const usdPrice = toDecimal(input.usdPrice);

  if (usdAmount.lessThanOrEqualTo(0)) {
    throw new MoneyError('A quote requires a positive USD amount.');
  }

  if (!usdPrice.isFinite() || usdPrice.lessThanOrEqualTo(0)) {
    throw new MoneyError('A quote requires a positive asset price.');
  }

  if (input.ttlSeconds <= 0) {
    throw new MoneyError('A quote must have a positive lifetime.');
  }

  const quotedAt = input.now ?? new Date();

  return {
    asset: input.asset.symbol,
    assetDecimals: input.asset.decimals,
    usdPrice,
    usdAmount,
    cryptoAmount: roundCryptoUp(usdAmount.dividedBy(usdPrice), input.asset.decimals),
    quotedAt,
    expiresAt: new Date(quotedAt.getTime() + input.ttlSeconds * 1000),
  };
}

export function isQuoteExpired(quote: { expiresAt: Date }, now: Date = new Date()): boolean {
  return quote.expiresAt.getTime() <= now.getTime();
}

/**
 * Recomputes a stored quote's crypto amount from its own inputs.
 *
 * The audit trail records `usdPrice`, `usdAmount` and `assetDecimals`, so any
 * amount the bot ever asked for can be re-derived and checked. A mismatch
 * means the stored row was tampered with or the arithmetic changed.
 */
export function verifyStoredQuote(stored: {
  usdAmount: Decimal | string;
  usdPrice: Decimal | string;
  cryptoAmount: Decimal | string;
  assetDecimals: number;
}): boolean {
  const expected = roundCryptoUp(
    toDecimal(stored.usdAmount).dividedBy(toDecimal(stored.usdPrice)),
    stored.assetDecimals,
  );

  return expected.equals(toDecimal(stored.cryptoAmount));
}

/**
 * The amount below the quoted figure that still counts as paid.
 *
 * Some wallets deduct their fee from the amount sent. A tolerance of one unit
 * at the asset's precision absorbs the rounding-up above without accepting a
 * meaningful shortfall; anything larger is an under-payment and goes to staff.
 */
export function paymentTolerance(asset: AssetDefinition): Decimal {
  return toDecimal(1).dividedBy(toDecimal(10).pow(asset.decimals));
}
