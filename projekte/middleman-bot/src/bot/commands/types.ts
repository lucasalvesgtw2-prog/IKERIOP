import {
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { type InteractionContext } from '../interactions/context.js';

export interface BotCommand {
  name: string;
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction, ctx: InteractionContext): Promise<void>;
}
