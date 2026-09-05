import { toDecimal, type Decimal } from '../../core/money.js';
import { ExternalServiceError } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { getAsset, getNetwork } from '../../config/assets.js';
import { validateTronAddress } from '../address/validators.js';
import {
  type AddressValidationResult,
  type ChainAdapter,
  type IncomingTransfer,
  type TransactionStatus,
} from '../ChainAdapter.js';

const log = createLogger('tron-adapter');

/**
 * Tron, read through the TronGrid v1 HTTP API.
 *
 * TRC20 transfers come from the address's token-transfer feed, which reports
 * the contract, so a transfer of the wrong token to the same address is
 * filtered out rather than counted.
 *
 * Read-only: no keys, no broadcast.
 */
interface TronTrc20Transfer {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  block_timestamp: number;
  token_info?: { address?: string; decimals?: number; symbol?: string };
}

interface TronTxInfo {
  id?: string;
  blockNumber?: number;
  receipt?: { result?: string };
  contractRet?: string;
}

export class TronChainAdapter implements ChainAdapter {
  readonly family = 'tron';
  readonly isTestnet: boolean;
  readonly isMock = false;

  constructor(
    readonly network: string,
    private readonly baseUrl: string,
    private readonly timeoutMs = 12_000,
  ) {
    this.isTestnet = getNetwork(network)?.testnet ?? false;
  }

  validateAddress(address: string, _asset: string): AddressValidationResult {
    return validateTronAddress(address);
  }

  async getIncomingTransfers(
    address: string,
    asset: string,
    options: { minConfirmations?: number } = {},
  ): Promise<IncomingTransfer[]> {
    const definition = getAsset(asset);

    if (!definition) {
      throw new ExternalServiceError(`Unknown asset ${asset}`, { asset });
    }

    const contract = definition.contracts?.[this.network];

    if (!contract) {
      throw new ExternalServiceError(`${definition.symbol} has no contract on ${this.network}`, {
        asset,
        network: this.network,
      });
    }

    const payload = await this.get<{ data?: TronTrc20Transfer[] }>(
      `/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?only_to=true&limit=100&contract_address=${encodeURIComponent(contract)}`,
    );

    const tip = await this.getCurrentBlockHeight();
    const transfers: IncomingTransfer[] = [];

    for (const entry of payload.data ?? []) {
      // Belt and braces: the contract filter is applied server-side, but a
      // transfer of the wrong token must never be counted.
      if (entry.token_info?.address && entry.token_info.address !== contract) continue;
      if (entry.to !== address) continue;

      const decimals = entry.token_info?.decimals ?? definition.decimals;
      const status = await this.getTransactionStatus(entry.transaction_id, asset);

      if (status.failed) continue;
      if (
        options.minConfirmations !== undefined &&
        status.confirmations < options.minConfirmations
      ) {
        continue;
      }

      const transfer: IncomingTransfer = {
        txHash: entry.transaction_id,
        toAddress: address,
        fromAddress: entry.from,
        amount: scaleDown(BigInt(entry.value), decimals),
        asset: definition.symbol,
        network: this.network,
        confirmations: status.confirmations,
        timestamp: new Date(entry.block_timestamp),
      };

      if (status.blockHeight !== undefined) transfer.blockHeight = status.blockHeight;
      transfers.push(transfer);
    }

    void tip;
    return transfers;
  }

  async getTransactionStatus(txHash: string, _asset: string): Promise<TransactionStatus> {
    const info = await this.post<TronTxInfo>('/wallet/gettransactioninfobyid', { value: txHash });

    if (!info || info.blockNumber === undefined) {
      return { txHash, found: false, confirmations: 0, confirmed: false, failed: false };
    }

    const tip = await this.getCurrentBlockHeight();
    const blockNumber = BigInt(info.blockNumber);
    const confirmations = Number(tip - blockNumber + 1n);
    // Anything other than SUCCESS means the contract call reverted.
    const failed = (info.receipt?.result ?? 'SUCCESS') !== 'SUCCESS';

    return {
      txHash,
      found: true,
      confirmations: Math.max(0, confirmations),
      confirmed: !failed && confirmations > 0,
      failed,
      blockHeight: blockNumber,
    };
  }

  async getCurrentBlockHeight(): Promise<bigint> {
    const block = await this.post<{ block_header?: { raw_data?: { number?: number } } }>(
      '/wallet/getnowblock',
      {},
    );

    const height = block.block_header?.raw_data?.number;

    if (height === undefined) {
      throw new ExternalServiceError('Tron API returned no block height');
    }

    return BigInt(height);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`;

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (!response.ok) {
        throw new ExternalServiceError(`Tron API responded ${response.status}`, {
          status: response.status,
          path,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      log.warn({ path, err: String(error) }, 'tron API request failed');
      throw new ExternalServiceError('The Tron API is unreachable', { path }, error);
    } finally {
      clearTimeout(timer);
    }
  }
}

function scaleDown(value: bigint, decimals: number): Decimal {
  return toDecimal(value.toString()).dividedBy(toDecimal(10).pow(decimals));
}
