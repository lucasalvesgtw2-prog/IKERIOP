import { describe, expect, it } from 'vitest';
import {
  toChecksumAddress,
  validateAddressForFamily,
  validateBitcoinAddress,
  validateEvmAddress,
  validateTronAddress,
} from '../../src/chains/address/validators.js';

/**
 * These are real, well-known addresses. A payout is irreversible, so the
 * validator has to reject the specific mistakes that lose funds: right format
 * but wrong chain, right chain but wrong network, and a mistyped character
 * that a checksum would catch.
 */
const BTC_MAINNET = {
  p2pkh: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  p2sh: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
  bech32: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  taproot: 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
};

const BTC_TESTNET = {
  p2pkh: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
  bech32: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
};

const ETH = {
  checksummed: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  lower: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
};

const TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

describe('Bitcoin addresses', () => {
  it('accepts every mainnet format on mainnet', () => {
    for (const [kind, address] of Object.entries(BTC_MAINNET)) {
      expect(validateBitcoinAddress(address, { testnet: false }).valid, kind).toBe(true);
    }
  });

  it('accepts testnet formats on testnet', () => {
    for (const [kind, address] of Object.entries(BTC_TESTNET)) {
      expect(validateBitcoinAddress(address, { testnet: true }).valid, kind).toBe(true);
    }
  });

  it('rejects a mainnet address on testnet and says why', () => {
    const result = validateBitcoinAddress(BTC_MAINNET.p2pkh, { testnet: true });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mainnet');
  });

  it('rejects a testnet address on mainnet', () => {
    const result = validateBitcoinAddress(BTC_TESTNET.p2pkh, { testnet: false });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('testnet');
  });

  it('rejects a mistyped character via the checksum', () => {
    const broken = `${BTC_MAINNET.p2pkh.slice(0, -1)}b`;
    expect(validateBitcoinAddress(broken, { testnet: false }).valid).toBe(false);
  });

  it('rejects a bech32 address with a broken checksum', () => {
    const broken = `${BTC_MAINNET.bech32.slice(0, -1)}q`;
    expect(validateBitcoinAddress(broken, { testnet: false }).valid).toBe(false);
  });

  it('rejects an Ethereum or Tron address outright', () => {
    expect(validateBitcoinAddress(ETH.checksummed, { testnet: false }).valid).toBe(false);
    expect(validateBitcoinAddress(TRON, { testnet: false }).valid).toBe(false);
  });

  it('rejects empty, oversized and non-ASCII input', () => {
    for (const bad of ['', '   ', 'x'.repeat(200), 'bc1q​test']) {
      expect(validateBitcoinAddress(bad, { testnet: false }).valid, JSON.stringify(bad)).toBe(
        false,
      );
    }
  });
});

describe('Ethereum addresses', () => {
  it('accepts a correctly checksummed address unchanged', () => {
    const result = validateEvmAddress(ETH.checksummed);
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe(ETH.checksummed);
  });

  it('accepts an all-lowercase address and normalises it to the checksummed form', () => {
    const result = validateEvmAddress(ETH.lower);
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe(ETH.checksummed);
  });

  it('rejects a mixed-case address whose checksum does not match', () => {
    // One character's case flipped: EIP-55 exists to catch exactly this.
    const tampered = `0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`;
    const result = validateEvmAddress(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('checksum');
  });

  it('rejects wrong lengths and missing prefixes', () => {
    for (const bad of [
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe',
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAedd',
      '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      '0xZZZeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    ]) {
      expect(validateEvmAddress(bad).valid, bad).toBe(false);
    }
  });

  it('rejects a Bitcoin address', () => {
    expect(validateEvmAddress(BTC_MAINNET.bech32).valid).toBe(false);
  });

  it('produces a stable checksum', () => {
    expect(toChecksumAddress(ETH.lower.slice(2))).toBe(ETH.checksummed);
  });
});

describe('Tron addresses', () => {
  it('accepts a real Tron address', () => {
    expect(validateTronAddress(TRON).valid).toBe(true);
  });

  it('rejects a mistyped character via the checksum', () => {
    expect(validateTronAddress(`${TRON.slice(0, -1)}u`).valid).toBe(false);
  });

  it('rejects a Bitcoin base58 address, which has a different version byte', () => {
    expect(validateTronAddress(BTC_MAINNET.p2pkh).valid).toBe(false);
  });

  it('rejects an Ethereum address', () => {
    expect(validateTronAddress(ETH.checksummed).valid).toBe(false);
  });
});

describe('cross-chain rejection', () => {
  it('never accepts an address for the wrong family', () => {
    const cases: Array<[string, string, boolean]> = [
      [BTC_MAINNET.bech32, 'evm', false],
      [BTC_MAINNET.bech32, 'tron', false],
      [ETH.checksummed, 'bitcoin', false],
      [ETH.checksummed, 'tron', false],
      [TRON, 'bitcoin', false],
      [TRON, 'evm', false],
      [BTC_MAINNET.bech32, 'bitcoin', true],
      [ETH.checksummed, 'evm', true],
      [TRON, 'tron', true],
    ];

    for (const [address, family, expected] of cases) {
      expect(
        validateAddressForFamily(address, family, { testnet: false }).valid,
        `${address} on ${family}`,
      ).toBe(expected);
    }
  });

  it('rejects an unknown family rather than defaulting to accept', () => {
    expect(validateAddressForFamily(ETH.checksummed, 'solana', { testnet: false }).valid).toBe(
      false,
    );
  });
});
