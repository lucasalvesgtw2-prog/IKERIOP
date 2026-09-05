import { pino, type Logger, type LoggerOptions } from 'pino';
import { getEnv } from '../config/env.js';

/**
 * Structured logging.
 *
 * Secrets must never be logged. The redaction list below is a hard backstop —
 * the primary rule is that services simply do not pass secrets into log calls.
 */
const REDACTED_PATHS = [
  'token',
  'password',
  'secret',
  'privateKey',
  'private_key',
  'seed',
  'seedPhrase',
  'mnemonic',
  'apiKey',
  'api_key',
  'authorization',
  'DISCORD_BOT_TOKEN',
  'PRICE_API_KEY',
  'EXTERNAL_SIGNER_TOKEN',
  'DATABASE_URL',
  'REDIS_URL',
  '*.token',
  '*.password',
  '*.secret',
  '*.privateKey',
  '*.mnemonic',
  '*.apiKey',
  '*.authorization',
  'req.headers.authorization',
];

function buildOptions(): LoggerOptions {
  const env = getEnv();

  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: 'middleman-bot', env: env.NODE_ENV },
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (env.LOG_PRETTY) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    };
  }

  return options;
}

let root: Logger | undefined;

export function getLogger(): Logger {
  root ??= pino(buildOptions());
  return root;
}

/** Creates a child logger with a stable component name. */
export function createLogger(component: string, bindings: Record<string, unknown> = {}): Logger {
  return getLogger().child({ component, ...bindings });
}
