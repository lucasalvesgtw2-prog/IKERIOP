import { MessageFlags, type ButtonInteraction, type TextChannel } from 'discord.js';
import { type Deal, type Payment, type PriceQuote } from '@prisma/client';
import { ConfigurationError, ValidationError } from '../../../core/errors.js';
import { createLogger } from '../../../core/logger.js';
import { toDecimal } from '../../../core/money.js';
import { getEnv } from '../../../config/env.js';
import { dealLockKey, withLock } from '../../../infra/locks.js';
import { enforceRateLimit } from '../../../infra/ratelimit.js';
import { requireBuyer, requireParticipant } from '../../guards/authorization.js';
import {
  buildPaymentActionsRow,
  buildPaymentInstructionEmbed,
} from '../../components/paymentPanels.js';
import { assertFreshNonce, assertTargetMatches, loadDealForInteraction } from '../dealGuards.js';
import { rotateRenderNonce } from '../renderNonce.js';
import { replyPrivate, safeReply } from '../respond.js';
import { type CustomIdParts } from '../customId.js';
import { type InteractionContext } from '../context.js';

const log = createLogger('payment-flow');

/**
 * Creates the payment request and posts the instructions.
 *
 * Called automatically once both currencies are chosen. The whole sequence
 * runs under the deal lock so a double click cannot mint two requests, and the
 * state guard inside the service is the real protection.
 */
export async function createAndPostPaymentRequest(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
  actorDiscordId: string,
): Promise<void> {
  const buyerPair = ctx.bot.currencies.buyerPair(deal);

  if (!buyerPair) {
    throw new ValidationError(
      `Deal ${deal.id} has no buyer currency`,
      'The payment currency has not been chosen yet.',
    );
  }

  let created;

  try {
    created = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
      const current = await ctx.bot.deals.requireById(deal.id);
      return ctx.bot.payments.createRequest({
        deal: current,
        buyerPair,
        actorDiscordId,
        correlationId: ctx.correlationId,
      });
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      // No deposit address is configured: this is an operator problem, and the
      // deal must not be left looking as though the buyer can pay.
      await channel.send({
        content: ctx.guildConfig.supportRoleId ? `<@&${ctx.guildConfig.supportRoleId}>` : '',
        embeds: [
          {
            color: 0xe74c3c,
            title: '⚠️ Payment request could not be created',
            description: [
              `No deposit address is configured for **${buyerPair.asset.symbol}** on **${buyerPair.network.label}**.`,
              '',
              'An administrator must add one with `/admin wallet add` before this deal can continue.',
            ].join('\n'),
          },
        ],
        allowedMentions: ctx.guildConfig.supportRoleId
          ? { roles: [ctx.guildConfig.supportRoleId] }
          : { parse: [] },
      });
    }
    throw error;
  }

  await postInstructions(ctx, channel, created.deal, created.payment, created.quote);

  await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    if (current.status === 'PAYMENT_REQUEST_CREATED') {
      await ctx.bot.payments.armMonitoring({
        deal: current,
        actorDiscordId,
        correlationId: ctx.correlationId,
      });
    }
  });
}

