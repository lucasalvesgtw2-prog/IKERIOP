import { type BotCommand } from './types.js';
import { setupCommand } from './setup.js';
import { ticketCommand } from './ticket.js';

/** Every slash command the bot exposes, keyed by name. */
export const commandList: BotCommand[] = [setupCommand, ticketCommand];

export const commands: ReadonlyMap<string, BotCommand> = new Map(
  commandList.map((command) => [command.name, command]),
);

export { type BotCommand };
