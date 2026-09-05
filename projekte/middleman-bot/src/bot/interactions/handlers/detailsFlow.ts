import {
  MessageFlags,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import { type Deal } from '@prisma/client';
import { ValidationError } from '../../../core/errors.js';
import { createLogger } from '../../../core/logger.js';
import { toDecimal } from '../../../core/money.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { type DealState } from '../../../domain/deal/state.js';
import { assertDealStatus } from '../../../services/dealTransition.js';
import { requireBuyer, requireSeller } from '../../guards/authorization.js';
import {
  buildChangeRequestModal,
  buildDealDetailsModal,
  readChangeReason,
  readDealDetailsSubmission,
} from '../../components/dealModals.js';
import {
  buildApprovalRow,
  buildApprovedNotice,
  buildChangesRequestedNotice,
  buildDealSummaryEmbed,
} from '../../components/dealSummary.js';
import { buildDealDetailsPrompt } from '../../components/dealPanels.js';
import { postBuyerCurrencySelect } from './currencyFlow.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { safeReply } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('details-flow');

/**
 * Step 1 — the seller opens the deal-details modal.
 *
 * A modal must be the first response to an interaction, so nothing may be
 * deferred before `showModal`. Every check therefore has to be cheap and run
 * first; the expensive work happens on submission.
 */
export async function handleOpenDetailsModal(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  const { deal } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireSeller(deal, interaction.user.id);
  assertDealStatus(deal.status as DealState, ['WAITING_FOR_DEAL_DETAILS']);

  const previous = await ctx.bot.dealDetails.currentRevision(deal.id);

  await interaction.showModal(
    buildDealDetailsModal({
      publicDealId: deal.publicId,
      nonce: parts.nonce,
      revising: previous !== null,
      // Pre-filling the previous revision means a change request only costs the
      // seller the edit, not retyping the whole deal.
      prefill: previous
        ? {
            item: previous.item,
            description: previous.description,
            additionalTerms: previous.additionalTerms,
            dealAmountUsd: String(previous.dealAmountUsd),
          }
        : undefined,
    }),
  );
}

/** Step 2 — the seller submitted the details. */
export async function handleDetailsSubmit(
  interaction: ModalSubmitInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'modal:submit', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireSeller(deal, interaction.user.id);

  const raw = readDealDetailsSubmission(interaction);

  // Validated before deferring, so a bad amount comes back as a plain error
  // the seller can act on rather than an edited placeholder reply.
  const details = ctx.bot.dealDetails.validate(
    raw,
    {
      minDealAmountUsd: ctx.guildConfig.minDealAmountUsd,
      maxDealAmountUsd: ctx.guildConfig.maxDealAmountUsd,
    },
    toDecimal(String(deal.feePercentage)),
  );

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { deal: updated, revision } = await withLock(
    ctx.bot.redis,
    dealLockKey(deal.id),
    async () => {
      const current = await ctx.bot.deals.requireById(deal.id);
      return ctx.bot.dealDetails.submit({
        deal: current,
        details,
        sellerDiscordId: interaction.user.id,
        correlationId: ctx.correlationId,
      });
    },
  );

  const nonce = await rotateRenderNonce(ctx.bot.redis, updated.id);

  const summary = buildDealSummaryEmbed({
    publicDealId: updated.publicId,
    buyerDiscordId: requireRole(updated.buyerDiscordId, 'buyer'),
    sellerDiscordId: requireRole(updated.sellerDiscordId, 'seller'),
    item: details.item,
    description: details.description,
    additionalTerms: details.additionalTerms,
    dealAmountUsd: details.fees.dealAmountUsd,
    feeUsd: details.fees.feeUsd,
    buyerTotalUsd: details.fees.buyerTotalUsd,
    feePercentage: details.fees.feePercentage,
    revision: revision.revision,
  });

  const message = await channel.send({
    content: `<@${updated.buyerDiscordId}>, please review the deal details below.`,
    embeds: [summary],
    components: [buildApprovalRow({ publicDealId: updated.publicId, nonce })],
    allowedMentions: { users: [updated.buyerDiscordId!] },
  });

  await ctx.bot.prisma.deal.update({
    where: { id: updated.id },
    data: { summaryMessageId: message.id, statusMessageId: message.id },
  });

  await safeReply(interaction, {
    content: `✅ Deal details submitted (revision #${revision.revision}). Waiting for the buyer to approve.`,
  });
}

/** Step 3a — the buyer approves. */
export async function handleApproveDeal(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireBuyer(deal, interaction.user.id);

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.dealDetails.approve({
      deal: current,
      buyerDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  // Rotating first, then stripping the buttons from the approved summary,
  // makes the old approval controls inert twice over.
  await rotateRenderNonce(ctx.bot.redis, updated.id);
  await disableSummaryButtons(ctx, channel, updated);

  await channel.send({
    embeds: [
      buildApprovedNotice({
        publicDealId: updated.publicId,
        buyerDiscordId: interaction.user.id,
        buyerTotalUsd: toDecimal(String(updated.buyerTotalUsd ?? '0')),
      }),
    ],
  });

  // The approval and the currency step are separate transitions, so a failure
  // to post the menu leaves an approved deal that staff can resume, never an
  // approval that silently did not happen.
  await postBuyerCurrencySelect(ctx, channel, updated);

  log.info({ dealId: updated.id }, 'deal approved by buyer');
}

/** Step 3b — the buyer asks for changes; a modal collects the reason. */
export async function handleRequestChangesModal(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  const { deal } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireBuyer(deal, interaction.user.id);
  assertDealStatus(deal.status as DealState, ['WAITING_FOR_BUYER_APPROVAL']);

  await interaction.showModal(
    buildChangeRequestModal({ publicDealId: deal.publicId, nonce: parts.nonce }),
  );
}

/** Step 3c — the change request was submitted; the deal goes back to the seller. */
export async function handleChangesSubmit(
  interaction: ModalSubmitInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'modal:submit', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireBuyer(deal, interaction.user.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { deal: updated, reason } = await withLock(
    ctx.bot.redis,
    dealLockKey(deal.id),
    async () => {
      const current = await ctx.bot.deals.requireById(deal.id);
      return ctx.bot.dealDetails.requestChanges({
        deal: current,
        buyerDiscordId: interaction.user.id,
        rawReason: readChangeReason(interaction),
        correlationId: ctx.correlationId,
      });
    },
  );

  const nonce = await rotateRenderNonce(ctx.bot.redis, updated.id);
  await disableSummaryButtons(ctx, channel, updated);

  const sellerDiscordId = requireRole(updated.sellerDiscordId, 'seller');

  await channel.send({
    embeds: [
      buildChangesRequestedNotice({
        publicDealId: updated.publicId,
        buyerDiscordId: interaction.user.id,
        sellerDiscordId,
        reason,
      }),
    ],
    allowedMentions: { users: [sellerDiscordId] },
  });

  const prompt = await channel.send({
    ...buildDealDetailsPrompt({
      publicDealId: updated.publicId,
      sellerDiscordId,
      nonce,
    }),
    allowedMentions: { users: [sellerDiscordId] },
  });

  await ctx.bot.prisma.deal.update({
    where: { id: updated.id },
    data: { statusMessageId: prompt.id },
  });

  await safeReply(interaction, {
    content: '✅ Your change request has been sent to the seller.',
  });

  log.info({ dealId: updated.id }, 'buyer requested changes');
}

/**
 * Removes the approval buttons from the summary message.
 *
 * The nonce already makes them inert; this is purely so the message does not
 * keep offering an action that no longer applies.
 */
async function disableSummaryButtons(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
): Promise<void> {
  if (!deal.summaryMessageId) return;

  try {
    const message = await channel.messages.fetch(deal.summaryMessageId);
    await message.edit({ components: [] });
  } catch (error) {
    log.warn({ dealId: deal.id, err: String(error) }, 'could not clear the summary buttons');
  }
  void ctx;
}

/** Narrows a role id that the state machine guarantees is set by this point. */
function requireRole(discordId: string | null, role: 'buyer' | 'seller'): string {
  if (!discordId) {
    throw new ValidationError(
      `Deal has no ${role} at the details stage`,
      'The roles for this deal are incomplete. Please contact support.',
    );
  }
  return discordId;
}