/** Renders the instruction embed and records the message id. */
export async function postInstructions(
  ctx: InteractionContext,
  channel: TextChannel,
  deal: Deal,
  payment: Payment,
  quote: PriceQuote,
): Promise<void> {
  const env = getEnv();
  const buyerPair = ctx.bot.currencies.buyerPair(deal);

  if (!buyerPair) {
    throw new ValidationError(
      `Deal ${deal.id} has no buyer currency`,
      'The payment currency has not been chosen yet.',
    );
  }

  const nonce = await rotateRenderNonce(ctx.bot.redis, deal.id);

  const message = await channel.send({
    content: `<@${deal.buyerDiscordId}>`,
    embeds: [
      buildPaymentInstructionEmbed({
        publicDealId: deal.publicId,
        pair: buyerPair,
        cryptoAmount: toDecimal(String(payment.expectedCryptoAmount)),
        buyerTotalUsd: toDecimal(String(deal.buyerTotalUsd ?? '0')),
        dealAmountUsd: toDecimal(String(deal.dealAmountUsd ?? '0')),
        feeUsd: toDecimal(String(deal.feeUsd ?? '0')),
        usdPrice: toDecimal(String(quote.usdPrice)),
        depositAddress: payment.depositAddress,
        quotedAt: quote.quotedAt,
        quoteExpiresAt: quote.expiresAt,
        requiredConfirmations: payment.requiredConfirmations,
        isMockMode: !env.LIVE_MODE,
        isMockPrice: ctx.bot.prices.isMock,
      }),
    ],
    components: [
      buildPaymentActionsRow({ publicDealId: deal.publicId, nonce, quoteExpired: false }),
    ],
    allowedMentions: { users: deal.buyerDiscordId ? [deal.buyerDiscordId] : [] },
  });

  await ctx.bot.prisma.deal.update({
    where: { id: deal.id },
    data: { paymentMessageId: message.id, statusMessageId: message.id },
  });
}

/** "Check Payment Status" — reports what the monitor currently knows. */
export async function handleCheckPayment(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'deal:mutate', interaction.user.id);

  const { deal } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  requireParticipant(deal, interaction.user.id);

  const payment = await ctx.bot.payments.activePayment(deal.id);

  if (!payment) {
    await replyPrivate(interaction, {
      content: 'There is no payment request for this deal yet.',
    });
    return;
  }

  const stale = ctx.bot.payments.isQuoteStale(payment.quote);

  await replyPrivate(interaction, {
    content: [
      `**Payment status:** \`${payment.status}\``,
      `**Confirmations:** ${payment.confirmations} / ${payment.requiredConfirmations}`,
      payment.txHash ? `**Transaction:** \`${payment.txHash}\`` : '**Transaction:** not seen yet',
      stale
        ? '\n⚠️ The rate for this request has expired. Use **Refresh Rate** to get a current amount before sending.'
        : '',
      '\nThe bot checks the blockchain itself. A screenshot or a transaction hash you provide is not enough to confirm a payment.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** "Refresh Rate" — replaces an expired quote with a current one. */
export async function handleRequote(
  interaction: ButtonInteraction,
  ctx: InteractionContext,
  parts: CustomIdParts,
): Promise<void> {
  await enforceRateLimit(ctx.bot.redis, 'price:quote', interaction.user.id);

  const { deal, channel } = await loadDealForInteraction(interaction, ctx);

  assertTargetMatches(deal, parts.target);
  await assertFreshNonce(ctx, deal, parts.nonce);
  requireBuyer(deal, interaction.user.id);

  const buyerPair = ctx.bot.currencies.buyerPair(deal);

  if (!buyerPair) {
    throw new ValidationError(
      `Deal ${deal.id} has no buyer currency`,
      'The payment currency has not been chosen yet.',
    );
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    const payment = await ctx.bot.payments.activePayment(current.id);

    if (!payment) {
      throw new ValidationError(
        `Deal ${current.id} has no payment to re-quote`,
        'There is no payment request for this deal yet.',
      );
    }

    return ctx.bot.payments.requote({
      deal: current,
      payment,
      buyerPair,
      actorDiscordId: interaction.user.id,
      correlationId: ctx.correlationId,
    });
  });

  await postInstructions(ctx, channel, result.deal, result.payment, result.quote);

  await withLock(ctx.bot.redis, dealLockKey(deal.id), async () => {
    const current = await ctx.bot.deals.requireById(deal.id);
    if (current.status === 'PAYMENT_REQUEST_CREATED') {
      await ctx.bot.payments.armMonitoring({
        deal: current,
        actorDiscordId: interaction.user.id,
        correlationId: ctx.correlationId,
      });
    }
  });

  await safeReply(interaction, {
    content: '✅ A new rate has been fetched. Please use the latest payment message.',
  });

  log.info({ dealId: deal.id }, 'payment re-quoted');
}
