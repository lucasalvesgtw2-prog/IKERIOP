import { PrismaClient } from '@prisma/client';
import { getEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('prisma');

let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (client) return client;

  const env = getEnv();

  client = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log:
      env.LOG_LEVEL === 'trace' || env.LOG_LEVEL === 'debug'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'warn' }],
  });

  // `params` are intentionally not logged: query parameters can contain
  // addresses and amounts that do not belong in application logs.
  client.$on('warn' as never, (event: { message: string }) => {
    log.warn({ message: event.message }, 'prisma warning');
  });

  return client;
}

export async function connectPrisma(): Promise<void> {
  await getPrisma().$connect();
  log.info('database connected');
}

export async function disconnectPrisma(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = undefined;
  log.info('database disconnected');
}

/** Prisma error code for a unique-constraint violation. */
export const UNIQUE_VIOLATION = 'P2002';
/** Prisma error code for "record not found" on update/delete. */
export const RECORD_NOT_FOUND = 'P2025';

export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
