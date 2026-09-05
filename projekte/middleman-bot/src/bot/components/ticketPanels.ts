import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from 'discord.js';
import { getEnv } from '../../config/env.js';
import { type ResolvedGuildConfig } from '../../services/configService.js';
import { buildCustomId } from '../interactions/customId.js';
import { COLORS, RULE } from './colors.js';

/**
 * All ticket-related Discord views.
 *
 * Rendering is kept away from the services so a panel can be re-rendered from
 * database state at any time — which is what makes the "out of date message"
 * recovery path possible.
 */

export const TICKET_DOMAIN = 'ticket';

/** The public panel posted by `/setup`. */
export function buildSetupPanel(): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const env = getEnv();

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle('🛡️ Middleman Service')
    .setDescription(
      [
        'Trade safely. The middleman holds the payment in escrow until both sides confirm that the deal is complete.',
        '',
        '**How it works**',
        '`1.` Open a ticket below.',
        '`2.` Add the person you are dealing with.',
        '`3.` Assign who is the **Buyer** and who is the **Seller**.',
        '`4.` The seller enters the deal details and the price in **USD**.',
        '`5.` The buyer approves, then pays in the cryptocurrency of their choice.',
        '`6.` Once the payment is confirmed on the blockchain, complete the deal.',
        '`7.` Both sides confirm, and the funds are released to the seller.',
        '',
        'All deal values are in **US Dollars**. Cryptocurrency is only the payment method.',
      ].join('\n'),
    )
    .addFields({
      name: 'Middleman fee',
      value: `${trimNumber(env.DEFAULT_FEE_PERCENTAGE)}% of the deal value, paid by the buyer on top of the agreed price.`,
    })
    .setFooter({ text: 'Click the button below to start a new deal.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId({ domain: TICKET_DOMAIN, action: 'open' }))
      .setLabel('Open Middleman Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [row] };
}

/**
 * The welcome message every ticket receives.
 *
 * The support mention is mandatory: users must always know they can escalate.
 * When no support role is configured the wording degrades to plain text rather
 * than silently dropping the instruction.
 */
export function buildSupportWelcome(config: ResolvedGuildConfig): {
  content: string;
  embeds: EmbedBuilder[];
} {
  const supportMention = config.supportRoleId ? `<@&${config.supportRoleId}>` : '`@support`';

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle('🛡️ Middleman Support')
    .setDescription(
      [
        'Welcome to the Middleman service.',
        '',
        `If you experience any problems during your deal, please tag ${supportMention} in this ticket and a support member will assist you.`,
        '',
        '⚠️ **Never send funds to an address provided outside of this ticket.**',
        'The bot will always post the payment address here, inside this channel.',
        '',
        'Please follow the instructions from the bot carefully.',
      ].join('\n'),
    );

  const env = getEnv();
  if (!env.LIVE_MODE) {
    embed.addFields({
      name: '🧪 Mock mode',
      value:
        'This bot is running in **MOCK MODE**. No real funds are involved and any payment shown here is **simulated**.',
    });
  }

  return { content: supportMention === '`@support`' ? '' : supportMention, embeds: [embed] };
}

/** The action panel inside a fresh ticket. */
export function buildTicketPanel(params: {
  publicDealId: string;
  creatorDiscordId: string;
  nonce: string;
  partnerAdded: boolean;
}): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const fields: APIEmbedField[] = [
    { name: 'Deal ID', value: `\`${params.publicDealId}\``, inline: true },
    { name: 'Opened by', value: `<@${params.creatorDiscordId}>`, inline: true },
    {
      name: 'Next step',
      value: params.partnerAdded
        ? 'Assign who is the **Buyer** and who is the **Seller**.'
        : 'Add the person you are making this deal with.',
    },
  ];

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`${RULE}\n        MIDDLEMAN TICKET\n${RULE}`)
    .addFields(fields)
    .setFooter({ text: 'Only the person who opened this ticket can add the deal partner.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: TICKET_DOMAIN,
          action: 'addpartner',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Add Deal Partner')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(params.partnerAdded),
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: TICKET_DOMAIN,
          action: 'close',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Close Ticket')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

/** Ephemeral confirmation shown before a ticket is actually closed. */
export function buildCloseConfirmation(params: { publicDealId: string; nonce: string }): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle('Close this ticket?')
    .setDescription(
      [
        `Deal \`${params.publicDealId}\` will be cancelled and this channel will be archived.`,
        '',
        'This cannot be undone.',
      ].join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: TICKET_DOMAIN,
          action: 'closeconfirm',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Yes, close the ticket')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: TICKET_DOMAIN,
          action: 'closecancel',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Keep it open')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function buildTicketClosedNotice(params: {
  publicDealId: string;
  actorDiscordId: string;
  dealCancelled: boolean;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setTitle('🔒 Ticket closed')
    .setDescription(
      [
        `Deal \`${params.publicDealId}\` was closed by <@${params.actorDiscordId}>.`,
        params.dealCancelled ? 'The deal has been cancelled.' : '',
        '',
        'This channel is now read-only and will be archived.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
}

/** Removes a trailing `.0` so `5.0` renders as `5`. */
function trimNumber(value: string): string {
  return value.replace(/\.0+$/, '');
}
