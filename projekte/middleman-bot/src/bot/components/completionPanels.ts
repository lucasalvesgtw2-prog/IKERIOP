import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { COLORS, RULE } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

/**
 * Completion confirmations.
 *
 * The panel is a live scoreboard: each party sees their own status and the
 * other's, so it is obvious who the deal is waiting for. It is re-rendered on
 * every confirmation rather than edited into ambiguity.
 */
export function buildCompletionPanel(params: {
  publicDealId: string;
  buyerDiscordId: string;
  sellerDiscordId: string;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  nonce: string;
}): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const bothConfirmed = params.buyerConfirmed && params.sellerConfirmed;

  const embed = new EmbedBuilder()
    .setColor(bothConfirmed ? COLORS.success : COLORS.info)
    .setTitle(`${RULE}\n      DEAL COMPLETION\n${RULE}`)
    .setDescription(
      bothConfirmed
        ? 'Both parties have confirmed that the deal is complete. The payout can now be arranged.'
        : [
            'The payment is held in escrow. Please carry out the deal as agreed.',
            '',
            'When the deal is finished, **both** parties must confirm below.',
            'The funds are only released to the seller once both have confirmed.',
          ].join('\n'),
    )
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: false },
      {
        name: '🛒 Buyer',
        value: params.buyerConfirmed
          ? `✅ Confirmed — <@${params.buyerDiscordId}>`
          : `⏳ Waiting for confirmation — <@${params.buyerDiscordId}>`,
        inline: false,
      },
      {
        name: '📦 Seller',
        value: params.sellerConfirmed
          ? `✅ Confirmed — <@${params.sellerDiscordId}>`
          : `⏳ Waiting for confirmation — <@${params.sellerDiscordId}>`,
        inline: false,
      },
    );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (!bothConfirmed) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            buildCustomId({
              domain: DEAL_DOMAIN,
              action: 'complete',
              target: params.publicDealId,
              nonce: params.nonce,
            }),
          )
          .setLabel('Deal Completed')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(
            buildCustomId({
              domain: DEAL_DOMAIN,
              action: 'dispute',
              target: params.publicDealId,
              nonce: params.nonce,
            }),
          )
          .setLabel('Open Dispute')
          .setEmoji('⚠️')
          .setStyle(ButtonStyle.Danger),
      ),
    );
  }

  return { embeds: [embed], components: rows };
}
