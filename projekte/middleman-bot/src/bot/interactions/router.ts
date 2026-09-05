import { MessageFlags, type ButtonInteraction, type Client, type Interaction } from 'discord.js';
import { ForbiddenError, ValidationError } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { commands } from '../commands/index.js';
import { TICKET_DOMAIN } from '../components/ticketPanels.js';
import {
  handleCloseTicketCancel,
  handleCloseTicketConfirm,
  handleCloseTicketRequest,
  handleOpenTicket,
} from './buttons/ticket.js';
import { parseCustomId, type CustomIdParts } from './customId.js';
import { newCorrelationId, type BotContext, type InteractionContext } from './context.js';
import { replyError, replyPrivate } from './respond.js';

const log = createLogger('router');

type ButtonHandler = (
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
) => Promise<void>;

/**
 * Button routing table, keyed by `<domain>:<action>`.
 *
 * A click for an unknown key gets a friendly "out of date" reply instead of an
 * error, so components left over from a previous deployment degrade gracefully.
 */
const BUTTON_HANDLERS: Record<string, ButtonHandler> = {
  [`${TICKET_DOMAIN}:open`]: (interaction, ctx) => handleOpenTicket(interaction, ctx),
  [`${TICKET_DOMAIN}:close`]: (interaction, ctx) => handleCloseTicketRequest(interaction, ctx),
  [`${TICKET_DOMAIN}:closeconfirm`]: (interaction, ctx) =>
    handleCloseTicketConfirm(interaction, ctx),
  [`${TICKET_DOMAIN}:closecancel`]: (interaction) => handleCloseTicketCancel(interaction),
};

/**
 * Single entry point for every interaction.
 *
 * Nothing downstream has to think about crashes: any throw is converted into a
 * user-safe ephemeral reply here, and an expired interaction token is dropped
 * quietly. The bot cannot be taken down by user behaviour.
 */
export function registerInteractionRouter(client: Client, bot: BotContext): void {
  client.on('interactionCreate', (interaction: Interaction) => {
    void route(interaction, bot).catch((error: unknown) => {
      log.error({ err: String(error) }, 'router failed outside of the error boundary');
    });
  });
}

async function route(interaction: Interaction, bot: BotContext): Promise<void> {
  if (!interaction.isRepliable()) return;

  try {
    const ctx = await buildInteractionContext(interaction, bot);

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);

      if (!command) {
        await replyPrivate(interaction, { content: 'That command is no longer available.' });
        return;
      }

      await command.execute(interaction, ctx);
      return;
    }

    if (interaction.isButton()) {
      await routeButton(interaction, ctx);
      return;
    }

    // Select menus and modals arrive with the same guarantees; their handlers
    // are registered in later phases.
    await replyPrivate(interaction, {
      content: 'This control is not available yet.',
    });
  } catch (error) {
    await replyError(interaction, error);
  }
}

async function routeButton(interaction: ButtonInteraction, ctx: InteractionContext): Promise<void> {
  const parts = parseCustomId(interaction.customId);

  if (!parts) {
    log.debug({ customId: interaction.customId }, 'unroutable custom id');
    await replyPrivate(interaction, {
      content:
        '⚠️ This button is from an older version of the bot. Please use the latest message in this ticket.',
    });
    return;
  }

  const handler = BUTTON_HANDLERS[`${parts.domain}:${parts.action}`];

  if (!handler) {
    await replyPrivate(interaction, {
      content: '⚠️ This message is out of date. Please use the latest message in this ticket.',
    });
    return;
  }

  await handler(interaction, ctx, parts);
}

/**
 * Builds the per-interaction context.
 *
 * The member is re-fetched from the guild rather than taken from the payload,
 * so role changes take effect on the very next click.
 */
async function buildInteractionContext(
  interaction: Interaction,
  bot: BotContext,
): Promise<InteractionContext> {
  if (!interaction.inGuild() || !interaction.guild) {
    throw new ForbiddenError(
      'Interaction outside of a guild',
      'This bot can only be used inside a server.',
    );
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    throw new ValidationError(
      `Member ${interaction.user.id} could not be fetched`,
      'Your server membership could not be verified. Please try again.',
    );
  }

  const guildConfig = await bot.config.get(interaction.guild.id);

  return {
    bot,
    guild: interaction.guild,
    member,
    guildConfig,
    correlationId: newCorrelationId(),
  };
}

export const EPHEMERAL = MessageFlags.Ephemeral;
