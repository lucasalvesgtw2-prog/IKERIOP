import { type Decimal } from '../core/money.js';

/**
 * Payout signing abstraction.
 *
 * NON-NEGOTIABLE RULES:
 *  * No implementation may read a private key or seed phrase from the database,
 *    from a Discord message, or from source code.
 *  * `broadcast` must be idempotent on `idempotencyKey`: calling it twice with
 *    the same key returns the same transaction, it never sends twice.
 *  * The mock signer is the only implementation allowed while LIVE_MODE=false,
 *    and it is rejected by env validation when LIVE_MODE=true.
 */

export interface PayoutRequest {
  /** Stable key derived from the payout row. Replays must be no-ops. */
  idempotencyKey: string;
  asset: string;
  network: string;
  destinationAddress: string;
  /** Amount in whole units of the asset. */
  amount: Decimal;
  /** For traceability in the signer's own logs. */
  reference: string;
}

export interface BroadcastResult {
  txHash: string;
  /** True when this call found an already-broadcast transaction. */
  deduplicated: boolean;
  /** Network fee actually paid, in whole units, when the signer reports it. */
  networkFee?: Decimal;
  /** Set when the signer requires a human to broadcast (manual backend). */
  requiresManualBroadcast?: boolean;
}

export interface Signer {
  readonly name: string;
  readonly isMock: boolean;
  /** Whether this signer is permitted to move mainnet funds. */
  readonly supportsMainnet: boolean;

  /** Estimated network fee for a payout, in whole units of the asset. */
  estimateFee(request: PayoutRequest): Promise<Decimal>;

  /**
   * Signs and broadcasts. MUST be idempotent on `request.idempotencyKey`.
   * MUST throw rather than return a partial result on an unknown outcome —
   * an unknown outcome is reconciled by the payout monitor, never retried
   * blindly.
   */
  broadcast(request: PayoutRequest): Promise<BroadcastResult>;

  /** Looks up a previously submitted payout by idempotency key. */
  lookup(idempotencyKey: string): Promise<BroadcastResult | null>;
}
