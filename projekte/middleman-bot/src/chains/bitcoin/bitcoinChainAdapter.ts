import { toDecimal } from '../../core/money.js';
import { ExternalServiceError } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { getNetwork } from '../../config/assets.js';
import { validateBitcoinAddress } from '../address/validators.js';
import {
  type AddressValidationResult,
  type ChainAdapter,
  type IncomingTransfer,
  type TransactionStatus,
} from '../ChainAdapter.js';

const log = createLogger('bitcoin-adapter');

/**
 * Bitcoin, read through an Esplora-compatible HTTP API (mempool.space,
 * blockstream.info, or a self-hosted Esplora).
 *
 * Read-only by construction: the adapter has no key material and no way to
 * spend. `BTC_RPC_URL` points at the API root.
 */
interface EsploraTx {
  txid: string;
  status?: { confirmed?: boolean; block_height?: number };
  vin?: Array<{ prevout?: { scriptpubkey_address?: string } }>;
  vout?: Array<{ scriptpubkey_address?: string; value?: number }>;
}

const SATOSHIS_PER_BTC = 100_000_000;

export class BitcoinChainAdapter implements ChainAdapter {
  readonly family = 'bitcoin';
  readonly isTestnet: boolean;
  readonly isMock = false;

  constructor(
    readonly network: string,
    private readonly baseUrl: string,
    private readonly timeoutMs = 10_000,
  ) {
    this.isTestnet = getNetwork(network)?.testnet ?? false;
  }

  validateAddress(address: string, _asset: string): AddressValidationResult {
    return validateBitcoinAddress(address, { testnet: this.isTestnet });
  }

  async getIncomingTransfers(
    address: string,
    asset: string,
    options: { minConfirmations?: number } = {},
  ): Promise<IncomingTransfer[]> {
    if (asset.toUpperCase() !== 'BTC') {
      // Bitcoin carries no tokens in this system; asking for one is a bug.
      throw new ExternalServiceError(`Bitcoin adapter cannot handle asset ${asset}`, { asset });
    }

    const [transactions, tipHeight] = await Promise.all([
      this.get<EsploraTx[]>(`/address/${encodeURIComponent(address)}/txs`),
      this.getCurrentBlockHeight(),
    ]);

    const transfers: IncomingTransfer[] = [];

    for (const tx of transactions) {
      // Sum every output paying our address: a sender may split across outputs.
      const satoshis = (tx.vout ?? [])
        .filter((out) => out.scriptpubkey_address === address)
        .reduce((total, out) => total + (out.value ?? 0), 0);

      if (satoshis <= 0) continue;

      const blockHeight = tx.status?.block_height;
      const confirmations =
        tx.status?.confirmed && blockHeight !== undefined ? Number(tipHeight) - blockHeight + 1 : 0;

      if (options.minConfirmations !== undefined && confirmations < options.minConfirmations) {
        continue;
      }

      const transfer: IncomingTransfer = {
        txHash: tx.txid,
        toAddress: address,
        amount: toDecimal(satoshis).dividedBy(SATOSHIS_PER_BTC),
        asset: 'BTC',
        network: this.network,
        confirmations: Math.max(0, confirmations),
      };

      const from = tx.vin?.[0]?.prevout?.scriptpubkey_address;
      if (from) transfer.fromAddress = from;
      if (blockHeight !== undefined) transfer.blockHeight = BigInt(blockHeight);

      transfers.push(transfer);
    }

    return transfers;
  }

  async getTransactionStatus(txHash: string, _asset: string): Promise<TransactionStatus> {
    let tx: EsploraTx;

    try {
      tx = await this.get<EsploraTx>(`/tx/${encodeURIComponent(txHash)}`);
    } catch (error) {
      if (error instanceof ExternalServiceError && error.context.status === 404) {
        return { txHash, found: false, confirmations: 0, confirmed: false, failed: false };
      }
      throw error;
    }

    const tipHeight = await this.getCurrentBlockHeight();
    const blockHeight = tx.status?.block_height;
    const confirmations =
      tx.status?.confirmed && blockHeight !== undefined ? Number(tipHeight) - blockHeight + 1 : 0;

    const status: TransactionStatus = {
      txHash,
      found: true,
      confirmations: Math.max(0, confirmations),
      confirmed: confirmations > 0,
      // Bitcoin has no failed-but-mined transactions.
      failed: false,
    };

    if (blockHeight !== undefined) status.blockHeight = BigInt(blockHeight);
    return status;
  }

  async getCurrentBlockHeight(): Promise<bigint> {
    const height = await this.get<number | string>('/blocks/tip/height');
    return BigInt(String(height).trim());
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`;

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new ExternalServiceError(`Bitcoin API responded ${response.status}`, {
          status: response.status,
          path,
        });
      }

      const text = await response.text();

      try {
        return JSON.parse(text) as T;
      } catch {
        // `/blocks/tip/height` returns a bare number, not JSON.
        return text as unknown as T;
      }
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      log.warn({ path, err: String(error) }, 'bitcoin API request failed');
      throw new ExternalServiceError('The Bitcoin node is unreachable', { path }, error);
    } finally {
      clearTimeout(timer);
    }
  }
}
