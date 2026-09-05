import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { replyPrivate } from '../interactions/respond.js';
import { buildSetupPanel } from '../components/ticketPanels.js';
import { type InteractionContext } from '../interactions/context.js';
import { type BotCommand } from './types.js';

/**
 * `/ticket` — an accessible alternative to the public panel button.
 *
 * It deliberately does not create the ticket directly: it hands the user the
 * same button, so there is exactly one code path that opens a ticket and
 * exactly one place where the rate limit and the checks apply.
 */
const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Open a new middleman ticket.')
  .setDMPermission(false);

export const ticketCommand: BotCommand = {
  name: 'ticket',
  data: data.toJSON(),

  async execute(interaction: ChatInputCommandInteraction, ctx: InteractionContext): Promise<void> {
    void ctx;
    const panel = buildSetupPanel();

    await replyPrivate(interaction, {
      content: 'Click the button below to open your ticket.',
      components: panel.components,
    });
  },
};
