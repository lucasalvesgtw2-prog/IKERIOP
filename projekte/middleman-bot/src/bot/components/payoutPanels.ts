import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { formatCrypto, formatUsd, type Decimal } from '../../core/money.js';
import { type AssetNetworkPair } from '../../config/assets.js';
import { COLORS, RULE } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

export const PAYOUT_ADDRESS_FIELD = 'address';

/** Asks the seller for a payout address, naming the exact asset and network. */
export function buildPayoutAddressPrompt(params: {
  publicDealId: string;
  sellerDiscordId: string;
  pair: AssetNetworkPair;
  nonce: string;
}): { content: string; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(COLORS.money)
    .setTitle('💰 Payout Address')
    .setDescription(
      [
        'Both parties have confirmed that the deal is completed.',
        '',
        'Please enter the cryptocurrency address where you want to receive your funds.',
        '',
        `**Receiving currency:** ${params.pair.asset.symbol}`,
        `**Network:** ${params.pair.network.label}`,
        '',
        '⚠️ **Double-check your address and network before submitting it.**',
        'A payout sent to a wrong address cannot be recovered.',
      ].join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'payaddr',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Enter Payout Address')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Primary),
  );

  return { content: `<@${params.sellerDiscordId}>`, embeds: [embed], components: [row] };
}

export function buildPayoutAddressModal(params: {
  publicDealId: string;
  nonce: string;
  pair: AssetNetworkPair;
}): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(
      buildCustomId({
        domain: DEAL_DOMAIN,
        action: 'payaddrmodal',
        target: params.publicDealId,
        nonce: params.nonce,
      }),
    )
    .setTitle(`${params.pair.asset.symbol} payout address`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(PAYOUT_ADDRESS_FIELD)
          .setLabel(`${params.pair.asset.symbol} address (${params.pair.network.label})`)
          .setPlaceholder('Paste the address from your wallet')
          .setStyle(TextInputStyle.Short)
          .setMinLength(10)
          .setMaxLength(120)
          .setRequired(true),
      ),
    );
}

/**
 * The payout review.
 *
 * Shown to the seller and to staff before anything is signed. The
 * authorisation buttons are rendered for everyone but only accepted from a
 * middleman or admin who is not a party to the deal.
 */
export function buildPayoutReviewPanel(params: {
  publicDealId: string;
  amountUsd: Decimal;
  cryptoAmount: Decimal;
  pair: AssetNetworkPair;
  destinationAddress: string;
  networkFee: Decimal | null;
  nonce: string;
  isMockMode: boolean;
}): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(COLORS.money)
    .setTitle(`${RULE}\n       PAYOUT REVIEW\n${RULE}`)
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: false },
      { name: 'Deal Value', value: `**${formatUsd(params.amountUsd)} USD**`, inline: true },
      { name: 'Seller Currency', value: params.pair.asset.symbol, inline: true },
      { name: 'Network', value: params.pair.network.label, inline: true },
      { name: 'Destination', value: `\`\`\`\n${params.destinationAddress}\n\`\`\`` },
      {
        name: 'Amount',
        value: `**${formatCrypto(params.cryptoAmount, params.pair.asset.decimals, params.pair.asset.symbol)}**`,
        inline: true,
      },
      {
        name: 'Network fee',
        value: params.networkFee
          ? formatCrypto(params.networkFee, params.pair.asset.decimals, params.pair.asset.symbol)
          : 'Paid by the middleman service',
        inline: true,
      },
    )
    .setFooter({
      text: 'A payout must be authorised by a middleman or admin who is not a party to this deal.',
    });

  if (params.isMockMode) {
    embed.addFields({
      name: '🧪 Mock mode',
      value: 'This payout is **simulated**. No real funds will move.',
    });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'payauth',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Authorize Payout')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'payreject',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Reject Address')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

export function buildPayoutSentEmbed(params: {
  publicDealId: string;
  txHash: string;
  explorerUrl?: string;
  isMockMode: boolean;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('⏳ Payout sent')
    .setDescription(
      [
        'The transaction has been broadcast to the blockchain.',
        '',
        'Waiting for confirmation…',
      ].join('\n'),
    )
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: true },
      {
        name: 'Transaction',
        value: params.explorerUrl
          ? `[\`${params.txHash.slice(0, 18)}…\`](${params.explorerUrl})`
          : `\`${params.txHash}\``,
      },
    );

  if (params.isMockMode) {
    embed.addFields({
      name: '🧪 Mock mode',
      value: 'This transaction is **simulated** and does not exist on any blockchain.',
    });
  }

  return embed;
}

/** Asks the seller whether the funds actually arrived. */
export function buildReceiptPanel(params: {
  publicDealId: string;
  sellerDiscordId: string;
  nonce: string;
}): { content: string; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Payout Confirmed')
    .setDescription(
      [
        'The payout has been successfully confirmed on the blockchain.',
        '',
        '**Did you receive the funds?**',
      ].join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'received',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Yes, I received the funds')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'notreceived',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('I did not receive the funds')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );

  return { content: `<@${params.sellerDiscordId}>`, embeds: [embed], components: [row] };
}

/** The closing summary. */
export function buildDealCompletedEmbed(params: {
  publicDealId: string;
  dealAmountUsd: Decimal;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${RULE}\n      DEAL COMPLETED\n${RULE}`)
    .setDescription(
      [
        '✅ Payment received',
        '✅ Deal completed',
        '✅ Payout sent',
        '✅ Seller confirmed receipt',
      ].join('\n'),
    )
    .addFields(
      { name: 'Deal ID', value: `\`${params.publicDealId}\``, inline: true },
      { name: 'Deal Value', value: `${formatUsd(params.dealAmountUsd)} USD`, inline: true },
    )
    .setFooter({ text: 'Thank you for using the Middleman service.' });
}

/** Posted when the seller reports the payout never arrived. */
export function buildPayoutReviewRequiredEmbed(params: {
  publicDealId: string;
  supportMention: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle('⚠️ Payout Review Required')
    .setDescription(
      [
        'The Seller reported that the payout has not been received.',
        '',
        '**No additional payout will be sent automatically.**',
        '',
        `Please contact ${params.supportMention} for assistance.`,
      ].join('\n'),
    )
    .addFields({ name: 'Deal', value: `\`${params.publicDealId}\`` });
}
