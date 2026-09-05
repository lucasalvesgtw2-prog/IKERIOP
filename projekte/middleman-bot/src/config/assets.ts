/**
 * Asset & network registry.
 *
 * Adding a new coin or network is a data change here plus a chain adapter —
 * no other module hard-codes asset names. An (asset, network) pair is the unit
 * everything else keys off: a "USDT payment" is meaningless without knowing
 * whether it is TRC20 or ERC20.
 */

export const CHAIN_FAMILIES = ['bitcoin', 'evm', 'tron'] as const;
export type ChainFamily = (typeof CHAIN_FAMILIES)[number];

export interface NetworkDefinition {
  /** Stable identifier stored in the database. Never change an existing one. */
  id: string;
  /** Shown to users, e.g. "TRC20 (Tron)". */
  label: string;
  family: ChainFamily;
  /** EVM chain id, where applicable. */
  chainId?: number;
  /** Whether this network definition is a testnet. */
  testnet: boolean;
  /** Explorer URL template; `{tx}` is replaced with the transaction hash. */
  explorerTxUrl?: string;
}

export interface AssetDefinition {
  /** Ticker used in the UI and stored in the database, e.g. "USDT". */
  symbol: string;
  name: string;
  /** On-chain precision. Amounts are rounded UP to this many decimals. */
  decimals: number;
  /** Provider-agnostic id resolved by the price provider. */
  priceId: string;
  /** Networks this asset can be sent on, in display order. */
  networks: string[];
  /**
   * Token contract per network, when the asset is not the native coin.
   * Absence means "native coin of that network".
   */
  contracts?: Record<string, string>;
  /** Warning appended to payment instructions. */
  networkWarning?: string;
}

export const NETWORKS: Readonly<Record<string, NetworkDefinition>> = {
  bitcoin: {
    id: 'bitcoin',
    label: 'Bitcoin',
    family: 'bitcoin',
    testnet: false,
    explorerTxUrl: 'https://mempool.space/tx/{tx}',
  },
  'bitcoin-testnet': {
    id: 'bitcoin-testnet',
    label: 'Bitcoin Testnet',
    family: 'bitcoin',
    testnet: true,
    explorerTxUrl: 'https://mempool.space/testnet/tx/{tx}',
  },
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum (ERC20)',
    family: 'evm',
    chainId: 1,
    testnet: false,
    explorerTxUrl: 'https://etherscan.io/tx/{tx}',
  },
  'ethereum-sepolia': {
    id: 'ethereum-sepolia',
    label: 'Ethereum Sepolia (Testnet)',
    family: 'evm',
    chainId: 11155111,
    testnet: true,
    explorerTxUrl: 'https://sepolia.etherscan.io/tx/{tx}',
  },
  tron: {
    id: 'tron',
    label: 'Tron (TRC20)',
    family: 'tron',
    testnet: false,
    explorerTxUrl: 'https://tronscan.org/#/transaction/{tx}',
  },
  'tron-nile': {
    id: 'tron-nile',
    label: 'Tron Nile (Testnet)',
    family: 'tron',
    testnet: true,
    explorerTxUrl: 'https://nile.tronscan.org/#/transaction/{tx}',
  },
};

export const ASSETS: Readonly<Record<string, AssetDefinition>> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    priceId: 'bitcoin',
    networks: ['bitcoin', 'bitcoin-testnet'],
    networkWarning: 'Only send BTC on the Bitcoin network.',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    priceId: 'ethereum',
    networks: ['ethereum', 'ethereum-sepolia'],
    networkWarning: 'Only send ETH on the Ethereum network. Do not use a layer-2 network.',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    priceId: 'tether',
    networks: ['tron', 'ethereum', 'tron-nile', 'ethereum-sepolia'],
    contracts: {
      tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
    networkWarning:
      'USDT exists on several networks. Sending it on the wrong network will result in a permanent loss of funds.',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    priceId: 'usd-coin',
    networks: ['ethereum', 'tron', 'ethereum-sepolia'],
    contracts: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tron: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
    },
    networkWarning:
      'USDC exists on several networks. Sending it on the wrong network will result in a permanent loss of funds.',
  },
};

export interface AssetNetworkPair {
  asset: AssetDefinition;
  network: NetworkDefinition;
  /** Token contract address, or undefined for a native coin. */
  contract?: string;
}

export function getAsset(symbol: string): AssetDefinition | undefined {
  return ASSETS[symbol.toUpperCase()];
}

export function getNetwork(id: string): NetworkDefinition | undefined {
  return NETWORKS[id.toLowerCase()];
}

/** Resolves an (asset, network) pair, or `undefined` if the combination is invalid. */
export function resolvePair(assetSymbol: string, networkId: string): AssetNetworkPair | undefined {
  const asset = getAsset(assetSymbol);
  const network = getNetwork(networkId);

  if (!asset || !network) return undefined;
  if (!asset.networks.includes(network.id)) return undefined;

  const contract = asset.contracts?.[network.id];
  return contract === undefined ? { asset, network } : { asset, network, contract };
}

export function isValidPair(assetSymbol: string, networkId: string): boolean {
  return resolvePair(assetSymbol, networkId) !== undefined;
}

/**
 * Networks available for an asset in the given runtime mode.
 * Mock and testnet modes only ever expose testnet networks, so a development
 * deployment can never print a mainnet address.
 */
export function networksForAsset(
  assetSymbol: string,
  mode: 'mock' | 'testnet' | 'mainnet',
): NetworkDefinition[] {
  const asset = getAsset(assetSymbol);
  if (!asset) return [];

  const wantTestnet = mode !== 'mainnet';

  return asset.networks
    .map((id) => NETWORKS[id])
    .filter((network): network is NetworkDefinition => network !== undefined)
    .filter((network) => network.testnet === wantTestnet);
}

/** Assets that have at least one usable network in the given mode. */
export function availableAssets(mode: 'mock' | 'testnet' | 'mainnet'): AssetDefinition[] {
  return Object.values(ASSETS).filter((asset) => networksForAsset(asset.symbol, mode).length > 0);
}

export function explorerTxUrl(networkId: string, txHash: string): string | undefined {
  const network = getNetwork(networkId);
  if (!network?.explorerTxUrl) return undefined;
  return network.explorerTxUrl.replace('{tx}', encodeURIComponent(txHash));
}
