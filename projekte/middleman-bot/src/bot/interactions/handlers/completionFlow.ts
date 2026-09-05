import { MessageFlags, type ButtonInteraction, type TextChannel } from 'discord.js';
import { type Deal } from '@prisma/client';
import { createLogger } from '../../../core/logger.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { buildCompletionPanel } from '../../components/completionPanels.js';
import { requestPayoutAddress } from './payoutFlow.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { replyPrivate } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('completion-flow');

/**
 * "Deal Completed".
 *
 * Which party the click counts for is decided from the stored deal, not from
 * the button, so one participant cannot confirm on the other's behalf. A
 * double click is absorbed silently.
 */
export async function handleDealCompleted(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  // partyOf throws for anyone who is not the buyer or the seller.
  ctx.bot.completion.partyOf(deal, interaction.user.id);

  await interaction.deferUpdate();

  const state = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    let current = await ctx.bot.deals.requireById(deal.id);

    if (current.status === 'DEAL_IN_PROGRESS') {
      current = await ctx.bot.completion.openConfirmations({
        deal: current,
        actorDiscordId: interaction.user.id,
      });
    }

    return ctx.bot.completion.confirm({
      deal: current,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await renderCompletion(ctx, channel, state.deal, {
    buyerConfirmed: state.buyerConfirmed,
    sellerConfirmed: state.sellerConfirmed,
  });

  if (state.bothConfirmed) {
    await requestPayoutAddress(ctx, channel, state.deal);
  }

  await replyPrivate(interaction, {
    content: state.bothConfirmed
      ? '✅ Both parties have confirmed. The seller will now be asked for a payout address.'
      : '✅ Your confirmation has been recorded. Waiting for the other party.',
  });

  log.info({ dealId: state.deal.id, both: state.bothConfirmed }, 'completion confirmation handled');
}

/** Re-renders the scoreboard with a fresh nonce. */
export async function renderCompletion(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
  state: { buyerConfirmed: boolean; sellerConfirmed: boolean },
): Promise<void> {
  const nonce = await rotateRenderNonce(ctx.bot.redis, deal.id);

  const message = await channel.send({
    ...buildCompletionPanel({
      publicDealId: deal.publicId,
      buyerDiscordId: deal.buyerDiscordId ?? '',
      sellerDiscordId: deal.sellerDiscordId ?? '',
      buyerConfirmed: state.buyerConfirmed,
      sellerConfirmed: state.sellerConfirmed,
      nonce,
    }),
    allowedMentions: { parse: [] },
  });

  await ctx.bot.prisma.deal.update({
    where: { id: deal.id },
    data: { statusMessageId: message.id },
  });
}

export const COMPLETION_EPHEMERAL = MessageFlags.Ephemeral;
