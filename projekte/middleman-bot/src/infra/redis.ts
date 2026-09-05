import { Redis } from 'ioredis';
import { getEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('redis');

let client: Redis | undefined;

export function getRedis(): Redis {
  if (client) return client;

  const env = getEnv();

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // Discord interactions have a 3 second acknowledgement budget; a slow
    // cache must fail fast rather than hold the interaction open.
    connectTimeout: 2_000,
    enableOfflineQueue: false,
  });

  client.on('error', (error: Error) => {
    log.error({ err: error.message }, 'redis error');
  });
  client.on('connect', () => log.info('redis connected'));

  return client;
}

export async function connectRedis(): Promise<void> {
  await getRedis().connect();
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  await client.quit();
  client = undefined;
  log.info('redis disconnected');
}
