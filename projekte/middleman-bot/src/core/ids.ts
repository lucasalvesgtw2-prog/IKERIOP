import { randomUUID, randomBytes } from 'node:crypto';

/** Public, human-facing deal identifier: `MM-0001`. */
export function formatPublicDealId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid deal sequence: ${sequence}`);
  }
  return `MM-${String(sequence).padStart(4, '0')}`;
}

/** Ticket channel name: `middleman-0001`. */
export function formatTicketChannelName(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid ticket sequence: ${sequence}`);
  }
  return `middleman-${String(sequence).padStart(4, '0')}`;
}

/** Idempotency / correlation key. */
export function newUuid(): string {
  return randomUUID();
}

/**
 * Short opaque token embedded in component custom ids so a stale button from a
 * previous render cannot be replayed against a newer message.
 */
export function newNonce(bytes = 8): string {
  return randomBytes(bytes).toString('base64url');
}
