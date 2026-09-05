import {
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type Interaction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from 'discord.js';
import { ForbiddenError, ValidationError } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { commands } from '../commands/index.js';
import { TICKET_DOMAIN } from '../components/ticketPanels.js';
import { DEAL_DOMAIN } from '../components/dealPanels.js';
import {
  handleAddPartnerButton,
  handlePartnerSelect,
  handleRoleSelect,
  handleSwapRoles,
} from './handlers/roleFlow.js';
import {
  handleApproveDeal,
  handleChangesSubmit,
  handleDetailsSubmit,
  handleOpenDetailsModal,
  handleRequestChangesModal,
} from './handlers/detailsFlow.js';
import { handleBuyerCurrencySelect, handleSellerCurrencySelect } from './handlers/currencyFlow.js';
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
  [`${TICKET_DOMAIN}:addpartner`]: handleAddPartnerButton,
  [`${DEAL_DOMAIN}:swaproles`]: handleSwapRoles,
  [`${DEAL_DOMAIN}:details`]: handleOpenDetailsModal,
  [`${DEAL_DOMAIN}:approve`]: handleApproveDeal,
  [`${DEAL_DOMAIN}:changes`]: handleRequestChangesModal,
};

type UserSelectHandler = (
  interaction: UserSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
) => Promise<void>;

type StringSelectHandler = (
  interaction: StringSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
) => Promise<void>;

const USER_SELECT_HANDLERS: Record<string, UserSelectHandler> = {
  [`${DEAL_DOMAIN}:partner`]: handlePartnerSelect,
};

const STRING_SELECT_HANDLERS: Record<string, StringSelectHandler> = {
  [`${DEAL_DOMAIN}:roles`]: handleRoleSelect,
  [`${DEAL_DOMAIN}:paycur`]: handleBuyerCurrencySelect,
  [`${DEAL_DOMAIN}:recvcur`]: handleSellerCurrencySelect,
};

type ModalHandler = (
  interaction: ModalSubmitInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
) => Promise<void>;

const MODAL_HANDLERS: Record<string, ModalHandler> = {
  [`${DEAL_DOMAIN}:detailsmodal`]: handleDetailsSubmit,
  [`${DEAL_DOMAIN}:changesmodal`]: handleChangesSubmit,
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
      await routeComponent(interaction, ctx, BUTTON_HANDLERS);
      return;
    }

    if (interaction.isUserSelectMenu()) {
      await routeComponent(interaction, ctx, USER_SELECT_HANDLERS);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await routeComponent(interaction, ctx, STRING_SELECT_HANDLERS);
      return;
    }

    if (interaction.isModalSubmit()) {
      await routeComponent(interaction, ctx, MODAL_HANDLERS);
      return;
    }

    await replyPrivate(interaction, {
      content: 'This control is not available yet.',
    });
  } catch (error) {
    await replyError(interaction, error);
  }
}

/**
 * Shared component routing.
 *
 * An id that does not parse, or that names a handler this build does not have,
 * gets a friendly "out of date" reply rather than an error — components left
 * over from a previous deployment degrade gracefully instead of looking broken.
 */
/**
 * Anything the router dispatches on: a repliable interaction carrying a custom
 * id. Constraining on that shape rather than on a union of concrete interaction
 * types keeps buttons, selects and modals on a single code path.
 */
type ComponentInteraction = RepliableInteraction & { customId: string };

async function routeComponent<T extends ComponentInteraction>(
  interaction: T,
  ctx: InteractionContext,
  handlers: Record<
    string,
    (interaction: T, ctx: InteractionContext, parts: CustomIdParts) => Promise<void>
  >,
): Promise<void> {
  const parts = parseCustomId(interaction.customId);

  if (!parts) {
    log.debug({ customId: interaction.customId }, 'unroutable custom id');
    await replyPrivate(interaction, {
      content:
        '⚠️ This control is from an older version of the bot. Please use the latest message in this ticket.',
    });
    return;
  }

  const handler = handlers[`${parts.domain}:${parts.action}`];

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
