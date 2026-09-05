import { REST, Routes } from 'discord.js';
import { getEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { commandList } from './commands/index.js';

/**
 * Registers the slash commands with Discord.
 *
 * Guild-scoped registration is used deliberately: guild commands appear
 * immediately, while global commands can take up to an hour to propagate.
 */
export async function registerCommands(): Promise<void> {
  const env = getEnv();
  const log = createLogger('register-commands');

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
  const body = commandList.map((command) => command.data);

  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body,
  });

  log.info(
    { count: body.length, guildId: env.DISCORD_GUILD_ID, commands: body.map((c) => c.name) },
    'slash commands registered',
  );
}

/** Allows `npm run commands:register` to run this file directly. */
const invokedDirectly = process.argv[1]?.includes('registerCommands');

if (invokedDirectly) {
  registerCommands()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      process.stderr.write(`Failed to register commands: ${String(error)}\n`);
      process.exit(1);
    });
}
