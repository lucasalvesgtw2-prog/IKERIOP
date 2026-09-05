import {
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
  type StringSelectMenuInteraction,
  type TextChannel,
  type UserSelectMenuInteraction,
} from 'discord.js';
import { type Deal } from '@prisma/client';
import { ValidationError } from '../../../core/errors.js';
import { createLogger } from '../../../core/logger.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { type DealState } from '../../../domain/deal/state.js';
import { assertDealStatus } from '../../../services/dealTransition.js';
import { requireCreator } from '../../guards/authorization.js';
import { grantChannelAccess } from '../../ticketChannel.js';
import {
  buildDealDetailsPrompt,
  buildPartnerSelect,
  buildRoleSelect,
  buildRolesAssignedPanel,
  type Participant,
} from '../../components/dealPanels.js';
import { buildTicketPanel } from '../../components/ticketPanels.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { replyPrivate, safeReply } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('role-flow');

/**
 * States in which the roles may still be swapped: after they are assigned, but
 * before the seller has actually submitted any deal details. Once details
 * exist they were written by a specific person in a specific role, so swapping
 * would silently reattribute them.
 */
const SWAPPABLE_STATES: DealState[] = ['ROLES_ASSIGNED', 'WAITING_FOR_DEAL_DETAILS'];

/**
 * Step 1 — the creator opens the deal-partner picker.
 *
 * The picker is ephemeral: only the person who opened the ticket sees it, and
 * only they can act on it.
 */
export async function handleAddPartnerButton(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  const { deal } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireCreator(deal, interaction.user.id);
  assertDealStatus(deal.status as DealState, ['CREATED']);

  await replyPrivate(interaction, {
    content: 'Select the person you are making this deal with.',
    components: buildPartnerSelect({ publicDealId: deal.publicId, nonce: parts.nonce }),
  });
}

/**
 * Step 2 — the creator picked a partner.
 *
 * Every rule about who may be a partner is enforced here, on the server: a
 * Discord user select cannot be restricted to a candidate list, so its output
 * is untrusted input.
 */
