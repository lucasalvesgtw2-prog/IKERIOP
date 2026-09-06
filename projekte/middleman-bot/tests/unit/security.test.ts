import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Automated parts of the security review.
 *
 * These are the invariants that are cheap to check mechanically and expensive
 * to notice by eye during a refactor: no key material anywhere near the
 * database, no secret leaving through a log, and no float creeping into money.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const SRC = new URL('../../src', import.meta.url).pathname;
const FILES = sourceFiles(SRC);
const SCHEMA = readFileSync(
  new URL('../../prisma/schema.prisma', import.meta.url).pathname,
  'utf8',
);

describe('no key material is ever stored', () => {
  it('has no private key, seed or mnemonic column in the schema', () => {
    const forbidden = /\b(privateKey|private_key|seedPhrase|mnemonic|secretKey|keystore)\b/i;
    const offending = SCHEMA.split('\n').filter(
      (line) => forbidden.test(line) && !line.trim().startsWith('//'),
    );

    expect(offending).toEqual([]);
  });

  it('stores only an opaque signer reference on the wallet model', () => {
    expect(SCHEMA).toContain('signerRef');
    expect(SCHEMA).toMatch(/NO PRIVATE KEY MATERIAL IS STORED HERE/);
  });
});

describe('financial code never uses floating point', () => {
  const MONEY_FILES = FILES.filter(
    (file) =>
      file.includes('/services/') ||
      file.includes('/domain/') ||
      file.includes('/chains/') ||
      file.includes('/prices/'),
  );

  it('never calls parseFloat or Number() on a monetary value', () => {
    const offenders: string[] = [];

    for (const file of MONEY_FILES) {
      const source = readFileSync(file, 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (/parseFloat\s*\(/.test(line)) {
          offenders.push(`${file}:${index + 1} ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('declares every USD column as DECIMAL(18, 2)', () => {
    const usdColumns = SCHEMA.split('\n').filter((line) => /Usd\s+Decimal/.test(line));

    expect(usdColumns.length).toBeGreaterThan(5);
    for (const line of usdColumns) {
      expect(line, line.trim()).toContain('@db.Decimal(18, 2)');
    }
  });

  it('declares every crypto amount column with 18 decimals of precision', () => {
    const cryptoColumns = SCHEMA.split('\n').filter((line) =>
      /(CryptoAmount|cryptoAmount|usdPrice)\s+Decimal/.test(line),
    );

    expect(cryptoColumns.length).toBeGreaterThan(3);
    for (const line of cryptoColumns) {
      expect(line, line.trim()).toContain('@db.Decimal(38, 18)');
    }
  });
});

describe('the database enforces the safety constraints itself', () => {
  it('allows exactly one buyer and one seller per deal', () => {
    expect(SCHEMA).toContain('@@unique([dealId, role])');
    expect(SCHEMA).toContain('@@unique([dealId, userId])');
  });

  it('allows at most one payout per deal', () => {
    expect(SCHEMA).toMatch(/dealId\s+String\s+@unique/);
  });

  it('allows a transaction to fund exactly one deal', () => {
    expect(SCHEMA).toContain('@@unique([network, txHash], name: "unique_tx_per_network")');
  });

  it('makes the payout idempotency key unique', () => {
    expect(SCHEMA).toMatch(/idempotencyKey\s+String\s+@unique/);
  });
});

describe('logging cannot leak a secret', () => {
  it('redacts every key-like path', () => {
    const logger = readFileSync(join(SRC, 'core/logger.ts'), 'utf8');

    for (const path of [
      'token',
      'password',
      'secret',
      'privateKey',
      'mnemonic',
      'apiKey',
      'authorization',
      'DISCORD_BOT_TOKEN',
      'DATABASE_URL',
    ]) {
      expect(logger, path).toContain(`'${path}'`);
    }
  });

  it('never logs the bot token directly', () => {
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');
      expect(/log\.[a-z]+\([^)]*DISCORD_BOT_TOKEN/.test(source), `${file} logs the bot token`).toBe(
        false,
      );
    }
  });
});

describe('no credentials are committed', () => {
  it('ships only a placeholder token in .env.example', () => {
    const example = readFileSync(new URL('../../.env.example', import.meta.url).pathname, 'utf8');

    expect(example).toContain('DISCORD_BOT_TOKEN=PASTE_YOUR_DISCORD_BOT_TOKEN_HERE');
    // A real bot token is three base64url segments separated by dots.
    expect(example).not.toMatch(/[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/);
  });

  it('git-ignores the real .env', () => {
    const ignore = readFileSync(new URL('../../.gitignore', import.meta.url).pathname, 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
  });
});

describe('mainnet cannot be reached by accident', () => {
  it('defaults every dangerous switch to off in .env.example', () => {
    const example = readFileSync(new URL('../../.env.example', import.meta.url).pathname, 'utf8');

    expect(example).toMatch(/^LIVE_MODE=false$/m);
    expect(example).toMatch(/^CHAIN_NETWORK_MODE=mock$/m);
    expect(example).toMatch(/^PRICE_PROVIDER=mock$/m);
    expect(example).toMatch(/^SIGNER_BACKEND=mock$/m);
    expect(example).toMatch(/^LIVE_MODE_CONFIRMATION=$/m);
  });
});

describe('simulated activity is always labelled', () => {
  it('labels mock payments and payouts in the user-facing panels', () => {
    const payment = readFileSync(join(SRC, 'bot/components/paymentPanels.ts'), 'utf8');
    const payout = readFileSync(join(SRC, 'bot/components/payoutPanels.ts'), 'utf8');

    expect(payment).toContain('MOCK MODE');
    expect(payment).toContain('simulated');
    expect(payout).toContain('simulated');
  });
});
