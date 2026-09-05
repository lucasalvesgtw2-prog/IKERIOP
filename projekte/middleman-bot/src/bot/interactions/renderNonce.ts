import { type Redis } from 'ioredis';
import { newRenderNonce } from './customId.js';

/**
 * Anti-replay tokens for rendered panels.
 *
 * Each panel embeds the deal's current nonce in its component ids. Re-rendering
 * rotates it, which invalidates every button on the previous message. The token
 * lives in Redis: it only has to outlive the message that carries it, and a
 * cache miss degrades to "please use the latest message" — never to accepting a
 * stale click.
 */
const NONCE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function renderNonceKey(dealId: string): string {
  return `deal:nonce:${dealId}`;
}

export async function storeRenderNonce(redis: Redis, dealId: string, nonce: string): Promise<void> {
  await redis.set(renderNonceKey(dealId), nonce, 'EX', NONCE_TTL_SECONDS);
}

export async function readRenderNonce(redis: Redis, dealId: string): Promise<string | null> {
  return redis.get(renderNonceKey(dealId));
}

/** Reads the current nonce, creating and storing one if there is none. */
export async function ensureRenderNonce(redis: Redis, dealId: string): Promise<string> {
  const existing = await readRenderNonce(redis, dealId);
  if (existing) return existing;

  const nonce = newRenderNonce();
  await storeRenderNonce(redis, dealId, nonce);
  return nonce;
}

/** Rotates the nonce, invalidating every button on previously sent panels. */
export async function rotateRenderNonce(redis: Redis, dealId: string): Promise<string> {
  const nonce = newRenderNonce();
  await storeRenderNonce(redis, dealId, nonce);
  return nonce;
}
