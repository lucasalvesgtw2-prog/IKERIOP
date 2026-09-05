import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../src/config/env.js';

const BASE = {
  DISCORD_BOT_TOKEN: 'a-token',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_GUILD_ID: '123456789012345679',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
} satisfies NodeJS.ProcessEnv;

describe('environment validation', () => {
  it('applies the documented defaults', () => {
    const env = parseEnv({ ...BASE });
    expect(env.DEFAULT_FEE_PERCENTAGE).toBe('5');
    expect(env.LIVE_MODE).toBe(false);
    expect(env.CHAIN_NETWORK_MODE).toBe('mock');
    expect(env.PRICE_PROVIDER).toBe('mock');
    expect(env.SIGNER_BACKEND).toBe('mock');
  });

  it('rejects a missing token', () => {
    expect(() => parseEnv({ ...BASE, DISCORD_BOT_TOKEN: '' })).toThrow(EnvValidationError);
  });

  it('rejects a malformed snowflake', () => {
    expect(() => parseEnv({ ...BASE, DISCORD_GUILD_ID: 'not-an-id' })).toThrow(EnvValidationError);
  });

  it('treats blank optional role ids as unset', () => {
    const env = parseEnv({ ...BASE, SUPPORT_ROLE_ID: '   ' });
    expect(env.SUPPORT_ROLE_ID).toBeUndefined();
  });

  it('rejects a malformed fee percentage', () => {
    expect(() => parseEnv({ ...BASE, DEFAULT_FEE_PERCENTAGE: 'five' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...BASE, DEFAULT_FEE_PERCENTAGE: '-5' })).toThrow(EnvValidationError);
  });
});

describe('mainnet safety gate', () => {
  it('refuses mainnet without LIVE_MODE', () => {
    expect(() => parseEnv({ ...BASE, CHAIN_NETWORK_MODE: 'mainnet' })).toThrow(EnvValidationError);
  });

  it('refuses LIVE_MODE without the explicit acknowledgement', () => {
    expect(() =>
      parseEnv({
        ...BASE,
        LIVE_MODE: 'true',
        SIGNER_BACKEND: 'manual',
        PRICE_PROVIDER: 'coingecko',
      }),
    ).toThrow(EnvValidationError);
  });

  it('refuses the mock signer in LIVE_MODE', () => {
    expect(() =>
      parseEnv({
        ...BASE,
        LIVE_MODE: 'true',
        LIVE_MODE_CONFIRMATION: 'I_UNDERSTAND_THIS_MOVES_REAL_FUNDS',
        SIGNER_BACKEND: 'mock',
        PRICE_PROVIDER: 'coingecko',
        PRICE_API_KEY: 'key',
      }),
    ).toThrow(EnvValidationError);
  });

  it('refuses the mock price provider in LIVE_MODE', () => {
    expect(() =>
      parseEnv({
        ...BASE,
        LIVE_MODE: 'true',
        LIVE_MODE_CONFIRMATION: 'I_UNDERSTAND_THIS_MOVES_REAL_FUNDS',
        SIGNER_BACKEND: 'manual',
        PRICE_PROVIDER: 'mock',
      }),
    ).toThrow(EnvValidationError);
  });

  it('accepts a fully and explicitly configured live deployment', () => {
    const env = parseEnv({
      ...BASE,
      LIVE_MODE: 'true',
      LIVE_MODE_CONFIRMATION: 'I_UNDERSTAND_THIS_MOVES_REAL_FUNDS',
      CHAIN_NETWORK_MODE: 'mainnet',
      SIGNER_BACKEND: 'manual',
      PRICE_PROVIDER: 'coingecko',
      PRICE_API_KEY: 'a-key',
    });
    expect(env.LIVE_MODE).toBe(true);
    expect(env.CHAIN_NETWORK_MODE).toBe('mainnet');
  });

  it('requires a URL for the external signer', () => {
    expect(() => parseEnv({ ...BASE, SIGNER_BACKEND: 'external' })).toThrow(EnvValidationError);
  });
});
