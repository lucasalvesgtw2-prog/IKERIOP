import { toDecimal, type Decimal } from '../../core/money.js';
import { ExternalServiceError } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { getAsset, getNetwork } from '../../config/assets.js';
import { validateEvmAddress } from '../address/validators.js';
import {
  type AddressValidationResult,
  type ChainAdapter,
  type IncomingTransfer,
  type TransactionStatus,
} from '../ChainAdapter.js';

const log = createLogger('evm-adapter');

/**
 * EVM chains, read through plain JSON-RPC.
 *
 * Only standard RPC methods are used, so any node or provider works. Native
 * ETH transfers are found by scanning recent blocks; ERC20 transfers are found
 * from `Transfer` logs, which is both cheaper and exact.
 *
 * Read-only: the adapter never calls eth_sendTransaction and holds no keys.
 */

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** How many blocks back a scan looks when no starting point is given. */
const DEFAULT_LOOKBACK_BLOCKS = 5_000n;

interface RpcBlock {
  number: string;
  transactions: Array<{ hash: string; from: string; to: string | null; value: string }>;
}

interface RpcLog {
  transactionHash: string;
  blockNumber: string;
  topics: string[];
  data: string;
  address: string;
}

interface RpcReceipt {
  status: string;
  blockNumber: string;
}

export class EvmChainAdapter implements ChainAdapter {
  readonly family = 'evm';
  readonly isTestnet: boolean;
  readonly isMock = false;

  constructor(
    readonly network: string,
    private readonly rpcUrl: string,
    private readonly timeoutMs = 12_000,
  ) {
    this.isTestnet = getNetwork(network)?.testnet ?? false;
  }

  validateAddress(address: string, _asset: string): AddressValidationResult {
    return validateEvmAddress(address);
  }

  async getIncomingTransfers(
    address: string,
    asset: string,
    options: { sinceBlock?: bigint; minConfirmations?: number } = {},
  ): Promise<IncomingTransfer[]> {
    const definition = getAsset(asset);

    if (!definition) {
      throw new ExternalServiceError(`Unknown asset ${asset}`, { asset });
    }

    const tip = await this.getCurrentBlockHeight();
    const from =
      options.sinceBlock ?? (tip > DEFAULT_LOOKBACK_BLOCKS ? tip - DEFAULT_LOOKBACK_BLOCKS : 0n);
    const contract = definition.contracts?.[this.network];

    const transfers = contract
      ? await this.tokenTransfers(
          address,
          definition.symbol,
          definition.decimals,
          contract,
          from,
          tip,
        )
      : await this.nativeTransfers(address, definition.symbol, from, tip);

    if (options.minConfirmations === undefined) return transfers;

    return transfers.filter((transfer) => transfer.confirmations >= options.minConfirmations!);
  }

  /** ERC20 transfers, read from the contract's `Transfer` logs. */
  private async tokenTransfers(
    address: string,
    symbol: string,
    decimals: number,
    contract: string,
    fromBlock: bigint,
    tip: bigint,
  ): Promise<IncomingTransfer[]> {
    const logs = await this.rpc<RpcLog[]>('eth_getLogs', [
      {
        address: contract,
        fromBlock: toHex(fromBlock),
        toBlock: 'latest',
        topics: [TRANSFER_TOPIC, null, addressTopic(address)],
      },
    ]);

    return logs.map((entry) => {
      const blockNumber = BigInt(entry.blockNumber);
      const transfer: IncomingTransfer = {
        txHash: entry.transactionHash,
        toAddress: address,
        amount: scaleDown(BigInt(entry.data), decimals),
        asset: symbol,
        network: this.network,
        confirmations: Number(tip - blockNumber + 1n),
        blockHeight: blockNumber,
      };

      const fromTopic = entry.topics[1];
      if (fromTopic) transfer.fromAddress = topicToAddress(fromTopic);

      return transfer;
    });
  }

  /**
   * Native transfers, found by scanning blocks.
   *
   * Deliberately bounded: an unbounded scan on a busy chain would hammer the
   * node. Deposits are expected within the payment window, so a short window
   * of recent blocks is enough.
   */
  private async nativeTransfers(
    address: string,
    symbol: string,
    fromBlock: bigint,
    tip: bigint,
  ): Promise<IncomingTransfer[]> {
    const lowered = address.toLowerCase();
    const start = tip - fromBlock > 200n ? tip - 200n : fromBlock;
    const transfers: IncomingTransfer[] = [];

    for (let height = start; height <= tip; height += 1n) {
      const block = await this.rpc<RpcBlock | null>('eth_getBlockByNumber', [toHex(height), true]);
      if (!block) continue;

      for (const tx of block.transactions ?? []) {
        if (tx.to?.toLowerCase() !== lowered) continue;

        const value = BigInt(tx.value);
        if (value === 0n) continue;

        transfers.push({
          txHash: tx.hash,
          toAddress: address,
          fromAddress: tx.from,
          amount: scaleDown(value, 18),
          asset: symbol,
          network: this.network,
          confirmations: Number(tip - height + 1n),
          blockHeight: height,
        });
      }
    }

    return transfers;
  }

  async getTransactionStatus(txHash: string, _asset: string): Promise<TransactionStatus> {
    const receipt = await this.rpc<RpcReceipt | null>('eth_getTransactionReceipt', [txHash]);

    if (!receipt) {
      return { txHash, found: false, confirmations: 0, confirmed: false, failed: false };
    }

    const tip = await this.getCurrentBlockHeight();
    const blockNumber = BigInt(receipt.blockNumber);
    const confirmations = Number(tip - blockNumber + 1n);
    // status 0x0 means the transaction was mined but reverted — funds did not
    // move, so it must never count as a payment.
    const failed = receipt.status === '0x0';

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
    return BigInt(await this.rpc<string>('eth_blockNumber', []));
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ExternalServiceError(`EVM RPC responded ${response.status}`, {
          status: response.status,
          method,
        });
      }

      const payload = (await response.json()) as { result?: T; error?: { message?: string } };

      if (payload.error) {
        throw new ExternalServiceError(`EVM RPC error: ${payload.error.message ?? 'unknown'}`, {
          method,
        });
      }

      return payload.result as T;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      log.warn({ method, err: String(error) }, 'EVM RPC request failed');
      throw new ExternalServiceError('The EVM node is unreachable', { method }, error);
    } finally {
      clearTimeout(timer);
    }
  }
}

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function addressTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
}

function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40)}`;
}

/** Converts a base-unit integer to whole units without any float step. */
function scaleDown(value: bigint, decimals: number): Decimal {
  return toDecimal(value.toString()).dividedBy(toDecimal(10).pow(decimals));
}
