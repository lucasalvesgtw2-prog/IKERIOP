/**
 * Error taxonomy.
 *
 * Every error that can reach a Discord interaction carries a `userMessage`
 * that is safe to show to an end user. Internal detail (stack traces, SQL,
 * provider responses) stays in the structured log and never reaches Discord.
 */

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'LOCKED'
  | 'EXTERNAL_SERVICE'
  | 'CONFIGURATION'
  | 'INTERNAL';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly context: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { userMessage?: string; context?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.userMessage = options.userMessage ?? DEFAULT_USER_MESSAGES[code];
    this.context = options.context ?? {};
  }
}

const DEFAULT_USER_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION: 'That input could not be accepted. Please check it and try again.',
  NOT_FOUND: 'This deal could not be found. It may have been closed.',
  FORBIDDEN: 'You are not allowed to perform this action.',
  INVALID_STATE: 'This action is not available at the current stage of the deal.',
  CONFLICT: 'Someone else just changed this deal. Please review the latest message.',
  RATE_LIMITED: 'You are doing that too quickly. Please wait a moment and try again.',
  LOCKED: 'This deal is currently being processed. Please try again in a few seconds.',
  EXTERNAL_SERVICE: 'An external service is temporarily unavailable. Please try again shortly.',
  CONFIGURATION: 'The bot is not configured correctly. Please contact an administrator.',
  INTERNAL: 'Something went wrong. Support has been notified.',
};

export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string, context?: Record<string, unknown>) {
    super('VALIDATION', message, { userMessage: userMessage ?? message, context });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('NOT_FOUND', message, { context });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, userMessage?: string, context?: Record<string, unknown>) {
    super('FORBIDDEN', message, { userMessage, context });
  }
}

export class InvalidStateError extends AppError {
  constructor(message: string, userMessage?: string, context?: Record<string, unknown>) {
    super('INVALID_STATE', message, { userMessage, context });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, userMessage?: string, context?: Record<string, unknown>) {
    super('CONFLICT', message, { userMessage, context });
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super('RATE_LIMITED', message, {
      userMessage: `You are doing that too quickly. Try again in ${Math.ceil(
        retryAfterMs / 1000,
      )} second(s).`,
      context: { retryAfterMs },
    });
  }
}

export class LockedError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('LOCKED', message, { context });
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super('EXTERNAL_SERVICE', message, { context, cause });
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFIGURATION', message, { context });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Extracts a user-safe message from any thrown value. */
export function toUserMessage(error: unknown): string {
  if (isAppError(error)) return error.userMessage;
  return DEFAULT_USER_MESSAGES.INTERNAL;
}
