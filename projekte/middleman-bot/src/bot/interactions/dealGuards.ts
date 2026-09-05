import { ChannelType, type Interaction, type TextChannel } from 'discord.js';
import { type Deal, type Ticket } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { isFreshNonce } from './customId.js';
import { readRenderNonce } from './renderNonce.js';
import { type InteractionContext } from './context.js';

/**
 * The checks every deal-bound interaction runs before anything happens.
 *
 * The channel is the authority on which deal an interaction is about — not the
 * custom id — so a component carried into another channel cannot reach a deal
 * it does not belong to. The id's target is then cross-checked, and the nonce
 * is checked for freshness, which is what makes an old button inert.
 */
export interface LoadedDeal {
  ticket: Ticket;
  deal: Deal;
  channel: TextChannel;
}

export async function loadDealForInteraction(
  interaction: Interaction,
  ctx: InteractionContext,
): Promise<LoadedDeal> {
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    throw new NotFoundError('Interaction did not happen in a ticket text channel');
  }

  const ticket = await ctx.bot.tickets.requireByChannelId(interaction.channel.id);

  return { ticket, deal: ticket.deal, channel: interaction.channel };
}

/**
 * Rejects a component whose target does not match the deal in this channel.
 *
 * Reaching this is only possible with a hand-crafted interaction, so it is
 * treated as a hard mismatch rather than a routine staleness message.
 */
export function assertTargetMatches(deal: Deal, target: string): void {
  if (target !== '-' && target !== deal.publicId) {
    throw new ConflictError(
      `Component target ${target} does not match deal ${deal.publicId}`,
      'This message does not belong to the deal in this ticket.',
      { target, publicId: deal.publicId },
    );
  }
}

/**
 * Rejects a click on a panel that has since been re-rendered.
 *
 * A cache miss counts as stale: the safe failure is asking the user to use the
 * newest message, never accepting a click whose freshness cannot be shown.
 */
export async function assertFreshNonce(
  ctx: InteractionContext,
  deal: Deal,
  received: string,
): Promise<void> {
  const expected = await readRenderNonce(ctx.bot.redis, deal.id);

  if (!isFreshNonce(received, expected)) {
    throw new ConflictError(
      `Stale nonce for deal ${deal.id}`,
      '⚠️ This message is out of date. Please use the latest message in this ticket.',
      { dealId: deal.id },
    );
  }
}
