import {
  DiscordAPIError,
  MessageFlags,
  RESTJSONErrorCodes,
  type InteractionReplyOptions,
  type RepliableInteraction,
} from 'discord.js';
import { isAppError, toUserMessage } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('respond');

/**
 * Safe replies.
 *
 * A Discord interaction token is valid for a limited time and can only be
 * acknowledged once. Every reply therefore goes through here, which:
 *   * picks reply / followUp / editReply based on what already happened, and
 *   * swallows the three API errors that mean "the user or Discord moved on",
 *     because there is nothing useful left to do about them.
 */
const IGNORABLE_CODES = new Set<number | string>([
  RESTJSONErrorCodes.UnknownInteraction,
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged,
]);

export function isIgnorableInteractionError(error: unknown): boolean {
  return error instanceof DiscordAPIError && IGNORABLE_CODES.has(error.code);
}

export async function safeReply(
  interaction: RepliableInteraction,
  options: InteractionReplyOptions,
): Promise<void> {
  try {
    if (interaction.deferred) {
      // A deferred reply already committed its ephemerality; `flags` is not
      // accepted on edit and would be a type error as well as an API error.
      const { flags: _flags, ...editable } = options;
      await interaction.editReply(editable);
      return;
    }

    if (interaction.replied) {
      await interaction.followUp(options);
      return;
    }

    await interaction.reply(options);
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      log.debug(
        { interactionId: interaction.id, code: (error as DiscordAPIError).code },
        'interaction expired or already acknowledged',
      );
      return;
    }
    log.warn({ interactionId: interaction.id, err: String(error) }, 'failed to reply');
  }
}

/** Ephemeral reply — the default for anything that is not a shared panel. */
export async function replyPrivate(
  interaction: RepliableInteraction,
  options: Omit<InteractionReplyOptions, 'flags'>,
): Promise<void> {
  await safeReply(interaction, { ...options, flags: MessageFlags.Ephemeral });
}

/**
 * Turns any thrown value into a user-safe ephemeral reply. Internal detail
 * stays in the log; the user sees only `AppError.userMessage`.
 */
export async function replyError(interaction: RepliableInteraction, error: unknown): Promise<void> {
  if (isIgnorableInteractionError(error)) return;

  const message = toUserMessage(error);

  if (isAppError(error)) {
    log.info(
      { code: error.code, context: error.context, message: error.message },
      'interaction rejected',
    );
  } else {
    log.error(
      {
        err: error instanceof Error ? error.message : String(error),
        interactionId: interaction.id,
      },
      'unhandled interaction error',
    );
  }

  await replyPrivate(interaction, { content: `❌ ${message}` });
}
