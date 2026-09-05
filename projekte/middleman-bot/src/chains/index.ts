import { type Redis } from 'ioredis';
import { getEnv } from '../config/env.js';
import { NETWORKS } from '../config/assets.js';
import { ConfigurationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type ChainAdapter } from './ChainAdapter.js';
import { MockChainAdapter } from './mock/mockChainAdapter.js';
import { BitcoinChainAdapter } from './bitcoin/bitcoinChainAdapter.js';
import { EvmChainAdapter } from './evm/evmChainAdapter.js';
import { TronChainAdapter } from './tron/tronChainAdapter.js';

const log = createLogger('chains');

/**
 * Chain adapter registry.
 *
 * In mock mode every network resolves to the simulator, so a development
 * deployment physically cannot reach a real chain. In testnet and mainnet mode
 * the real adapters are built, and a missing endpoint is a startup-time
 * configuration error rather than a silent fallback to "no transfers found" —
 * which would look exactly like a buyer who has not paid.
 */
export class ChainRegistry {
  private readonly adapters = new Map<string, ChainAdapter>();

  constructor(private readonly redis: Redis) {}

  get(network: string): ChainAdapter {
    const existing = this.adapters.get(network);
    if (existing) return existing;

    const adapter = this.build(network);
    this.adapters.set(network, adapter);
    return adapter;
  }

  private build(network: string): ChainAdapter {
    const env = getEnv();
    const definition = NETWORKS[network];

    if (!definition) {
      throw new ConfigurationError(`Unknown network ${network}`, { network });
    }

    if (env.CHAIN_NETWORK_MODE === 'mock') {
      log.warn({ network }, 'using the MOCK chain adapter — no real chain is contacted');
      return new MockChainAdapter(network, this.redis);
    }

    switch (definition.family) {
      case 'bitcoin':
        return new BitcoinChainAdapter(network, requireEndpoint(env.BTC_RPC_URL, 'BTC_RPC_URL'));
      case 'evm':
        return new EvmChainAdapter(network, requireEndpoint(env.EVM_RPC_URL, 'EVM_RPC_URL'));
      case 'tron':
        return new TronChainAdapter(network, requireEndpoint(env.TRON_API_URL, 'TRON_API_URL'));
      default:
        throw new ConfigurationError(`No adapter for chain family ${definition.family}`, {
          network,
        });
    }
  }
}

function requireEndpoint(value: string | undefined, name: string): string {
  if (!value) {
    throw new ConfigurationError(`${name} must be set when CHAIN_NETWORK_MODE is not "mock"`, {
      variable: name,
    });
  }
  return value;
}

export { type ChainAdapter } from './ChainAdapter.js';
export { MockChainAdapter } from './mock/mockChainAdapter.js';