export async function handlePartnerSelect(
  interaction: UserSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireCreator(deal, interaction.user.id);

  const partnerId = interaction.values[0];

  if (!partnerId) {
    throw new ValidationError('No user was selected', 'Please select a user.');
  }

  const partner = await ctx.guild.members.fetch(partnerId).catch(() => null);

  if (!partner) {
    throw new ValidationError(
      `Selected user ${partnerId} is not a member of the guild`,
      'That user is not a member of this server.',
    );
  }

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    // Re-read inside the lock: the deal may have moved between the guard above
    // and acquiring the lock.
    const current = await ctx.bot.deals.requireById(deal.id);

    await ctx.bot.deals.validatePartner({
      deal: current,
      partnerDiscordId: partner.id,
      partnerIsBot: partner.user.bot,
    });

    return ctx.bot.deals.addPartner({
      deal: current,
      partnerDiscordId: partner.id,
      partnerUsername: partner.user.username,
      partnerDisplayName: partner.displayName,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await grantChannelAccess(channel, partner.id, `Deal partner for ${deal.publicId}`);

  const nonce = await rotateRenderNonce(ctx.bot.redis, deal.id);

  await refreshTicketPanel(channel, updated, nonce);

  const rolePanel = buildRoleSelect({
    publicDealId: updated.publicId,
    nonce,
    participants: participantsOf(updated, ctx.member, partner),
  });

  await channel.send({
    content: `<@${partner.id}> has been added to this deal.`,
    ...rolePanel,
    allowedMentions: { users: [partner.id] },
  });

  await safeReply(interaction, {
    content: `✅ <@${partner.id}> has been added to the ticket.`,
    components: [],
  });

  log.info({ dealId: updated.id, partnerId: partner.id }, 'deal partner added');
}

/** Step 3 — the creator chose the buyer; the seller is the other participant. */
export async function handleRoleSelect(
  interaction: StringSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireCreator(deal, interaction.user.id);

  const buyerId = interaction.values[0];

  if (!buyerId) {
    throw new ValidationError('No buyer was selected', 'Please choose who the Buyer is.');
  }

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    const assignment = ctx.bot.deals.deriveAssignment(current, buyerId);

    return ctx.bot.deals.assignRoles({
      deal: current,
      assignment,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await renderRolesAndPrompt(ctx, channel, updated, interaction, { swapped: false });
}

/** Optional step — swap the roles, only while no deal details exist yet. */
export async function handleSwapRoles(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireCreator(deal, interaction.user.id);
  assertDealStatus(
    deal.status as DealState,
    SWAPPABLE_STATES,
    'The roles can no longer be changed. Please contact support if they are wrong.',
  );

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.deals.swapRoles({
      deal: current,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await renderRolesAndPrompt(ctx, channel, updated, interaction, { swapped: true });
}

/**
 * Renders the roles panel and the seller's details prompt.
 *
 * The nonce is rotated first, which invalidates every button on the panel the
 * user just clicked — so the same click cannot be replayed. The transition to
 * WAITING_FOR_DEAL_DETAILS happens only on the first pass; a later swap leaves
 * the deal where it is, which is what keeps the swap button usable.
 */
async function renderRolesAndPrompt(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  options: { swapped: boolean },
): Promise<void> {
  const { buyerDiscordId, sellerDiscordId } = deal;

  if (!buyerDiscordId || !sellerDiscordId) {
    throw new ValidationError(
      `Deal ${deal.id} has no roles after assignment`,
      'The roles could not be assigned. Please contact support.',
    );
  }

  const nonce = await rotateRenderNonce(ctx.bot.redis, deal.id);

  let current = deal;

  if ((current.status as DealState) === 'ROLES_ASSIGNED') {
    current = await ctx.bot.deals.requestDealDetails({
      deal: current,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  }

  await channel.send({
    ...(options.swapped ? { content: '🔄 The roles have been swapped.' } : {}),
    ...buildRolesAssignedPanel({
      publicDealId: current.publicId,
      buyerDiscordId,
      sellerDiscordId,
      nonce,
      swappable: SWAPPABLE_STATES.includes(current.status as DealState),
    }),
    allowedMentions: { users: [buyerDiscordId, sellerDiscordId] },
  });

  const promptMessage = await channel.send({
    ...buildDealDetailsPrompt({
      publicDealId: current.publicId,
      sellerDiscordId,
      nonce,
    }),
    allowedMentions: { users: [sellerDiscordId] },
  });

  await ctx.bot.prisma.deal.update({
    where: { id: current.id },
    data: { statusMessageId: promptMessage.id },
  });

  await safeReply(interaction, {
    content: `✅ Roles set — Buyer: <@${buyerDiscordId}>, Seller: <@${sellerDiscordId}>.`,
    flags: MessageFlags.Ephemeral,
  });

  log.info(
    { dealId: current.id, buyer: buyerDiscordId, seller: sellerDiscordId },
    options.swapped ? 'roles swapped' : 'roles assigned',
  );
}

/** Re-renders the ticket panel so "Add Deal Partner" is no longer clickable. */
async function refreshTicketPanel(channel: TextChannel, deal: Deal, nonce: string): Promise<void> {
  if (!deal.statusMessageId) return;

  try {
    const message = await channel.messages.fetch(deal.statusMessageId);
    await message.edit(
      buildTicketPanel({
        publicDealId: deal.publicId,
        creatorDiscordId: deal.creatorDiscordId,
        nonce,
        partnerAdded: true,
      }),
    );
  } catch (error) {
    // A deleted panel is not worth failing the interaction over: the panels
    // posted afterwards carry the flow forward regardless.
    log.warn({ dealId: deal.id, err: String(error) }, 'could not refresh the ticket panel');
  }
}

function participantsOf(
  deal: Deal,
  creator: GuildMember,
  partner: GuildMember,
): [Participant, Participant] {
  return [
    { discordId: deal.creatorDiscordId, label: creator.displayName },
    { discordId: partner.id, label: partner.displayName },
  ];
}
