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
import { getEnv } from '../../../config/env.js';
import { explorerTxUrl } from '../../../config/assets.js';
import { payoutLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { ManualBroadcastRequired } from '../../../wallets/manualSigner.js';
import { requireSeller, requireStaffLevel } from '../../guards/authorization.js';
import {
  PAYOUT_ADDRESS_FIELD,
  buildDealCompletedEmbed,
  buildPayoutAddressModal,
  buildPayoutAddressPrompt,
  buildPayoutReviewPanel,
  buildPayoutReviewRequiredEmbed,
  buildPayoutSentEmbed,
} from '../../components/payoutPanels.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { replyPrivate, safeReply } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('payout-flow');

/** Asks the seller for a payout address once both parties have confirmed. */
export async function requestPayoutAddress(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
): Promise<void> {
  const pair = ctx.bot.currencies.sellerPair(deal);

  if (!pair) {
    throw new ValidationError(
      `Deal ${deal.id} has no seller currency`,
      'The receiving currency has not been chosen yet.',
    );
  }

  const nonce = await rotateRenderNonce(ctx.bot.redis, deal.id);

  const message = await channel.send({
    ...buildPayoutAddressPrompt({
      publicDealId: deal.publicId,
      sellerDiscordId: deal.sellerDiscordId ?? '',
      pair,
      nonce,
    }),
    allowedMentions: { users: deal.sellerDiscordId ? [deal.sellerDiscordId] : [] },
  });

  await ctx.bot.prisma.deal.update({
    where: { id: deal.id },
    data: { statusMessageId: message.id },
  });
}

/** The seller opens the address modal. */
export async function handleOpenPayoutAddressModal(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  const { deal } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireSeller(deal, interaction.user.id);

  const pair = ctx.bot.currencies.sellerPair(deal);

  if (!pair) {
    throw new ValidationError(
      `Deal ${deal.id} has no seller currency`,
      'The receiving currency has not been chosen yet.',
    );
  }

  await interaction.showModal(
    buildPayoutAddressModal({ publicDealId: deal.publicId, nonce: parts.nonce, pair }),
  );
}

/**
 * The seller submitted an address.
 *
 * The address is validated by the chain adapter for the exact (asset, network)
 * the seller chose, so a Bitcoin address for an Ethereum payout — or a mainnet
 * address on testnet — is refused with a message naming what was expected.
 */
export async function handlePayoutAddressSubmit(
  interaction: ModalSubmitInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'payout:submit', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireSeller(deal, interaction.user.id);

  const pair = ctx.bot.currencies.sellerPair(deal);

  if (!pair) {
    throw new ValidationError(
      `Deal ${deal.id} has no seller currency`,
      'The receiving currency has not been chosen yet.',
    );
  }

  const raw = interaction.fields.getTextInputValue(PAYOUT_ADDRESS_FIELD).trim();
  const adapter = ctx.bot.chains.get(pair.network.id);

  // Validated before deferring so an invalid address comes straight back.
  const normalized = ctx.bot.payouts.validateAddress(raw, pair, adapter);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const draft = await withLock(ctx.bot.redis, payoutLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.payouts.submitAddress({
      deal: current,
      rawAddress: raw,
      normalizedAddress: normalized,
      pair,
      sellerDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  const reviewed = await ctx.bot.payouts.openReview({
    deal: draft.deal,
    actorDiscordId: interaction.user.id,
  });

  const nonce = await rotateRenderNonce(ctx.bot.redis, deal.id);
  const env = getEnv();

  await channel.send({
    content: ctx.guildConfig.middlemanRoleId
      ? `<@&${ctx.guildConfig.middlemanRoleId}>`
      : ctx.guildConfig.supportRoleId
        ? `<@&${ctx.guildConfig.supportRoleId}>`
        : '',
    ...buildPayoutReviewPanel({
      publicDealId: reviewed.publicId,
      amountUsd: toDecimal(String(draft.payout.amountUsd)),
      cryptoAmount: toDecimal(String(draft.payout.cryptoAmount)),
      pair,
      destinationAddress: draft.payout.destinationAddress,
      networkFee: draft.payout.networkFeeCrypto
        ? toDecimal(String(draft.payout.networkFeeCrypto))
        : null,
      nonce,
      isMockMode: !env.LIVE_MODE,
    }),
    allowedMentions: {
      roles: [ctx.guildConfig.middlemanRoleId, ctx.guildConfig.supportRoleId].filter(
        (id): id is string => Boolean(id),
      ),
    },
  });

  await safeReply(interaction, {
    content: `✅ Payout address recorded: \`${normalized}\`\n\nA middleman will review and authorise the payout.`,
  });
}

/**
 * Staff authorise the payout.
 *
 * Two independent checks: the actor must hold the middleman role, and the
 * service refuses anyone who is a party to the deal.
 */
export async function handleAuthorizePayout(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'payout:submit', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireStaffLevel(ctx.member, ctx.guildConfig, 'middleman');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const env = getEnv();

  // The payout lock is separate from the deal lock and is held across the
  // whole authorise-and-broadcast sequence.
  const outcome = await withLock(
    ctx.bot.redis,
    payoutLockKey(deal.id),
    async () => {
      const current = await ctx.bot.deals.requireById(deal.id);
      const { deal: authorized, payout } = await ctx.bot.payouts.authorize({
        deal: current,
        authorizerDiscordId: interaction.user.id,
        correlationId: ctx.correlationId,
      });

      try {
        return await ctx.bot.payouts.broadcast({
          deal: authorized,
          payout,
          correlationId: ctx.correlationId,
        });
      } catch (error) {
        if (error instanceof ManualBroadcastRequired) {
          return { manual: true as const, payout };
        }
        throw error;
      }
    },
    { ttlMs: 120_000, waitMs: 5_000 },
  );

  if ('manual' in outcome) {
    await channel.send({
      embeds: [
        {
          color: 0xf1c40f,
          title: '🔐 Payout authorised — awaiting manual broadcast',
          description: [
            'This deployment uses a **manual signer**: the bot holds no keys and cannot send funds itself.',
            '',
            'An authorised middleman must now send the payout from the treasury wallet and record the transaction with `/admin payout sent`.',
          ].join('\n'),
        },
      ],
    });

    await safeReply(interaction, {
      content: '✅ Payout authorised. Send the funds, then record the transaction hash.',
    });
    return;
  }

  const url = explorerTxUrl(deal.sellerNetwork ?? '', outcome.txHash);

  await channel.send({
    embeds: [
      buildPayoutSentEmbed({
        publicDealId: deal.publicId,
        txHash: outcome.txHash,
        ...(url ? { explorerUrl: url } : {}),
        isMockMode: !env.LIVE_MODE,
      }),
    ],
  });

  await safeReply(interaction, {
    content: outcome.deduplicated
      ? '✅ This payout was already broadcast. The existing transaction was re-used — no second payout was sent.'
      : '✅ Payout broadcast.',
  });

  log.info(
    { dealId: deal.id, txHash: outcome.txHash, deduplicated: outcome.deduplicated },
    'payout authorised and broadcast',
  );
}

/** Staff reject the address and send the seller back for a new one. */
export async function handleRejectPayout(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireStaffLevel(ctx.member, ctx.guildConfig, 'middleman');

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, payoutLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.payouts.reject({
      deal: current,
      reviewerDiscordId: interaction.user.id,
      reason: 'The payout address was rejected by a middleman.',
      correlationId: ctx.correlationId,
    });
  });

  await requestPayoutAddress(ctx, channel, updated);

  await replyPrivate(interaction, {
    content: '✅ The address was rejected and the seller has been asked for a new one.',
  });
}

/** The seller confirms the funds arrived — this completes the deal. */
export async function handleFundsReceived(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireSeller(deal, interaction.user.id);

  await interaction.deferUpdate();

  const completed = await withLock(ctx.bot.redis, payoutLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.payouts.confirmReceipt({
      deal: current,
      sellerDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await rotateRenderNonce(ctx.bot.redis, deal.id);

  await channel.send({
    embeds: [
      buildDealCompletedEmbed({
        publicDealId: completed.publicId,
        dealAmountUsd: toDecimal(String(completed.dealAmountUsd ?? '0')),
      }),
    ],
  });

  log.info({ dealId: completed.id }, 'deal completed');
}

/**
 * The seller reports the payout never arrived.
 *
 * No second payout is sent. The deal moves to PAYOUT_REVIEW_REQUIRED, which
 * the state machine gives no path back into any payout state.
 */
export async function handleFundsNotReceived(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireSeller(deal, interaction.user.id);

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, payoutLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.payouts.reportNotReceived({
      deal: current,
      sellerDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await rotateRenderNonce(ctx.bot.redis, deal.id);

  const supportMention = ctx.guildConfig.supportRoleId
    ? `<@&${ctx.guildConfig.supportRoleId}>`
    : '`@support`';

  await channel.send({
    content: ctx.guildConfig.supportRoleId ? `<@&${ctx.guildConfig.supportRoleId}>` : '',
    embeds: [buildPayoutReviewRequiredEmbed({ publicDealId: updated.publicId, supportMention })],
    allowedMentions: ctx.guildConfig.supportRoleId
      ? { roles: [ctx.guildConfig.supportRoleId] }
      : { parse: [] },
  });

  log.warn({ dealId: updated.id }, 'seller reported a missing payout');
}
