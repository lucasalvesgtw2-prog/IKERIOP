import { type Redis } from 'ioredis';
import { toDecimal, type Decimal } from '../../core/money.js';
import { createLogger } from '../../core/logger.js';
import { getNetwork } from '../../config/assets.js';
import { validateAddressForFamily } from '../address/validators.js';
import {
  type AddressValidationResult,
  type ChainAdapter,
  type IncomingTransfer,
  type TransactionStatus,
} from '../ChainAdapter.js';

const log = createLogger('mock-chain');

/**
 * Simulated chain for development.
 *
 * It is NOT a fake that pretends payments arrived. Nothing appears on this
 * chain unless a developer explicitly injects it with `/admin simulate`, and
 * every message derived from it is labelled MOCK MODE. Confirmations advance
 * on a timer from the moment a transfer was injected, so the confirmation
 * logic itself is exercised for real.
 *
 * State lives in Redis so it survives a restart and is shared across processes.
 */
export interface SimulatedTransfer {
  txHash: string;
  toAddress: string;
  fromAddress: string;
  amount: string;
  asset: string;
  network: string;
  /** Epoch millis when the transfer was injected. */
  injectedAt: number;
  /** Seconds per simulated confirmation. */
  secondsPerConfirmation: number;
  failed?: boolean;
}

const KEY_PREFIX = 'mockchain';

export class MockChainAdapter implements ChainAdapter {
  readonly family: string;
  readonly isTestnet: boolean;
  readonly isMock = true;

  constructor(
    readonly network: string,
    private readonly redis: Redis,
    private readonly secondsPerConfirmation = 5,
  ) {
    const definition = getNetwork(network);
    this.family = definition?.family ?? 'bitcoin';
    this.isTestnet = definition?.testnet ?? true;
  }

  validateAddress(address: string, _asset: string): AddressValidationResult {
    return validateAddressForFamily(address, this.family, { testnet: this.isTestnet });
  }

  /** Injects a simulated transfer. Only reachable from an admin command. */
  async simulateTransfer(
    transfer: Omit<SimulatedTransfer, 'injectedAt' | 'secondsPerConfirmation'>,
  ): Promise<void> {
    const record: SimulatedTransfer = {
      ...transfer,
      injectedAt: Date.now(),
      secondsPerConfirmation: this.secondsPerConfirmation,
    };

    await this.redis.hset(
      this.addressKey(transfer.toAddress),
      transfer.txHash,
      JSON.stringify(record),
    );
    await this.redis.set(this.txKey(transfer.txHash), JSON.stringify(record), 'EX', 7 * 24 * 3600);
    await this.redis.expire(this.addressKey(transfer.toAddress), 7 * 24 * 3600);

    log.warn(
      { txHash: transfer.txHash, address: transfer.toAddress, amount: transfer.amount },
      'SIMULATED transfer injected — mock mode only',
    );
  }

  async getIncomingTransfers(
    address: string,
    asset: string,
    options: { minConfirmations?: number } = {},
  ): Promise<IncomingTransfer[]> {
    const entries = await this.redis.hgetall(this.addressKey(address));
    const transfers: IncomingTransfer[] = [];

    for (const raw of Object.values(entries)) {
      const record = this.parse(raw);
      if (!record) continue;
      if (record.asset.toUpperCase() !== asset.toUpperCase()) continue;
      if (record.network !== this.network) continue;

      const confirmations = this.confirmationsOf(record);

      if (options.minConfirmations !== undefined && confirmations < options.minConfirmations) {
        continue;
      }

      transfers.push({
        txHash: record.txHash,
        toAddress: record.toAddress,
        fromAddress: record.fromAddress,
        amount: toDecimal(record.amount),
        asset: record.asset,
        network: record.network,
        confirmations,
        timestamp: new Date(record.injectedAt),
      });
    }

    return transfers;
  }

  async getTransactionStatus(txHash: string, _asset: string): Promise<TransactionStatus> {
    const raw = await this.redis.get(this.txKey(txHash));
    const record = raw ? this.parse(raw) : null;

    if (!record) {
      return { txHash, found: false, confirmations: 0, confirmed: false, failed: false };
    }

    const confirmations = this.confirmationsOf(record);

    return {
      txHash,
      found: true,
      confirmations,
      confirmed: confirmations > 0 && !record.failed,
      failed: record.failed === true,
    };
  }

  async getCurrentBlockHeight(): Promise<bigint> {
    return BigInt(Math.floor(Date.now() / (this.secondsPerConfirmation * 1000)));
  }

  /** Confirmations grow with wall-clock time since injection. */
  private confirmationsOf(record: SimulatedTransfer): number {
    if (record.failed) return 0;
    const elapsedSeconds = (Date.now() - record.injectedAt) / 1000;
    return Math.max(1, Math.floor(elapsedSeconds / record.secondsPerConfirmation) + 1);
  }

  private parse(raw: string): SimulatedTransfer | null {
    try {
      return JSON.parse(raw) as SimulatedTransfer;
    } catch {
      return null;
    }
  }

  private addressKey(address: string): string {
    return `${KEY_PREFIX}:${this.network}:addr:${address}`;
  }

  private txKey(txHash: string): string {
    return `${KEY_PREFIX}:${this.network}:tx:${txHash}`;
  }
}

/** Amount helper used by the admin simulate command. */
export function formatSimulatedAmount(amount: Decimal, decimals: number): string {
  return amount.toFixed(decimals);
}
