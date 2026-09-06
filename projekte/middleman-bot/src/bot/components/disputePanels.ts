import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { forEmbedField } from '../../core/text.js';
import { DISPUTE_REASON_LIMITS } from '../../services/disputeService.js';
import { COLORS } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';
import { DEAL_DOMAIN } from './dealPanels.js';

export const DISPUTE_REASON_FIELD = 'reason';

export function buildDisputeModal(params: { publicDealId: string; nonce: string }): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(
      buildCustomId({
        domain: DEAL_DOMAIN,
        action: 'disputemodal',
        target: params.publicDealId,
        nonce: params.nonce,
      }),
    )
    .setTitle(`Open a dispute — ${params.publicDealId}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(DISPUTE_REASON_FIELD)
          .setLabel('What is the problem?')
          .setPlaceholder('Describe what went wrong, with as much detail as you can.')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(DISPUTE_REASON_LIMITS.min)
          .setMaxLength(DISPUTE_REASON_LIMITS.max)
          .setRequired(true),
      ),
    );
}

/**
 * The freeze notice.
 *
 * It states plainly that no payout will be released automatically, because
 * that is the reassurance both parties need at the moment a deal goes wrong.
 */
export function buildDisputeOpenedEmbed(params: {
  publicDealId: string;
  openerDiscordId: string;
  reason: string;
  supportMention: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle('⚠️ Dispute Opened')
    .setDescription(
      [
        'This deal has been placed on hold.',
        '',
        '**No payout will be released automatically.**',
        '',
        `Please contact ${params.supportMention} if assistance is required.`,
      ].join('\n'),
    )
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: true },
      { name: 'Opened by', value: `<@${params.openerDiscordId}>`, inline: true },
      { name: 'Reason', value: forEmbedField(params.reason) },
    )
    .setFooter({ text: 'Only support or admin staff can resolve this dispute.' });
}

export function buildDisputeResolvedEmbed(params: {
  publicDealId: string;
  staffDiscordId: string;
  resolution: string;
  note: string;
  movedTo: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ Dispute Resolved')
    .addFields(
      { name: 'Deal', value: `\`${params.publicDealId}\``, inline: true },
      { name: 'Resolved by', value: `<@${params.staffDiscordId}>`, inline: true },
      { name: 'Outcome', value: humanResolution(params.resolution) },
      { name: 'Notes', value: forEmbedField(params.note) },
      { name: 'Deal status', value: `\`${params.movedTo}\`` },
    );
}

function humanResolution(resolution: string): string {
  switch (resolution) {
    case 'RESOLVED_RELEASE_TO_SELLER':
      return 'The funds are released to the seller. The payout still has to be authorised by a middleman.';
    case 'RESOLVED_REFUND_TO_BUYER':
      return 'The buyer is to be refunded. The deal has been cancelled and support will arrange the refund.';
    default:
      return 'Resolved by agreement. See the notes above.';
  }
}
