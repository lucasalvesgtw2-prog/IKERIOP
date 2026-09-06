import { Client, DiscordAPIError, GatewayIntentBits, Options, Partials } from 'discord.js';
import { getEnv } from '../config/env.js';
import { ConfigurationError } from '../core/errors.js';
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

/**
 * Logs in, turning the two failures an operator actually hits into messages
 * that say what to do. discord.js reports a rejected token as a bare
 * `DiscordAPIError[undefined]: No Description`, and a blocked network as an
 * opaque fetch failure — neither of which tells anyone where to look.
 */
export async function loginDiscordClient(client: Client): Promise<void> {
  const env = getEnv();

  try {
    await client.login(env.DISCORD_BOT_TOKEN);
  } catch (error) {
    throw new ConfigurationError(describeLoginFailure(error), {
      // Never the token itself — only whether one was present and its shape.
      tokenLength: env.DISCORD_BOT_TOKEN.length,
    });
  }

  log.info({ user: client.user?.tag }, 'discord client logged in');
}

function describeLoginFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/disallowed intents/i.test(message)) {
    return [
      'Discord rejected the requested gateway intents.',
      'Enable the SERVER MEMBERS INTENT for this application at',
      'https://discord.com/developers/applications → your app → Bot → Privileged Gateway Intents.',
    ].join(' ');
  }

  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT/i.test(message)) {
    return [
      'Could not reach Discord.',
      "Check this machine's internet access, any proxy or firewall, and that",
      'discord.com is not blocked.',
      `(Underlying error: ${message})`,
    ].join(' ');
  }

  if (/401|unauthorized|invalid token/i.test(message)) {
    return [
      'Discord rejected the bot token.',
      'DISCORD_BOT_TOKEN must be the Bot token from',
      'Developers Portal → your app → Bot → Reset Token —',
      'not the application id and not the client secret.',
      `(Discord said: ${message})`,
    ].join(' ');
  }

  // discord.js reports a rejected token and a proxy that intercepts the
  // request identically: a DiscordAPIError with no usable description. Naming
  // only one cause would send an operator down the wrong path, so both are
  // listed rather than guessing.
  if (error instanceof DiscordAPIError) {
    return [
      `Discord refused the login (${message}).`,
      'The two usual causes are:',
      '(1) DISCORD_BOT_TOKEN is wrong — it must be the Bot token from',
      'Developers Portal → your app → Bot → Reset Token, not the application id',
      'or the client secret; or',
      '(2) something between this machine and discord.com is intercepting the',
      'request — a proxy, firewall or corporate network.',
    ].join(' ');
  }

  return `Discord login failed: ${message}`;
}
