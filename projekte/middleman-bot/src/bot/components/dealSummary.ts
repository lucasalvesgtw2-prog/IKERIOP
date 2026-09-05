import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { formatUsd, type Decimal } from '../../core/money.js';
import { forEmbedField } from '../../core/text.js';
import { COLORS, RULE } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

/**
 * The deal summary the buyer approves.
 *
 * Every user-written field is escaped: the seller must not be able to make
 * their description render as bot formatting, since this embed is exactly
 * where a spoofed "send payment to …" line would be most convincing.
 *
 * The fee and the buyer's total are shown here, not only on the later payment
 * screen. The buyer is agreeing to pay, so they are told what they will pay
 * before they agree — nothing is added later.
 */
export interface DealSummaryData {
  publicDealId: string;
  buyerDiscordId: string;
  sellerDiscordId: string;
  item: string;
  description: string;
  additionalTerms: string | null;
  dealAmountUsd: Decimal;
  feeUsd: Decimal;
  buyerTotalUsd: Decimal;
  feePercentage: Decimal;
  revision: number;
}

export function buildDealSummaryEmbed(
  data: DealSummaryData,
  options: { approved?: boolean; changeRequestReason?: string | null } = {},
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(options.approved ? COLORS.success : COLORS.money)
    .setTitle(`${RULE}\n        DEAL DETAILS\n${RULE}`)
    .addFields(
      { name: 'Deal ID', value: `\`${data.publicDealId}\``, inline: true },
      { name: 'Revision', value: `#${data.revision}`, inline: true },
      { name: '​', value: '​', inline: true },
      { name: '🛒 Buyer', value: `<@${data.buyerDiscordId}>`, inline: true },
      { name: '📦 Seller', value: `<@${data.sellerDiscordId}>`, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Item / Service', value: forEmbedField(data.item) },
      { name: 'Description', value: forEmbedField(data.description) },
    );

  if (data.additionalTerms) {
    embed.addFields({ name: 'Additional Terms', value: forEmbedField(data.additionalTerms) });
  }

  embed.addFields(
    { name: '​', value: RULE },
    { name: 'Deal Value', value: `**${formatUsd(data.dealAmountUsd)} USD**`, inline: true },
    {
      name: `Middleman Fee (${trimPercentage(data.feePercentage)}%)`,
      value: `${formatUsd(data.feeUsd)} USD`,
      inline: true,
    },
    {
      name: 'Buyer Pays',
      value: `**${formatUsd(data.buyerTotalUsd)} USD**`,
      inline: true,
    },
    {
      name: 'Seller Receives',
      value: `${formatUsd(data.dealAmountUsd)} USD (the full deal value)`,
    },
  );

  if (options.changeRequestReason) {
    embed.addFields({
      name: '❌ Changes requested by the buyer',
      value: forEmbedField(options.changeRequestReason),
    });
  }

  embed.setFooter({
    text: options.approved
      ? 'The buyer has approved this deal.'
      : 'Only the Buyer can approve this deal. All values are in US Dollars.',
  });

  return embed;
}

/** Approval buttons. Shown to everyone; only the buyer's click is accepted. */
export function buildApprovalRow(params: {
  publicDealId: string;
  nonce: string;
}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'approve',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Confirm Deal')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'changes',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Request Changes')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );
}

/** Posted once the buyer has approved. */
export function buildApprovedNotice(params: {
  publicDealId: string;
  buyerDiscordId: string;
  buyerTotalUsd: Decimal;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Deal approved by the buyer')
    .setDescription(
      [
        `<@${params.buyerDiscordId}> has approved deal \`${params.publicDealId}\`.`,
        '',
        `The buyer will pay **${formatUsd(params.buyerTotalUsd)} USD** in the cryptocurrency of their choice.`,
        '',
        'Next: the buyer selects the payment currency, then the seller selects the currency they want to receive.',
      ].join('\n'),
    );
}

/** Posted when the buyer sends the deal back to the seller. */
export function buildChangesRequestedNotice(params: {
  publicDealId: string;
  buyerDiscordId: string;
  sellerDiscordId: string;
  reason: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle('❌ Changes requested')
    .setDescription(
      [
        `<@${params.buyerDiscordId}> has requested changes to deal \`${params.publicDealId}\`.`,
        '',
        '**What needs to be changed:**',
        forEmbedField(params.reason, 1_500),
        '',
        `<@${params.sellerDiscordId}>, please update the deal details. The buyer will have to approve the new version.`,
      ].join('\n'),
    );
}

/** Renders `5` rather than `5.0000`. */
function trimPercentage(value: Decimal): string {
  return value.toDecimalPlaces(4).toString();
}
