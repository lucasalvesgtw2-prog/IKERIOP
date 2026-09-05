import { type Client, type Guild, type GuildMember } from 'discord.js';
import { type PrismaClient } from '@prisma/client';
import { type Redis } from 'ioredis';
import { ConfigService, type ResolvedGuildConfig } from '../../services/configService.js';
import { TicketService } from '../../services/ticketService.js';
import { newUuid } from '../../core/ids.js';

/**
 * Everything a handler is allowed to touch.
 *
 * Handlers receive this instead of reaching for module-level singletons, which
 * is what lets them be exercised in tests with stubs.
 */
export interface BotContext {
  client: Client;
  prisma: PrismaClient;
  redis: Redis;
  config: ConfigService;
  tickets: TicketService;
}

export function createBotContext(params: {
  client: Client;
  prisma: PrismaClient;
  redis: Redis;
}): BotContext {
  return {
    client: params.client,
    prisma: params.prisma,
    redis: params.redis,
    config: new ConfigService(params.prisma),
    tickets: new TicketService(params.prisma),
  };
}

/** Per-interaction state, so every log line and audit row can be correlated. */
export interface InteractionContext {
  bot: BotContext;
  guild: Guild;
  member: GuildMember;
  guildConfig: ResolvedGuildConfig;
  /** Ties together every log and audit row written for this interaction. */
  correlationId: string;
}

export function newCorrelationId(): string {
  return newUuid();
}
