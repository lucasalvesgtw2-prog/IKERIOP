import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Discord snowflakes are 17-20 digit numeric strings.
 * Optional IDs are accepted as empty string and normalised to `undefined`.
 */
const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord snowflake (17-20 digits)');

const optionalSnowflake = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional()
  .refine(
    (value) => value === undefined || /^\d{17,20}$/.test(value),
    'must be a Discord snowflake (17-20 digits) or empty',
  );

const optionalString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

const booleanish = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes');

const positiveInt = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

const nonNegativeInt = (defaultValue: number) =>
  z.coerce.number().int().nonnegative().default(defaultValue);

/**
 * Numeric strings that feed financial math are validated as numbers here but
 * are always re-parsed into `Decimal` before being used in a calculation.
 */
const decimalString = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .refine((value) => /^\d+(\.\d+)?$/.test(value.trim()), 'must be a positive decimal number')
    .transform((value) => value.trim());

export const envSchema = z
  .object({
    // Discord
    DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
    DISCORD_CLIENT_ID: snowflake,
    DISCORD_GUILD_ID: snowflake,
    TICKET_CATEGORY_ID: optionalSnowflake,
    TICKET_ARCHIVE_CATEGORY_ID: optionalSnowflake,
    STAFF_LOG_CHANNEL_ID: optionalSnowflake,

    // Roles
    SUPPORT_ROLE_ID: optionalSnowflake,
    MIDDLEMAN_ROLE_ID: optionalSnowflake,
    ADMIN_ROLE_ID: optionalSnowflake,

    // Infrastructure
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    // Fees — canonical deal value is always USD
    DEFAULT_FEE_PERCENTAGE: decimalString('5'),
    MIN_DEAL_AMOUNT_USD: decimalString('5'),
    MAX_DEAL_AMOUNT_USD: decimalString('100000'),

    // Prices
    PRICE_PROVIDER: z.enum(['mock', 'coingecko']).default('mock'),
    PRICE_API_KEY: optionalString,
    PRICE_API_BASE_URL: z.string().url().default('https://api.coingecko.com/api/v3'),
    PRICE_QUOTE_TTL_SECONDS: positiveInt(900),
    PRICE_CACHE_TTL_SECONDS: positiveInt(30),

    // Chain / safety
    LIVE_MODE: booleanish.default('false'),
    LIVE_MODE_CONFIRMATION: optionalString,
    CHAIN_NETWORK_MODE: z.enum(['mock', 'testnet', 'mainnet']).default('mock'),
    CONFIRMATIONS_BTC: positiveInt(3),
    CONFIRMATIONS_ETH: positiveInt(12),
    CONFIRMATIONS_TRON: positiveInt(20),
    BTC_RPC_URL: optionalString,
    EVM_RPC_URL: optionalString,
    TRON_API_URL: optionalString,

    // Signing
    SIGNER_BACKEND: z.enum(['mock', 'manual', 'external']).default('mock'),
    EXTERNAL_SIGNER_URL: optionalString,
    EXTERNAL_SIGNER_TOKEN: optionalString,

    // Lifecycle
    DEAL_EXPIRY_HOURS: positiveInt(72),
    PAYMENT_WINDOW_MINUTES: positiveInt(180),
    TICKET_CLOSE_DELAY_SECONDS: nonNegativeInt(300),

    // Runtime
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    LOG_PRETTY: booleanish.default('false'),
  })
  /**
   * Mainnet safety gate. Mainnet must never switch itself on: it requires
   * LIVE_MODE=true, CHAIN_NETWORK_MODE=mainnet and an explicit acknowledgement
   * string, and it refuses to run with the mock signer.
   */
  .superRefine((env, ctx) => {
    if (env.CHAIN_NETWORK_MODE === 'mainnet' && !env.LIVE_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CHAIN_NETWORK_MODE'],
        message: 'CHAIN_NETWORK_MODE=mainnet requires LIVE_MODE=true',
      });
    }

    if (env.LIVE_MODE) {
      if (env.LIVE_MODE_CONFIRMATION !== 'I_UNDERSTAND_THIS_MOVES_REAL_FUNDS') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['LIVE_MODE_CONFIRMATION'],
          message:
            'LIVE_MODE=true requires LIVE_MODE_CONFIRMATION=I_UNDERSTAND_THIS_MOVES_REAL_FUNDS',
        });
      }

      if (env.SIGNER_BACKEND === 'mock') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SIGNER_BACKEND'],
          message: 'SIGNER_BACKEND=mock cannot be used while LIVE_MODE=true',
        });
      }

      if (env.PRICE_PROVIDER === 'mock') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PRICE_PROVIDER'],
          message: 'PRICE_PROVIDER=mock cannot be used while LIVE_MODE=true',
        });
      }
    }

    if (env.SIGNER_BACKEND === 'external' && !env.EXTERNAL_SIGNER_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EXTERNAL_SIGNER_URL'],
        message: 'SIGNER_BACKEND=external requires EXTERNAL_SIGNER_URL',
      });
    }

    if (env.PRICE_PROVIDER === 'coingecko' && env.LIVE_MODE && !env.PRICE_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PRICE_API_KEY'],
        message: 'A price API key is required for the coingecko provider in live mode',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses and validates an environment record. Exported separately from the
 * module-level singleton so tests can validate arbitrary inputs.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }

  return result.data;
}

let cached: Env | undefined;

/** Lazily validated singleton. Throws on first access if the config is bad. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test helper — clears the memoised environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
