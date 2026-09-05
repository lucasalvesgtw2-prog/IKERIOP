import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import { COLORS, RULE } from './colors.js';
import { buildCustomId } from '../interactions/customId.js';

/** Panels for the participant and role steps of a deal. */
export const DEAL_DOMAIN = 'deal';

export interface Participant {
  discordId: string;
  /** Server display name, used in select-menu labels where mentions do not render. */
  label: string;
}

/**
 * The user picker shown to the ticket creator.
 *
 * Discord cannot restrict a user select to a candidate list, so every rule
 * (not yourself, not a bot, not banned) is enforced server-side when the
 * selection arrives.
 */
export function buildPartnerSelect(params: {
  publicDealId: string;
  nonce: string;
}): ActionRowBuilder<UserSelectMenuBuilder>[] {
  return [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(
          buildCustomId({
            domain: DEAL_DOMAIN,
            action: 'partner',
            target: params.publicDealId,
            nonce: params.nonce,
          }),
        )
        .setPlaceholder('Select the person you are making this deal with')
        .setMinValues(1)
        .setMaxValues(1),
    ),
  ];
}

/**
 * The role picker.
 *
 * It asks for the buyer only, and the seller is derived as "the other
 * participant". That is deliberate: the UI cannot express an invalid
 * combination, so "the same person is both" is impossible by construction
 * rather than by validation. The server re-checks anyway.
 */
export function buildRoleSelect(params: {
  publicDealId: string;
  nonce: string;
  participants: [Participant, Participant];
}): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const [first, second] = params.participants;

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('Assign the roles for this deal')
    .setDescription(
      [
        'Please select the roles for this deal.',
        '',
        `**Who is the Buyer?** — the person who pays.`,
        `**Who is the Seller?** — the person who provides the item or service and receives the funds.`,
        '',
        `Participants: <@${first.discordId}> and <@${second.discordId}>`,
        '',
        'Choose the **Buyer** below. The other person automatically becomes the **Seller**.',
      ].join('\n'),
    )
    .setFooter({ text: 'Only the person who opened this ticket can assign the roles.' });

  const select = new StringSelectMenuBuilder()
    .setCustomId(
      buildCustomId({
        domain: DEAL_DOMAIN,
        action: 'roles',
        target: params.publicDealId,
        nonce: params.nonce,
      }),
    )
    .setPlaceholder('Who is the Buyer?')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      params.participants.map((participant) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(`${participant.label} is the Buyer`, 100))
          .setValue(participant.discordId)
          .setDescription(truncate(`${participant.label} pays for this deal`, 100)),
      ),
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

/** Shown once both roles are set, with a last chance to swap them. */
export function buildRolesAssignedPanel(params: {
  publicDealId: string;
  buyerDiscordId: string;
  sellerDiscordId: string;
  nonce: string;
  /** Swapping is only possible before the seller enters the deal details. */
  swappable: boolean;
}): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${RULE}\n        DEAL ROLES\n${RULE}`)
    .addFields(
      { name: 'Deal ID', value: `\`${params.publicDealId}\``, inline: false },
      { name: '🛒 Buyer', value: `<@${params.buyerDiscordId}>`, inline: true },
      { name: '📦 Seller', value: `<@${params.sellerDiscordId}>`, inline: true },
      {
        name: 'Next step',
        value: `<@${params.sellerDiscordId}>, please enter the deal details, including the price in **USD**.`,
      },
    )
    .setFooter({
      text: params.swappable
        ? 'Wrong way round? Use "Swap Buyer / Seller" before the details are entered.'
        : 'The roles are now locked for this deal.',
    });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (params.swappable) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            buildCustomId({
              domain: DEAL_DOMAIN,
              action: 'swaproles',
              target: params.publicDealId,
              nonce: params.nonce,
            }),
          )
          .setLabel('Swap Buyer / Seller')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  return { embeds: [embed], components: rows };
}

/** Prompt shown to the seller once the roles are settled. */
export function buildDealDetailsPrompt(params: {
  publicDealId: string;
  sellerDiscordId: string;
  nonce: string;
}): {
  content: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('📝 Deal details')
    .setDescription(
      [
        `<@${params.sellerDiscordId}>, please enter the deal details.`,
        '',
        'You will be asked for:',
        '`•` Item / Service',
        '`•` Description',
        '`•` Additional Terms',
        '`•` **Deal Amount in USD**',
        '',
        'The deal amount must be a plain US Dollar figure, for example `100` for $100.00.',
        'Do **not** enter a cryptocurrency amount — the payment currency is chosen later.',
      ].join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildCustomId({
          domain: DEAL_DOMAIN,
          action: 'details',
          target: params.publicDealId,
          nonce: params.nonce,
        }),
      )
      .setLabel('Enter Deal Details')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary),
  );

  return { content: `<@${params.sellerDiscordId}>`, embeds: [embed], components: [row] };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
