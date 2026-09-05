import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import { ConfigurationError } from '../../core/errors.js';
import { requireStaffLevel } from '../guards/authorization.js';
import { buildSetupPanel } from '../components/ticketPanels.js';
import { replyPrivate } from '../interactions/respond.js';
import { type InteractionContext } from '../interactions/context.js';
import { type BotCommand } from './types.js';

/**
 * `/setup` — posts the public "Open Middleman Ticket" panel.
 *
 * Restricted to admins twice over: Discord's own `default_member_permissions`
 * hides it from ordinary members, and the handler re-checks server-side,
 * because the Discord-side restriction is a convenience, not a guarantee.
 */
const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Post the public panel where users can open a middleman ticket.')
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Where to post the panel. Defaults to the current channel.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export const setupCommand: BotCommand = {
  name: 'setup',
  data: data.toJSON(),

  async execute(interaction: ChatInputCommandInteraction, ctx: InteractionContext): Promise<void> {
    requireStaffLevel(ctx.member, ctx.guildConfig, 'admin');

    const target = (interaction.options.getChannel('channel') ??
      interaction.channel) as TextChannel | null;

    if (!target || target.type !== ChannelType.GuildText) {
      throw new ConfigurationError('Setup target is not a text channel');
    }

    const me = ctx.guild.members.me;

    if (!me || !target.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
      throw new ConfigurationError(`The bot cannot post in <#${target.id}>`, {
        channelId: target.id,
      });
    }

    await target.send(buildSetupPanel());

    const warnings = collectConfigWarnings(ctx);

    await replyPrivate(interaction, {
      content: [
        `✅ The middleman panel has been posted in <#${target.id}>.`,
        ...warnings.map((warning) => `⚠️ ${warning}`),
      ].join('\n'),
    });
  },
};

/**
 * Surfaces configuration gaps at setup time rather than letting them show up
 * as a confusing ticket later.
 */
function collectConfigWarnings(ctx: InteractionContext): string[] {
  const warnings: string[] = [];

  if (!ctx.guildConfig.supportRoleId) {
    warnings.push(
      'No support role is configured. Set `SUPPORT_ROLE_ID` so users can be told who to tag for help.',
    );
  }

  if (!ctx.guildConfig.adminRoleId) {
    warnings.push(
      'No admin role is configured. Only server administrators can run admin commands.',
    );
  }

  if (!ctx.guildConfig.ticketCategoryId) {
    warnings.push('No ticket category is configured. Tickets will be created without a category.');
  }

  if (ctx.guildConfig.enabledAssets.length === 0) {
    warnings.push('No cryptocurrencies are available in the current runtime mode.');
  }

  return warnings;
}
