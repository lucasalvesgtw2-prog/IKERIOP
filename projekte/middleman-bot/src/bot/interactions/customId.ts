import { ValidationError } from '../../core/errors.js';
import { newNonce } from '../../core/ids.js';

/**
 * Structured component ids.
 *
 *   v1:<domain>:<action>:<target>:<nonce>
 *
 * A custom id is UNTRUSTED INPUT. It only tells the router which handler to
 * run and which record to look up; every authority decision is made afterwards
 * against the database. See docs/INTERACTION_FLOW.md.
 *
 * `nonce` is the anti-replay token: it is rotated whenever a panel is
 * re-rendered, so a button from an earlier render of the same deal fails the
 * freshness check instead of acting on stale assumptions.
 */

export const CUSTOM_ID_VERSION = 'v1';

/** Discord rejects a custom id longer than this. */
export const MAX_CUSTOM_ID_LENGTH = 100;

const SEPARATOR = ':';

/** Placeholder for a component that is not bound to a record or a render. */
export const NO_TARGET = '-';
export const NO_NONCE = '-';

/** Segments may not contain the separator, and must stay printable ASCII. */
const SEGMENT_PATTERN = /^[A-Za-z0-9_.\-~]{1,64}$/;

export interface CustomIdParts {
  domain: string;
  action: string;
  /** The record the interaction claims to be about (usually a deal id). */
  target: string;
  nonce: string;
}

export function buildCustomId(parts: {
  domain: string;
  action: string;
  target?: string;
  nonce?: string;
}): string {
  const target = parts.target ?? NO_TARGET;
  const nonce = parts.nonce ?? NO_NONCE;

  for (const [name, value] of Object.entries({
    domain: parts.domain,
    action: parts.action,
    target,
    nonce,
  })) {
    if (!SEGMENT_PATTERN.test(value)) {
      throw new ValidationError(`Invalid custom id segment "${name}": ${value}`);
    }
  }

  const id = [CUSTOM_ID_VERSION, parts.domain, parts.action, target, nonce].join(SEPARATOR);

  if (id.length > MAX_CUSTOM_ID_LENGTH) {
    throw new ValidationError(`Custom id exceeds ${MAX_CUSTOM_ID_LENGTH} characters: ${id}`);
  }

  return id;
}

/**
 * Parses a custom id. Returns `null` for anything that is not a well-formed id
 * of the current version — the router treats that as "not mine" rather than as
 * an error, so components from an older deployment degrade gracefully.
 */
export function parseCustomId(raw: string): CustomIdParts | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_CUSTOM_ID_LENGTH) {
    return null;
  }

  const segments = raw.split(SEPARATOR);
  if (segments.length !== 5) return null;

  const [version, domain, action, target, nonce] = segments as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (version !== CUSTOM_ID_VERSION) return null;

  for (const segment of [domain, action, target, nonce]) {
    if (!SEGMENT_PATTERN.test(segment)) return null;
  }

  return { domain, action, target, nonce };
}

/** Fresh anti-replay token for a newly rendered panel. */
export function newRenderNonce(): string {
  return newNonce(6);
}

/**
 * Constant-time-ish comparison of the nonce a click carried against the nonce
 * the deal currently expects. A mismatch means the user clicked an outdated
 * message.
 */
export function isFreshNonce(received: string, expected: string | null | undefined): boolean {
  if (received === NO_NONCE) return true;
  if (!expected) return false;
  return received === expected;
}
