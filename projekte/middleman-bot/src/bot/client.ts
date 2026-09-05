import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';
import { getEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('discord');

/**
 * Discord gateway client.
 *
 * Intents are kept to the minimum the escrow flow needs. In particular
 * MessageContent is NOT requested: the bot is driven entirely by slash
 * commands and components, so it never needs to read message bodies.
 */
export function createDiscordClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel],
    // The bot reads members and channels on demand; large caches are pure
    // memory cost for a ticket workload.
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 50,
      PresenceManager: 0,
      GuildMemberManager: 200,
    }),
    failIfNotExists: false,
  });

  client.on('error', (error) => log.error({ err: error.message }, 'discord client error'));
  client.on('warn', (message) => log.warn({ message }, 'discord client warning'));
  client.on('shardDisconnect', (_event, shardId) =>
    log.warn({ shardId }, 'discord shard disconnected'),
  );
  client.on('shardReconnecting', (shardId) => log.info({ shardId }, 'discord shard reconnecting'));

  return client;
}

export async function loginDiscordClient(client: Client): Promise<void> {
  const env = getEnv();
  await client.login(env.DISCORD_BOT_TOKEN);
  log.info({ user: client.user?.tag }, 'discord client logged in');
}
