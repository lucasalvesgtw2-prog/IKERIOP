import { bech32, bech32m } from 'bech32';
import bs58check from 'bs58check';
import { keccak_256 } from 'js-sha3';
import { type AddressValidationResult } from '../ChainAdapter.js';

/**
 * Address validation, per chain family.
 *
 * A payout is irreversible, so an address is checked for far more than
 * "looks about right": the encoding is decoded, the checksum verified, and the
 * network prefix matched. A Bitcoin address must be rejected for an Ethereum
 * payout, and a mainnet address rejected on testnet.
 */

const MAX_ADDRESS_LENGTH = 120;

function invalid(reason: string): AddressValidationResult {
  return { valid: false, reason };
}

function valid(normalized: string): AddressValidationResult {
  return { valid: true, normalized };
}

/** Rejects anything that cannot be an address before any decoding is tried. */
function preCheck(address: string): string | null {
  const trimmed = address.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_ADDRESS_LENGTH) return null;
  // Addresses are printable ASCII; anything else is a paste accident or worse.
  if (!/^[\x21-\x7e]+$/.test(trimmed)) return null;

  return trimmed;
}

// ---------------------------------------------------------------------------
// Bitcoin
// ---------------------------------------------------------------------------

/** Base58 version bytes: mainnet P2PKH/P2SH, then testnet P2PKH/P2SH. */
const BTC_BASE58_VERSIONS = {
  mainnet: [0x00, 0x05],
  testnet: [0x6f, 0xc4],
} as const;

const BTC_BECH32_PREFIX = { mainnet: 'bc', testnet: 'tb' } as const;

export function validateBitcoinAddress(
  address: string,
  options: { testnet: boolean },
): AddressValidationResult {
  const trimmed = preCheck(address);
  if (!trimmed) return invalid('That does not look like a Bitcoin address.');

  const network = options.testnet ? 'testnet' : 'mainnet';
  const expectedPrefix = BTC_BECH32_PREFIX[network];

  // --- bech32 / bech32m (P2WPKH, P2WSH, P2TR) ---
  const lower = trimmed.toLowerCase();

  if (lower.startsWith(`${expectedPrefix}1`) || looksBech32(lower)) {
    const decoded = decodeBech32(lower);

    if (!decoded) {
      return invalid('That Bitcoin address has an invalid checksum.');
    }

    if (decoded.prefix !== expectedPrefix) {
      return invalid(
        `That is a ${decoded.prefix === 'bc' ? 'mainnet' : 'testnet'} Bitcoin address, but this deal uses the ${network} network.`,
      );
    }

    const version = decoded.words[0];
    if (version === undefined || version > 16) {
      return invalid('That Bitcoin address uses an unsupported witness version.');
    }

    // Witness v0 must be bech32; v1+ (Taproot) must be bech32m.
    if (version === 0 && decoded.encoding !== 'bech32') {
      return invalid('That Bitcoin address has an invalid checksum.');
    }
    if (version > 0 && decoded.encoding !== 'bech32m') {
      return invalid('That Bitcoin address has an invalid checksum.');
    }

    // Mixed case is explicitly forbidden by BIP-173.
    if (trimmed !== lower && trimmed !== trimmed.toUpperCase()) {
      return invalid('A Bitcoin address must not mix upper and lower case.');
    }

    return valid(lower);
  }

  // --- base58check (legacy P2PKH / P2SH) ---
  let decoded: Uint8Array;
  try {
    decoded = bs58check.decode(trimmed);
  } catch {
    return invalid('That does not look like a valid Bitcoin address.');
  }

  if (decoded.length !== 21) {
    return invalid('That Bitcoin address has an unexpected length.');
  }

  const version = decoded[0]!;
  const accepted: readonly number[] = BTC_BASE58_VERSIONS[network];

  if (!accepted.includes(version)) {
    const other = options.testnet ? 'mainnet' : 'testnet';
    const isOtherNetwork = (
      BTC_BASE58_VERSIONS[options.testnet ? 'mainnet' : 'testnet'] as readonly number[]
    ).includes(version);

    return invalid(
      isOtherNetwork
        ? `That is a ${other} Bitcoin address, but this deal uses the ${network} network.`
        : 'That is not a Bitcoin address.',
    );
  }

  return valid(trimmed);
}

function looksBech32(value: string): boolean {
  return /^(bc|tb)1[02-9ac-hj-np-z]{6,}$/.test(value);
}

function decodeBech32(
  value: string,
): { prefix: string; words: number[]; encoding: 'bech32' | 'bech32m' } | null {
  try {
    const decoded = bech32.decode(value, MAX_ADDRESS_LENGTH);
    return { prefix: decoded.prefix, words: decoded.words, encoding: 'bech32' };
  } catch {
    // Not bech32 — try bech32m, used from witness version 1 (Taproot).
  }

  try {
    const decoded = bech32m.decode(value, MAX_ADDRESS_LENGTH);
    return { prefix: decoded.prefix, words: decoded.words, encoding: 'bech32m' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// EVM
// ---------------------------------------------------------------------------

/**
 * EVM addresses are network-agnostic, so there is no testnet variant to check.
 * A mixed-case address carries an EIP-55 checksum and is verified against it;
 * an all-lower or all-upper address has no checksum to verify.
 */
export function validateEvmAddress(address: string): AddressValidationResult {
  const trimmed = preCheck(address);
  if (!trimmed) return invalid('That does not look like an Ethereum address.');

  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return invalid('An Ethereum address must be 0x followed by 40 hexadecimal characters.');
  }

  const body = trimmed.slice(2);
  const isLower = body === body.toLowerCase();
  const isUpper = body === body.toUpperCase();

  if (!isLower && !isUpper) {
    if (toChecksumAddress(body) !== trimmed) {
      return invalid(
        'That Ethereum address failed its checksum. Please copy it again from your wallet.',
      );
    }
    return valid(trimmed);
  }

  // No checksum information available; normalise to the checksummed form.
  return valid(toChecksumAddress(body));
}

export function toChecksumAddress(bodyWithoutPrefix: string): string {
  const lower = bodyWithoutPrefix.toLowerCase();
  const hash = keccak_256(lower);

  let out = '0x';
  for (let i = 0; i < lower.length; i += 1) {
    const char = lower[i]!;
    out += Number.parseInt(hash[i]!, 16) >= 8 ? char.toUpperCase() : char;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Tron
// ---------------------------------------------------------------------------

/** Tron base58check addresses carry a 0x41 version byte and start with `T`. */
const TRON_VERSION_BYTE = 0x41;

export function validateTronAddress(address: string): AddressValidationResult {
  const trimmed = preCheck(address);
  if (!trimmed) return invalid('That does not look like a Tron address.');

  if (!trimmed.startsWith('T')) {
    return invalid('A Tron address starts with the letter T.');
  }

  let decoded: Uint8Array;
  try {
    decoded = bs58check.decode(trimmed);
  } catch {
    return invalid('That Tron address failed its checksum. Please copy it again from your wallet.');
  }

  if (decoded.length !== 21 || decoded[0] !== TRON_VERSION_BYTE) {
    return invalid('That is not a valid Tron address.');
  }

  return valid(trimmed);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function validateAddressForFamily(
  address: string,
  family: string,
  options: { testnet: boolean },
): AddressValidationResult {
  switch (family) {
    case 'bitcoin':
      return validateBitcoinAddress(address, options);
    case 'evm':
      return validateEvmAddress(address);
    case 'tron':
      return validateTronAddress(address);
    default:
      return invalid('That network is not supported.');
  }
}
