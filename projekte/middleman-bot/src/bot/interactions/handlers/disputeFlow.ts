import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from 'discord.js';
import { ConflictError } from '../../../core/errors.js';
import { createLogger } from '../../../core/logger.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import {
  DISPUTE_REASON_FIELD,
  buildDisputeModal,
  buildDisputeOpenedEmbed,
} from '../../components/disputePanels.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { safeReply } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('dispute-flow');

/** Either party opens a dispute; a modal collects the reason. */
export async function handleOpenDisputeModal(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  const { deal } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);

  // Checked before the modal opens, so a party is not asked to write out a
  // reason only to be told afterwards that it cannot be filed.
  const check = ctx.bot.disputes.canOpen(deal);

  if (!check.allowed) {
    throw new ConflictError(
      `Deal ${deal.id} cannot be disputed from ${deal.status}`,
      check.reason ?? 'This deal cannot be disputed at the moment.',
    );
  }

  await interaction.showModal(
    buildDisputeModal({ publicDealId: deal.publicId, nonce: parts.nonce }),
  );
}

/** The dispute is filed: the deal freezes and staff are notified. */
export async function handleDisputeSubmit(
  interaction: ModalSubmitInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'dispute:open', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { deal: frozen, dispute } = await withLock(
    ctx.bot.redis,
    dealLockKey(deal.id),
    async () => {
      const current = await ctx.bot.deals.requireById(deal.id);
      return ctx.bot.disputes.open({
        deal: current,
        openerDiscordId: interaction.user.id,
        rawReason: interaction.fields.getTextInputValue(DISPUTE_REASON_FIELD),
        correlationId: ctx.correlationId,
      });
    },
  );

  // Rotating the nonce makes every outstanding panel inert, so nobody can
  // click "Deal Completed" on a deal that is now frozen.
  await rotateRenderNonce(ctx.bot.redis, frozen.id);

  const supportMention = ctx.guildConfig.supportRoleId
    ? `<@&${ctx.guildConfig.supportRoleId}>`
    : '`@support`';

  await channel.send({
    content: ctx.guildConfig.supportRoleId ? `<@&${ctx.guildConfig.supportRoleId}>` : '',
    embeds: [
      buildDisputeOpenedEmbed({
        publicDealId: frozen.publicId,
        openerDiscordId: interaction.user.id,
        reason: dispute.reason,
        supportMention,
      }),
    ],
    allowedMentions: ctx.guildConfig.supportRoleId
      ? { roles: [ctx.guildConfig.supportRoleId] }
      : { parse: [] },
  });

  await notifyStaffChannel(ctx, frozen.publicId, interaction.user.id, channel.id);

  await safeReply(interaction, {
    content:
      '✅ Your dispute has been opened. The deal is on hold and no payout will be released automatically.',
  });

  log.warn({ dealId: frozen.id, disputeId: dispute.id }, 'dispute filed');
}

/** Mirrors the dispute into the staff log channel, when one is configured. */
async function notifyStaffChannel(
  ctx: InteractionContext,
  publicDealId: string,
  openerDiscordId: string,
  ticketChannelId: string,
): Promise<void> {
  if (!ctx.guildConfig.staffLogChannelId) return;

  const channel = await ctx.bot.client.channels
    .fetch(ctx.guildConfig.staffLogChannelId)
    .catch(() => null);

  if (!channel?.isTextBased() || !('send' in channel)) return;

  await channel
    .send({
      embeds: [
        {
          color: 0xe74c3c,
          title: '⚠️ New dispute',
          description: [
            `Deal \`${publicDealId}\` has been disputed by <@${openerDiscordId}>.`,
            '',
            `Ticket: <#${ticketChannelId}>`,
            '',
            'Use `/admin dispute claim` and `/admin dispute resolve` to handle it.',
          ].join('\n'),
        },
      ],
      allowedMentions: { parse: [] },
    })
    .catch(() => undefined);
}
