import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
  type TextChannel,
} from 'discord.js';
import { ConfigurationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type ResolvedGuildConfig } from '../services/configService.js';

const log = createLogger('ticket-channel');

/**
 * Discord channel plumbing for tickets.
 *
 * The permission overwrites are the actual access control for a ticket: a user
 * who is not on this list cannot read the channel at all, so a leaked deal id
 * is not enough to see a deal.
 */

/** What a participant may do inside their ticket. */
const PARTICIPANT_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
];

/** Staff additionally need to manage the channel while resolving a dispute. */
const STAFF_ALLOW = [...PARTICIPANT_ALLOW, PermissionFlagsBits.ManageMessages];

const BOT_ALLOW = [
  ...STAFF_ALLOW,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.MentionEveryone,
];

export function buildTicketOverwrites(params: {
  guild: Guild;
  botId: string;
  participantIds: string[];
  config: ResolvedGuildConfig;
}): OverwriteResolvable[] {
  const overwrites: OverwriteResolvable[] = [
    // Everyone is denied by default; access is granted explicitly below.
    { id: params.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: params.botId, allow: BOT_ALLOW },
  ];

  for (const participantId of new Set(params.participantIds)) {
    overwrites.push({ id: participantId, allow: PARTICIPANT_ALLOW });
  }

  const staffRoleIds = [
    params.config.supportRoleId,
    params.config.middlemanRoleId,
    params.config.adminRoleId,
  ].filter((roleId): roleId is string => Boolean(roleId));

  for (const roleId of new Set(staffRoleIds)) {
    overwrites.push({ id: roleId, allow: STAFF_ALLOW });
  }

  return overwrites;
}

export interface CreateTicketChannelInput {
  guild: Guild;
  name: string;
  creatorId: string;
  config: ResolvedGuildConfig;
  topic: string;
}

export async function createTicketChannel(input: CreateTicketChannelInput): Promise<TextChannel> {
  const botId = input.guild.client.user?.id;

  if (!botId) {
    throw new ConfigurationError('The bot user is not available yet');
  }

  const parent = await resolveCategory(input.guild, input.config.ticketCategoryId);

  return input.guild.channels.create({
    name: input.name,
    type: ChannelType.GuildText,
    parent: parent?.id ?? null,
    topic: input.topic,
    permissionOverwrites: buildTicketOverwrites({
      guild: input.guild,
      botId,
      participantIds: [input.creatorId],
      config: input.config,
    }),
    reason: `Middleman ticket opened by ${input.creatorId}`,
  });
}

/** Grants an added deal partner access to an existing ticket channel. */
export async function grantChannelAccess(
  channel: TextChannel,
  userId: string,
  reason: string,
): Promise<void> {
  await channel.permissionOverwrites.edit(
    userId,
    Object.fromEntries(PARTICIPANT_ALLOW.map((flag) => [flag.toString(), true])),
    { reason },
  );
}

/**
 * Locks a ticket after it is closed: participants keep read access to their own
 * history, but nobody can post any more. Staff retain full access.
 */
export async function lockTicketChannel(
  channel: TextChannel,
  participantIds: string[],
  reason: string,
): Promise<void> {
  for (const participantId of new Set(participantIds)) {
    try {
      await channel.permissionOverwrites.edit(
        participantId,
        {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: false,
          AddReactions: false,
        },
        { reason },
      );
    } catch (error) {
      log.warn(
        { channelId: channel.id, participantId, err: String(error) },
        'failed to lock participant overwrite',
      );
    }
  }
}

/** Moves a closed ticket into the archive category, when one is configured. */
export async function archiveTicketChannel(
  channel: TextChannel,
  config: ResolvedGuildConfig,
): Promise<void> {
  const parent = await resolveCategory(channel.guild, config.archiveCategoryId);

  if (!parent) return;

  try {
    await channel.setParent(parent.id, { lockPermissions: false, reason: 'Ticket archived' });
  } catch (error) {
    log.warn({ channelId: channel.id, err: String(error) }, 'failed to move channel to archive');
  }
}

async function resolveCategory(
  guild: Guild,
  categoryId: string | undefined,
): Promise<CategoryChannel | null> {
  if (!categoryId) return null;

  try {
    const channel = await guild.channels.fetch(categoryId);
    if (channel?.type === ChannelType.GuildCategory) {
      return channel;
    }
    log.warn({ categoryId }, 'configured category id is not a category channel');
  } catch (error) {
    log.warn({ categoryId, err: String(error) }, 'configured category could not be fetched');
  }

  return null;
}
