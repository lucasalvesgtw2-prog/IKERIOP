import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type TextChannel,
} from 'discord.js';
import { type Deal, type Ticket } from '@prisma/client';
import { ConfigurationError, ForbiddenError, NotFoundError } from '../../../core/errors.js';
import { createLogger } from '../../../core/logger.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { type DealState } from '../../../domain/deal/state.js';
import { isParticipant, isStaff } from '../../guards/authorization.js';
import {
  archiveTicketChannel,
  createTicketChannel,
  lockTicketChannel,
} from '../../ticketChannel.js';
import {
  buildCloseConfirmation,
  buildSupportWelcome,
  buildTicketClosedNotice,
  buildTicketPanel,
} from '../../components/ticketPanels.js';
import { ensureRenderNonce, storeRenderNonce } from '../renderNonce.js';
import { newRenderNonce } from '../customId.js';
import { replyPrivate, safeReply } from '../respond.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('ticket-handlers');

/**
 * Opens a new middleman ticket.
 *
 * Sequence matters: the database reservation happens first, so the ticket
 * number is unique even under concurrent clicks; then the Discord channel is
 * created; then the channel id is written back. A failure between the steps
 * abandons the reservation rather than leaving a row that claims to be open.
 */
export async function handleOpenTicket(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'ticket:create', interaction.user.id);

  assertBotCanManageChannels(ctx);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reservation = await ctx.bot.tickets.reserve({
    guildId: ctx.guild.id,
    discordId: interaction.user.id,
    username: interaction.user.username,
    displayName: ctx.member.displayName,
    config: ctx.guildConfig,
  });

  let channel: TextChannel;

  try {
    channel = await createTicketChannel({
      guild: ctx.guild,
      name: reservation.channelName,
      creatorId: interaction.user.id,
      config: ctx.guildConfig,
      topic: `Middleman deal ${reservation.publicDealId} — opened by ${interaction.user.tag}`,
    });
  } catch (error) {
    await ctx.bot.tickets.abandon(reservation, 'Discord channel could not be created');
    log.error(
      { dealId: reservation.deal.id, err: String(error) },
      'failed to create ticket channel',
    );
    throw new ConfigurationError('Ticket channel creation failed', { guildId: ctx.guild.id });
  }

  try {
    await ctx.bot.tickets.attachChannel(reservation, channel.id, interaction.user.id);
  } catch (error) {
    // The channel exists but the database does not know about it. Deleting it
    // keeps the two in step instead of leaving an orphan users can post in.
    await channel.delete('Ticket registration failed').catch(() => undefined);
    await ctx.bot.tickets.abandon(reservation, 'Ticket could not be registered');
    throw error;
  }

  const nonce = newRenderNonce();
  await storeRenderNonce(ctx.bot.redis, reservation.deal.id, nonce);

  const welcome = buildSupportWelcome(ctx.guildConfig);
  const panel = buildTicketPanel({
    publicDealId: reservation.publicDealId,
    creatorDiscordId: interaction.user.id,
    nonce,
    partnerAdded: false,
  });

  await channel.send({
    ...welcome,
    content: `<@${interaction.user.id}>${welcome.content ? ` ${welcome.content}` : ''}`,
    allowedMentions: {
      users: [interaction.user.id],
      roles: ctx.guildConfig.supportRoleId ? [ctx.guildConfig.supportRoleId] : [],
    },
  });

  const panelMessage = await channel.send(panel);

  await ctx.bot.prisma.deal.update({
    where: { id: reservation.deal.id },
    data: { statusMessageId: panelMessage.id },
  });

  await safeReply(interaction, {
    content: `✅ Your ticket is ready: <#${channel.id}> (deal \`${reservation.publicDealId}\`)`,
  });

  log.info(
    { dealId: reservation.deal.id, publicId: reservation.publicDealId, channelId: channel.id },
    'ticket opened',
  );
}

/** Asks for confirmation. This step changes nothing. */
export async function handleCloseTicketRequest(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
): Promise<void> {
  const ticket = await requireTicketForInteraction(interaction, ctx);

  assertMayClose(interaction.user.id, ticket, ctx);

  const confirmation = buildCloseConfirmation({
    publicDealId: ticket.deal.publicId,
    nonce: await ensureRenderNonce(ctx.bot.redis, ticket.deal.id),
  });

  await replyPrivate(interaction, confirmation);
}

export async function handleCloseTicketConfirm(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const ticket = await requireTicketForInteraction(interaction, ctx);
  const actorIsStaff = assertMayClose(interaction.user.id, ticket, ctx);

  await interaction.deferUpdate();

  const result = await withLock(ctx.bot.redis, dealLockKey(ticket.deal.id), () =>
    ctx.bot.tickets.close({
      ticketId: ticket.id,
      dealId: ticket.deal.id,
      actorDiscordId: interaction.user.id,
      reason: actorIsStaff ? 'Closed by staff' : 'Closed by a participant',
    }),
  );

  if (result.alreadyClosed) {
    await replyPrivate(interaction, { content: 'This ticket is already closed.' });
    return;
  }

  const channel = interaction.channel as TextChannel;

  await channel.send({
    embeds: [
      buildTicketClosedNotice({
        publicDealId: ticket.deal.publicId,
        actorDiscordId: interaction.user.id,
        dealCancelled: result.dealCancelled,
      }),
    ],
  });

  const participantIds = [
    ticket.deal.creatorDiscordId,
    ticket.deal.buyerDiscordId,
    ticket.deal.sellerDiscordId,
  ].filter((id): id is string => Boolean(id));

  await lockTicketChannel(channel, participantIds, 'Ticket closed');
  await archiveTicketChannel(channel, ctx.guildConfig);
  await ctx.bot.tickets.markArchived(ticket.id, ticket.deal.id);

  log.info({ dealId: ticket.deal.id, actor: interaction.user.id }, 'ticket closed');
}

export async function handleCloseTicketCancel(interaction: ButtonInteraction): Promise<void> {
  await safeReply(interaction, {
    content: 'The ticket stays open.',
    embeds: [],
    components: [],
  });
}

/**
 * Loads the ticket for the channel the interaction happened in.
 *
 * The channel is the authority, not the custom id: a button copied into another
 * channel cannot reach a ticket it does not belong to.
 */
export async function requireTicketForInteraction(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
): Promise<Ticket & { deal: Deal }> {
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    throw new NotFoundError('Interaction did not happen in a ticket text channel');
  }

  return ctx.bot.tickets.requireByChannelId(interaction.channel.id);
}

/** Returns whether the actor is staff, throwing when they may not close at all. */
function assertMayClose(
  actorDiscordId: string,
  ticket: Ticket & { deal: Deal },
  ctx: InteractionContext,
): boolean {
  const actorIsStaff = isStaff(ctx.member, ctx.guildConfig);

  if (!actorIsStaff && !isParticipant(ticket.deal, actorDiscordId)) {
    throw new ForbiddenError(
      `Actor ${actorDiscordId} is not a participant of ${ticket.deal.id}`,
      'You are not a participant in this deal.',
    );
  }

  ctx.bot.tickets.assertClosable(ticket.deal.status as DealState, actorIsStaff);

  return actorIsStaff;
}

function assertBotCanManageChannels(ctx: InteractionContext): void {
  const me = ctx.guild.members.me;

  if (!me) {
    throw new ConfigurationError('The bot member could not be resolved in this guild');
  }

  const missing: string[] = [];

  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) missing.push('Manage Channels');
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) missing.push('Manage Roles');

  if (missing.length > 0) {
    throw new ConfigurationError(`Bot is missing permissions: ${missing.join(', ')}`, { missing });
  }
}
