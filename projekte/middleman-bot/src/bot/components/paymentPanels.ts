import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { formatCrypto, formatUsd, formatUsdPrice, type Decimal } from '../../core/money.js';
import { type AssetNetworkPair } from '../../config/assets.js';
import { COLORS, RULE } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

/**
 * Payment instructions.
 *
 * The address and the exact amount are the two things a buyer copies, so they
 * are on their own lines in code formatting, and the network warning is
 * impossible to miss. A mock-mode banner is added whenever the deployment is
 * not live, so a simulated payment can never be mistaken for a real one.
 */
export interface PaymentInstructionData {
  publicDealId: string;
  pair: AssetNetworkPair;
  cryptoAmount: Decimal;
  buyerTotalUsd: Decimal;
  dealAmountUsd: Decimal;
  feeUsd: Decimal;
  usdPrice: Decimal;
  depositAddress: string;
  quotedAt: Date;
  quoteExpiresAt: Date;
  requiredConfirmations: number;
  isMockMode: boolean;
  isMockPrice: boolean;
}

export function buildPaymentInstructionEmbed(data: PaymentInstructionData): EmbedBuilder {
  const { asset, network } = data.pair;

  const embed = new EmbedBuilder()
    .setColor(COLORS.money)
    .setTitle(`${RULE}\n       SEND PAYMENT\n${RULE}`)
    .addFields(
      { name: 'Deal', value: `\`${data.publicDealId}\``, inline: false },
      {
        name: 'You must send',
        value: `**${formatCrypto(data.cryptoAmount, asset.decimals, asset.symbol)}**`,
        inline: false,
      },
      { name: 'Network', value: `**${network.label}**`, inline: false },
      { name: 'Payment Address', value: `\`\`\`\n${data.depositAddress}\n\`\`\``, inline: false },
      { name: '​', value: RULE },
      { name: 'Deal Value', value: `${formatUsd(data.dealAmountUsd)} USD`, inline: true },
      { name: 'Middleman Fee', value: `${formatUsd(data.feeUsd)} USD`, inline: true },
      { name: 'Buyer Total', value: `**${formatUsd(data.buyerTotalUsd)} USD**`, inline: true },
      {
        name: 'Rate used',
        value: `1 ${asset.symbol} = ${formatUsdPrice(data.usdPrice)} USD`,
        inline: false,
      },
      {
        name: 'Quote valid until',
        value: `<t:${Math.floor(data.quoteExpiresAt.getTime() / 1000)}:R>`,
        inline: true,
      },
      {
        name: 'Confirmations required',
        value: String(data.requiredConfirmations),
        inline: true,
      },
    );

  const warnings = [
    `⚠️ **Only send ${asset.symbol} using the ${network.label} network.**`,
    'Sending funds on another network, or a different coin, may result in a permanent loss of funds.',
    '',
    `⚠️ Send the **exact amount**. The payment is verified on the blockchain before the deal continues.`,
    '⚠️ Never send funds to an address given to you outside this ticket.',
  ];

  if (data.isMockMode || data.isMockPrice) {
    warnings.unshift(
      '🧪 **MOCK MODE — this is a simulated payment.** No real funds are involved and this address is not a real deposit address.',
      '',
    );
  }

  embed.setDescription(warnings.join('\n'));

  embed.setFooter({
    text: data.isMockPrice
      ? 'MOCK price data — not a market rate.'
      : 'The rate above was fetched when this request was created.',
  });

  return embed;
}

/** Controls offered while a payment is outstanding. */
export function buildPaymentActionsRow(params: {
  publicDealId: string;
  nonce: string;
  quoteExpired: boolean;
}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'paycheck',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Check Payment Status')
      .setEmoji('🔎')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'requote',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Refresh Rate')
      .setEmoji('🔄')
      .setStyle(params.quoteExpired ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

/** Live progress while a detected payment gathers confirmations. */
export function buildConfirmationProgressEmbed(params: {
  publicDealId: string;
  assetSymbol: string;
  confirmations: number;
  requiredConfirmations: number;
  txHash: string;
  explorerUrl?: string;
}): EmbedBuilder {
  const complete = params.confirmations >= params.requiredConfirmations;

  return new EmbedBuilder()
    .setColor(complete ? COLORS.success : COLORS.warning)
    .setTitle(complete ? '✅ Payment confirmed on the blockchain' : '⏳ Payment detected')
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: true },
      {
        name: 'Confirmations',
        value: `${params.confirmations} / ${params.requiredConfirmations}`,
        inline: true,
      },
      {
        name: 'Status',
        value: complete ? '✅ Confirmed' : '⏳ Waiting for confirmations…',
        inline: true,
      },
      {
        name: 'Transaction',
        value: params.explorerUrl
          ? `[\`${shortHash(params.txHash)}\`](${params.explorerUrl})`
          : `\`${params.txHash}\``,
      },
    );
}

/**
 * The confirmation message. Posted only after the bot has independently read
 * the transaction from the chain and counted the required confirmations.
 */
export function buildPaymentConfirmedEmbed(params: {
  publicDealId: string;
  buyerTotalUsd: Decimal;
  isMockMode: boolean;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Payment Confirmed')
    .setDescription(
      [
        'The required payment has been successfully received and confirmed on the blockchain.',
        '',
        'The deal can now continue.',
        '',
        'Please proceed with the transaction according to the agreed deal details.',
      ].join('\n'),
    )
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: true },
      { name: 'Held in escrow', value: `${formatUsd(params.buyerTotalUsd)} USD`, inline: true },
    );

  if (params.isMockMode) {
    embed.addFields({
      name: '🧪 Mock mode',
      value: 'This confirmation is **simulated**. No real funds were received.',
    });
  }

  return embed;
}

function shortHash(hash: string): string {
  return hash.length <= 20 ? hash : `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
