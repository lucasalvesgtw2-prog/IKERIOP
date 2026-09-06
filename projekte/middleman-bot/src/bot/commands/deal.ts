import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { formatCrypto, formatUsd, toDecimal } from '../../core/money.js';
import { getAsset, getNetwork } from '../../config/assets.js';
import { DEAL_STATE_LABELS, type DealState } from '../../domain/deal/state.js';
import { isStaff, isParticipant } from '../guards/authorization.js';
import { COLORS } from '../components/colors.js';
import { replyPrivate } from '../interactions/respond.js';
import { type InteractionContext } from '../interactions/context.js';
import { type BotCommand } from './types.js';

/**
 * `/deal status` and `/deal dispute`.
 *
 * Both read the deal from the channel they are used in, so a deal id never has
 * to be typed and cannot be guessed. Access is limited to the deal's own
 * participants and to staff.
 */
const data = new SlashCommandBuilder()
  .setName('deal')
  .setDescription('Information and actions for the deal in this ticket.')
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Show the current status of this deal.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('dispute')
      .setDescription('Open a dispute for this deal (after the payment is confirmed).'),
  )
  .setDMPermission(false);

export const dealCommand: BotCommand = {
  name: 'deal',
  data: data.toJSON(),

  async execute(interaction: ChatInputCommandInteraction, ctx: InteractionContext): Promise<void> {
    const ticket = await ctx.bot.tickets.requireByChannelId(interaction.channelId);
    const deal = ticket.deal;

    if (!isStaff(ctx.member, ctx.guildConfig) && !isParticipant(deal, interaction.user.id)) {
      await replyPrivate(interaction, { content: 'You are not a participant in this deal.' });
      return;
    }

    if (interaction.options.getSubcommand() === 'dispute') {
      const check = ctx.bot.disputes.canOpen(deal);

      await replyPrivate(interaction, {
        content: check.allowed
          ? 'Use the **⚠️ Open Dispute** button on the deal panel in this ticket to file a dispute.'
          : `❌ ${check.reason ?? 'This deal cannot be disputed at the moment.'}`,
      });
      return;
    }

    const payment = await ctx.bot.payments.activePayment(deal.id);
    const payout = await ctx.bot.payouts.findByDeal(deal.id);
    const status = deal.status as DealState;

    const fields = [
      { name: 'Deal ID', value: `\`${deal.publicId}\``, inline: true },
      { name: 'Status', value: DEAL_STATE_LABELS[status] ?? status, inline: true },
      { name: '​', value: '​', inline: true },
    ];

    if (deal.buyerDiscordId) {
      fields.push({ name: '🛒 Buyer', value: `<@${deal.buyerDiscordId}>`, inline: true });
    }
    if (deal.sellerDiscordId) {
      fields.push({ name: '📦 Seller', value: `<@${deal.sellerDiscordId}>`, inline: true });
    }

    if (deal.dealAmountUsd) {
      fields.push(
        { name: '​', value: '​', inline: true },
        {
          name: 'Deal Value',
          value: `${formatUsd(toDecimal(String(deal.dealAmountUsd)))} USD`,
          inline: true,
        },
        {
          name: 'Middleman Fee',
          value: `${formatUsd(toDecimal(String(deal.feeUsd ?? '0')))} USD`,
          inline: true,
        },
        {
          name: 'Buyer Total',
          value: `${formatUsd(toDecimal(String(deal.buyerTotalUsd ?? '0')))} USD`,
          inline: true,
        },
      );
    }

    if (payment) {
      const asset = getAsset(payment.asset);
      fields.push({
        name: 'Payment',
        value: [
          `Status: \`${payment.status}\``,
          `Amount: ${formatCrypto(toDecimal(String(payment.expectedCryptoAmount)), asset?.decimals ?? 8, payment.asset)}`,
          `Network: ${getNetwork(payment.network)?.label ?? payment.network}`,
          `Confirmations: ${payment.confirmations} / ${payment.requiredConfirmations}`,
          payment.txHash ? `Transaction: \`${payment.txHash}\`` : 'Transaction: not seen yet',
        ].join('\n'),
        inline: false,
      });
    }

    if (payout) {
      fields.push({
        name: 'Payout',
        value: [
          `Status: \`${payout.status}\``,
          `Destination: \`${payout.destinationAddress}\``,
          payout.txHash ? `Transaction: \`${payout.txHash}\`` : 'Transaction: not sent yet',
        ].join('\n'),
        inline: false,
      });
    }

    fields.push({
      name: 'Confirmations',
      value: [
        `Buyer approved the details: ${deal.buyerApproved ? '✅' : '⏳'}`,
        `Buyer confirmed completion: ${deal.buyerCompleted ? '✅' : '⏳'}`,
        `Seller confirmed completion: ${deal.sellerCompleted ? '✅' : '⏳'}`,
        `Seller confirmed receipt: ${deal.sellerReceivedFunds ? '✅' : '⏳'}`,
      ].join('\n'),
      inline: false,
    });

    await replyPrivate(interaction, {
      embeds: [{ color: COLORS.info, title: `Deal ${deal.publicId}`, fields }],
    });
  },
};

export const DEAL_EPHEMERAL = MessageFlags.Ephemeral;
