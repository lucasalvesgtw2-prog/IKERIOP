import { type BotCommand } from './types.js';
import { setupCommand } from './setup.js';
import { ticketCommand } from './ticket.js';
import { dealCommand } from './deal.js';
import { adminCommand } from './admin.js';

/** Every slash command the bot exposes, keyed by name. */
export const commandList: BotCommand[] = [setupCommand, ticketCommand, dealCommand, adminCommand];

export const commands: ReadonlyMap<string, BotCommand> = new Map(
  commandList.map((command) => [command.name, command]),
);

export { type BotCommand };
