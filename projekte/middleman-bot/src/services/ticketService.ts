import { type Deal, type PrismaClient, type Ticket } from '@prisma/client';
import { getEnv } from '../config/env.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { formatPublicDealId, formatTicketChannelName, newUuid } from '../core/ids.js';
import { createLogger } from '../core/logger.js';
import { holdsFunds, isTerminal, type DealState } from '../domain/deal/state.js';
import { writeAudit } from './auditService.js';
import { type ResolvedGuildConfig } from './configService.js';

const log = createLogger('ticket-service');

/**
 * How many tickets one user may have open at once. Escrow tickets are cheap to
 * open and expensive to staff, so this is the first line of anti-spam defence;
 * the interaction rate limiter is the second.
 */
export const MAX_OPEN_TICKETS_PER_USER = 3;

export interface TicketReservation {
  ticket: Ticket;
  deal: Deal;
  sequence: number;
  /** `middleman-0001` */
  channelName: string;
  /** `MM-0001` */
  publicDealId: string;
}

export interface ReserveTicketInput {
  guildId: string;
  discordId: string;
  username?: string | null;
  displayName?: string | null;
  config: ResolvedGuildConfig;
}

/**
 * Ticket lifecycle.
 *
 * Creating a ticket spans two systems, so it is deliberately split in two:
 *
 *   1. `reserve()` — one database transaction that allocates the sequence
 *      number and creates the Ticket and Deal rows with a placeholder channel
 *      id. Two simultaneous clicks cannot get the same number because the
 *      counter is incremented inside the transaction.
 *   2. `attachChannel()` — records the real channel id once Discord has
 *      created the channel.
 *
 * If step 2 never happens (Discord refused, the bot lost permissions) the
 * reservation is abandoned with `abandon()`, which leaves an auditable closed
 * ticket rather than a dangling row that looks open.
 */
export class TicketService {
  constructor(private readonly prisma: PrismaClient) {}

