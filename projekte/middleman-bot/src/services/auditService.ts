import { type PrismaClient, type Prisma } from '@prisma/client';
import { type AuditAction } from '../domain/auditActions.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('audit');

/**
 * Keys whose values must never reach the audit log, whatever a caller passes.
 * This is a backstop: services are expected not to hand secrets over at all.
 */
const FORBIDDEN_KEY_PATTERN =
  /(token|secret|password|passphrase|private[_-]?key|privkey|seed|mnemonic|api[_-]?key|authorization|cookie|session|credential|signature)/i;

const MAX_STRING_LENGTH = 2_000;
const MAX_DEPTH = 4;

export type AuditMetadata = Record<string, unknown>;

/**
 * Recursively removes secret-looking keys and truncates long strings.
 * Anything it cannot represent safely is replaced by a type marker rather than
 * being dropped silently, so the shape of the record stays readable.
 */
export function sanitizeMetadata(value: unknown, depth = 0): Prisma.InputJsonValue {
  if (value === null || value === undefined) return null as unknown as Prisma.InputJsonValue;

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();

  // Decimal and other value objects expose toString(); use it rather than
  // letting JSON.stringify produce an opaque object.
  if (typeof value === 'object' && 'toFixed' in value && typeof value.toFixed === 'function') {
    return String(value);
  }

  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitizeMetadata(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) {
        output[key] = '[REDACTED]';
        continue;
      }
      output[key] = sanitizeMetadata(entry, depth + 1);
    }
    return output;
  }

  return `[${typeof value}]`;
}

export interface AuditEntry {
  action: AuditAction;
  dealId?: string | null;
  actorId?: string | null;
  actorDiscordId?: string | null;
  metadata?: AuditMetadata;
  correlationId?: string | null;
}

/** Minimal surface the audit writer needs, so it works inside a transaction. */
export type AuditClient = Pick<PrismaClient, 'auditLog'>;

/**
 * Appends to the audit trail.
 *
 * Auditing must never break the operation it is recording, so a failure here
 * is logged and swallowed. The operation's own transaction is the source of
 * truth; when the caller passes a transaction client the row is written inside
 * it and shares its atomicity.
 */
export async function writeAudit(client: AuditClient, entry: AuditEntry): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        action: entry.action,
        dealId: entry.dealId ?? null,
        actorId: entry.actorId ?? null,
        actorDiscordId: entry.actorDiscordId ?? null,
        correlationId: entry.correlationId ?? null,
        metadata: entry.metadata ? sanitizeMetadata(entry.metadata) : undefined,
      },
    });
  } catch (error) {
    log.error(
      { action: entry.action, dealId: entry.dealId, err: String(error) },
      'failed to write audit log entry',
    );
  }
}
