import { type Decimal } from '../core/money.js';

/**
 * Blockchain abstraction.
 *
 * One adapter per chain family (bitcoin / evm / tron). Adapters are read-only
 * with respect to funds: they observe the chain and validate addresses. Moving
 * money is the exclusive job of a `Signer` (src/wallets), so a bug in an
 * adapter can never spend anything.
 */

export interface IncomingTransfer {
  txHash: string;
  /** Address the funds arrived at. */
  toAddress: string;
  fromAddress?: string;
  /** Amount in whole units of the asset (not satoshi/wei). */
  amount: Decimal;
  asset: string;
  network: string;
  confirmations: number;
  blockHeight?: bigint;
  /** Set once the transfer is in a block. */
  timestamp?: Date;
}

export interface TransactionStatus {
  txHash: string;
  found: boolean;
  confirmations: number;
  /** True once the chain considers the transaction irreversible enough. */
  confirmed: boolean;
  failed: boolean;
  blockHeight?: bigint;
}

export interface AddressValidationResult {
  valid: boolean;
  /** Canonical form (e.g. EIP-55 checksummed) when valid. */
  normalized?: string;
  /** User-facing explanation when invalid. */
  reason?: string;
}

export interface ChainAdapter {
  readonly network: string;
  readonly family: string;
  /** True for mock/testnet adapters. */
  readonly isTestnet: boolean;
  readonly isMock: boolean;

  /** Validates an address for this network and the given asset. */
  validateAddress(address: string, asset: string): AddressValidationResult;

  /** Transfers of `asset` received at `address` since `sinceBlock`. */
  getIncomingTransfers(
    address: string,
    asset: string,
    options?: { sinceBlock?: bigint; minConfirmations?: number },
  ): Promise<IncomingTransfer[]>;

  /** Independent verification of a specific transaction. */
  getTransactionStatus(txHash: string, asset: string): Promise<TransactionStatus>;

  getCurrentBlockHeight(): Promise<bigint>;
}
