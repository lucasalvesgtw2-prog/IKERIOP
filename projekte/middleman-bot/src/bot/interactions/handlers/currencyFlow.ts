import { MessageFlags, type StringSelectMenuInteraction, type TextChannel } from 'discord.js';
import { type Deal } from '@prisma/client';
import { ValidationError } from '../../../core/errors.js';
import { createLogger } from '../../../core/logger.js';
import { toDecimal } from '../../../core/money.js';
import { getNetwork } from '../../../config/assets.js';
import { getEnv } from '../../../config/env.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { decodePair } from '../../../services/currencyService.js';
import { requireBuyer, requireSeller } from '../../guards/authorization.js';
import {
  buildCurrencyChosenNotice,
  buildCurrencySelect,
  buildPaymentBreakdownEmbed,
} from '../../components/currencyPanels.js';
import { createAndPostPaymentRequest } from './paymentFlow.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { safeReply } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('currency-flow');

/**
 * Opens the currency step. Called right after the buyer approves, and again
 * by the router if someone needs the menu re-posted.
 */
export async function postBuyerCurrencySelect(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
): Promise<Deal> {
  const current =
    deal.status === 'BUYER_APPROVED'
      ? await ctx.bot.currencies.beginSelection({
          deal,
          actorDiscordId: deal.buyerDiscordId ?? deal.creatorDiscordId,
          correlationId: ctx.correlationId,
        })
      : deal;

  const nonce = await rotateRenderNonce(ctx.bot.redis, current.id);

  await channel.send({
    content: `<@${current.buyerDiscordId}>`,
    ...buildCurrencySelect({
      role: 'buyer',
      publicDealId: current.publicId,
      nonce,
      enabledAssets: ctx.guildConfig.enabledAssets,
      mode: getEnv().CHAIN_NETWORK_MODE,
    }),
    allowedMentions: { users: current.buyerDiscordId ? [current.buyerDiscordId] : [] },
  });

  return current;
}

/** The buyer chose how to pay. */
export async function handleBuyerCurrencySelect(
  interaction: StringSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await handleCurrencySelect(interaction, ctx, parts, 'buyer');
}

/** The seller chose how to be paid. */
export async function handleSellerCurrencySelect(
  interaction: StringSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await handleCurrencySelect(interaction, ctx, parts, 'seller');
}

async function handleCurrencySelect(
  interaction: StringSelectMenuInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
  role: 'buyer' | 'seller',
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);

  if (role === 'buyer') {
    requireBuyer(deal, interaction.user.id);
  } else {
    requireSeller(deal, interaction.user.id);
  }

  const raw = interaction.values[0];

  if (!raw) {
    throw new ValidationError('No currency was selected', 'Please choose a currency.');
  }

  // The menu's value is client-controlled, so the pair is re-resolved against
  // the registry, the guild's enabled assets and the runtime mode.
  const decoded = decodePair(raw);
  const pair = ctx.bot.currencies.resolveSelection(
    decoded.asset,
    decoded.network,
    ctx.guildConfig.enabledAssets,
    getEnv().CHAIN_NETWORK_MODE,
  );

  await interaction.deferUpdate();

  const updated = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    return ctx.bot.currencies.setCurrency({
      deal: current,
      role,
      pair,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  const bothChosen = ctx.bot.currencies.bothCurrenciesSelected(updated);
  const waitingFor = role === 'buyer' ? updated.sellerDiscordId : updated.buyerDiscordId;

  await channel.send({
    embeds: [
      buildCurrencyChosenNotice({
        role,
        actorDiscordId: interaction.user.id,
        assetSymbol: pair.asset.symbol,
        networkLabel: pair.network.label,
        waitingForDiscordId: bothChosen ? null : waitingFor,
      }),
    ],
  });

  const nonce = await rotateRenderNonce(ctx.bot.redis, updated.id);

  if (!bothChosen && role === 'buyer' && updated.sellerDiscordId) {
    await channel.send({
      content: `<@${updated.sellerDiscordId}>`,
      ...buildCurrencySelect({
        role: 'seller',
        publicDealId: updated.publicId,
        nonce,
        enabledAssets: ctx.guildConfig.enabledAssets,
        mode: getEnv().CHAIN_NETWORK_MODE,
      }),
      allowedMentions: { users: [updated.sellerDiscordId] },
    });
  }

  if (bothChosen) {
    await postPaymentBreakdown(ctx, channel, updated);
    await createAndPostPaymentRequest(ctx, channel, updated, interaction.user.id);
  }

  await safeReply(interaction, {
    content: `✅ ${pair.asset.symbol} on ${pair.network.label} selected.`,
    flags: MessageFlags.Ephemeral,
  });

  log.info({ dealId: updated.id, role, asset: pair.asset.symbol }, 'currency selected');
}

/**
 * Posts the USD breakdown once both rails are known.
 *
 * The crypto amount is deliberately not shown here: it depends on a price
 * quote, and a quote is only meaningful attached to a payment request with an
 * expiry. That is the next step.
 */
export async function postPaymentBreakdown(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
): Promise<void> {
  const buyerPair = ctx.bot.currencies.buyerPair(deal);
  const sellerPair = ctx.bot.currencies.sellerPair(deal);

  if (!buyerPair || !sellerPair) {
    throw new ValidationError(
      `Deal ${deal.id} is missing a currency pair`,
      'The currencies for this deal are incomplete. Please contact support.',
    );
  }

  await channel.send({
    embeds: [
      buildPaymentBreakdownEmbed({
        publicDealId: deal.publicId,
        dealAmountUsd: toDecimal(String(deal.dealAmountUsd ?? '0')),
        feeUsd: toDecimal(String(deal.feeUsd ?? '0')),
        feePercentage: toDecimal(String(deal.feePercentage)),
        buyerTotalUsd: toDecimal(String(deal.buyerTotalUsd ?? '0')),
        buyerAsset: buyerPair.asset.symbol,
        buyerNetworkLabel: networkLabel(deal.buyerNetwork),
        sellerAsset: sellerPair.asset.symbol,
        sellerNetworkLabel: networkLabel(deal.sellerNetwork),
      }),
    ],
  });
}

function networkLabel(networkId: string | null): string {
  return (networkId ? getNetwork(networkId)?.label : undefined) ?? 'Unknown network';
}