  async reserve(input: ReserveTicketInput): Promise<TicketReservation> {
    const expiresAt = new Date(Date.now() + hoursToMs(getEnv().DEAL_EXPIRY_HOURS));

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { discordId: input.discordId },
        update: {
          username: input.username ?? undefined,
          displayName: input.displayName ?? undefined,
        },
        create: {
          discordId: input.discordId,
          username: input.username ?? null,
          displayName: input.displayName ?? null,
        },
      });

      if (user.banned) {
        throw new ForbiddenError(
          `Banned user ${input.discordId} attempted to open a ticket`,
          'You are not allowed to use the middleman service. Please contact support.',
        );
      }

      const openTickets = await tx.ticket.count({
        where: { openedById: user.id, guildId: input.guildId, status: 'OPEN' },
      });

      if (openTickets >= MAX_OPEN_TICKETS_PER_USER) {
        throw new ConflictError(
          `User ${input.discordId} already has ${openTickets} open tickets`,
          `You already have ${openTickets} open ticket(s). Please finish or close one before opening another.`,
        );
      }

      // Incrementing inside the transaction is what makes the sequence safe
      // against concurrent clicks: the second one blocks on the row lock.
      const counter = await tx.ticketCounter.upsert({
        where: { guildId: input.guildId },
        update: { value: { increment: 1 } },
        create: { guildId: input.guildId, value: 1 },
      });

      const sequence = counter.value;
      const publicDealId = formatPublicDealId(sequence);
      const channelName = formatTicketChannelName(sequence);

      const ticket = await tx.ticket.create({
        data: {
          sequence,
          guildId: input.guildId,
          // Replaced by the real id in `attachChannel`. Unique so two
          // concurrent reservations cannot collide on the column.
          channelId: `pending:${newUuid()}`,
          status: 'OPEN',
          openedById: user.id,
        },
      });

      const deal = await tx.deal.create({
        data: {
          publicId: publicDealId,
          ticketId: ticket.id,
          guildId: input.guildId,
          creatorDiscordId: input.discordId,
          feePercentage: input.config.feePercentage.toString(),
          status: 'CREATED',
          expiresAt,
        },
      });

      return { ticket, deal, sequence, channelName, publicDealId };
    });
  }

  /** Records the Discord channel that was created for a reservation. */
  async attachChannel(
    reservation: TicketReservation,
    channelId: string,
    actorDiscordId: string,
  ): Promise<Ticket> {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: reservation.ticket.id },
        data: { channelId },
      });

      await writeAudit(tx, {
        action: 'TICKET_CREATED',
        dealId: reservation.deal.id,
        actorDiscordId,
        metadata: {
          publicDealId: reservation.publicDealId,
          sequence: reservation.sequence,
          channelId,
        },
      });

      return ticket;
    });
  }

  /**
   * Marks a reservation as dead after Discord refused to create the channel.
   * The sequence number is intentionally not reused: a gap in ticket numbers
   * is harmless, a reused number is confusing in an audit trail.
   */
  async abandon(reservation: TicketReservation, reason: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.deal.update({
          where: { id: reservation.deal.id },
          data: { status: 'FAILED' },
        });
        await tx.ticket.update({
          where: { id: reservation.ticket.id },
          data: { status: 'CLOSED', closedAt: new Date(), closeReason: reason },
        });
      });
    } catch (error) {
      log.error(
        { ticketId: reservation.ticket.id, err: String(error) },
        'failed to abandon ticket reservation',
      );
    }
  }

  async findByChannelId(channelId: string): Promise<(Ticket & { deal: Deal | null }) | null> {
    return this.prisma.ticket.findUnique({
      where: { channelId },
      include: { deal: true },
    });
  }

  async requireByChannelId(channelId: string): Promise<Ticket & { deal: Deal }> {
    const ticket = await this.findByChannelId(channelId);

    if (!ticket || !ticket.deal) {
      throw new NotFoundError(`No ticket for channel ${channelId}`, { channelId });
    }

    return { ...ticket, deal: ticket.deal };
  }

  /**
   * Decides whether a close request may proceed.
   *
   * A ticket holding escrowed funds is never closed by a participant — the
   * money has to be resolved first, and only staff can decide how.
   */
  assertClosable(status: DealState, actorIsStaff: boolean): void {
    if (actorIsStaff) return;

    if (holdsFunds(status)) {
      throw new ForbiddenError(
        `Non-staff attempted to close a funded deal in ${status}`,
        'This deal is holding funds and cannot be closed by a participant. Please contact support.',
        { status },
      );
    }
  }

  /**
   * Closes a ticket and cancels its deal when the deal has not progressed past
   * the point where cancelling is safe. Idempotent: closing an already closed
   * ticket is a no-op rather than an error, so a double click is harmless.
   */
  async close(input: {
    ticketId: string;
    dealId: string;
    actorDiscordId: string;
    reason: string;
  }): Promise<{ alreadyClosed: boolean; dealCancelled: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });

      if (!ticket) {
        throw new NotFoundError(`Ticket ${input.ticketId} not found`);
      }

      if (ticket.status !== 'OPEN') {
        return { alreadyClosed: true, dealCancelled: false };
      }

      const deal = await tx.deal.findUnique({ where: { id: input.dealId } });

      if (!deal) {
        throw new NotFoundError(`Deal ${input.dealId} not found`);
      }

      let dealCancelled = false;
      // Captured before the update: every later reference must describe the
      // state the deal was in when this close was decided, not after it.
      const previousStatus = deal.status;
      const status = previousStatus as DealState;

      // A deal that already ended keeps its outcome; only a live, unfunded
      // deal is cancelled by closing its ticket.
      if (!isTerminal(status) && !holdsFunds(status)) {
        const updated = await tx.deal.updateMany({
          where: { id: deal.id, status: previousStatus },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        });

        if (updated.count === 0) {
          throw new ConflictError(
            `Deal ${deal.id} changed state during close`,
            'The deal changed while you were closing it. Please check the latest message.',
          );
        }

        dealCancelled = true;
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: input.actorDiscordId,
          closeReason: input.reason,
        },
      });

      if (dealCancelled) {
        await tx.stateTransition.create({
          data: {
            dealId: deal.id,
            fromStatus: previousStatus,
            toStatus: 'CANCELLED',
            reason: input.reason,
            actorDiscordId: input.actorDiscordId,
          },
        });
      }

      await writeAudit(tx, {
        action: 'TICKET_CLOSED',
        dealId: deal.id,
        actorDiscordId: input.actorDiscordId,
        metadata: { reason: input.reason, previousStatus, dealCancelled },
      });

      return { alreadyClosed: false, dealCancelled };
    });
  }

  async markArchived(ticketId: string, dealId: string | null): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });

    await writeAudit(this.prisma, {
      action: 'TICKET_ARCHIVED',
      dealId,
      metadata: { ticketId },
    });
  }
}

function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}
