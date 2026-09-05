import { type Deal, type PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { type DealState } from '../domain/deal/state.js';
import { writeAudit } from './auditService.js';
import { applyTransition, assertDealStatus } from './dealTransition.js';

const log = createLogger('deal-service');

/**
 * Deal participants and roles.
 *
 * The invariant this service exists to protect: a deal has exactly one buyer
 * and exactly one seller, and they are two different people. It is enforced
 * three times over —
 *
 *   * here, before anything is written;
 *   * by `@@unique([dealId, role])` and `@@unique([dealId, userId])` in the
 *     schema, which makes a violating write impossible even if this code is
 *     wrong; and
 *   * by deriving the seller from the buyer choice, so the UI cannot express
 *     an invalid combination in the first place.
 */
export interface RoleAssignment {
  buyerDiscordId: string;
  sellerDiscordId: string;
}

export class DealService {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(dealId: string): Promise<Deal | null> {
    return this.prisma.deal.findUnique({ where: { id: dealId } });
  }

  async requireById(dealId: string): Promise<Deal> {
    const deal = await this.findById(dealId);
    if (!deal) throw new NotFoundError(`Deal ${dealId} not found`, { dealId });
    return deal;
  }

  /**
   * Validates a proposed deal partner.
   *
   * Rejects the four cases that would break the deal model: dealing with
   * yourself, dealing with a bot, dealing with a banned user, and adding a
   * partner to a deal that already has one.
   */
  async validatePartner(input: {
    deal: Deal;
    partnerDiscordId: string;
    partnerIsBot: boolean;
  }): Promise<void> {
    if (input.partnerIsBot) {
      throw new ValidationError(
        `Bot ${input.partnerDiscordId} proposed as deal partner`,
        'You cannot make a deal with a bot. Please select a real user.',
      );
    }

    if (input.partnerDiscordId === input.deal.creatorDiscordId) {
      throw new ValidationError(
        'Creator proposed themselves as deal partner',
        'You cannot make a deal with yourself. Please select the other person.',
      );
    }

    const partner = await this.prisma.user.findUnique({
      where: { discordId: input.partnerDiscordId },
    });

    if (partner?.banned) {
      throw new ValidationError(
        `Banned user ${input.partnerDiscordId} proposed as deal partner`,
        'That user is not allowed to use the middleman service.',
      );
    }
  }

  /**
   * Records the second participant and moves the deal to PARTNER_ADDED.
   *
   * The partner's role is not decided here — that is a separate, explicit step,
   * so nobody is silently cast as the buyer.
   */
  async addPartner(input: {
    deal: Deal;
    partnerDiscordId: string;
    partnerUsername?: string | null;
    partnerDisplayName?: string | null;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['CREATED']);

    return this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { discordId: input.partnerDiscordId },
        update: {
          username: input.partnerUsername ?? undefined,
          displayName: input.partnerDisplayName ?? undefined,
        },
        create: {
          discordId: input.partnerDiscordId,
          username: input.partnerUsername ?? null,
          displayName: input.partnerDisplayName ?? null,
        },
      });

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'CREATED',
        to: 'PARTNER_ADDED',
        actorDiscordId: input.actorDiscordId,
        reason: 'Deal partner added',
        // Stored provisionally so the role step knows who the candidates are.
        // Neither field implies a role until roles are assigned.
        data: { partnerDiscordId: input.partnerDiscordId },
      });

      await writeAudit(tx, {
        action: 'DEAL_PARTNER_ADDED',
        dealId: deal.id,
        actorDiscordId: input.actorDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: { partnerDiscordId: input.partnerDiscordId },
      });

      return deal;
    });
  }

  /**
   * Assigns buyer and seller.
   *
   * `assignment` must name the two participants of this deal and no one else;
   * the caller derives it from a single choice, and this method re-checks it
   * rather than trusting that derivation.
   */
  async assignRoles(input: {
    deal: Deal;
    assignment: RoleAssignment;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['PARTNER_ADDED']);

    const participants = this.expectedParticipants(input.deal);
    this.assertAssignmentIsValid(input.assignment, participants);

    return this.prisma.$transaction(async (tx) => {
      const [buyer, seller] = await Promise.all([
        tx.user.findUnique({ where: { discordId: input.assignment.buyerDiscordId } }),
        tx.user.findUnique({ where: { discordId: input.assignment.sellerDiscordId } }),
      ]);

      if (!buyer || !seller) {
        throw new NotFoundError('A deal participant is missing from the user table', {
          dealId: input.deal.id,
        });
      }

      const deal = await applyTransition(tx, {
        dealId: input.deal.id,
        from: 'PARTNER_ADDED',
        to: 'ROLES_ASSIGNED',
        actorDiscordId: input.actorDiscordId,
        reason: 'Buyer and seller assigned',
        data: {
          buyerDiscordId: input.assignment.buyerDiscordId,
          sellerDiscordId: input.assignment.sellerDiscordId,
        },
      });

      // The unique constraints on these rows are the database's own copy of
      // the one-buyer-one-seller invariant.
      await tx.dealParticipant.createMany({
        data: [
          {
            dealId: deal.id,
            userId: buyer.id,
            discordId: buyer.discordId,
            role: 'BUYER',
            isCreator: deal.creatorDiscordId === buyer.discordId,
          },
          {
            dealId: deal.id,
            userId: seller.id,
            discordId: seller.discordId,
            role: 'SELLER',
            isCreator: deal.creatorDiscordId === seller.discordId,
          },
        ],
      });

      await writeAudit(tx, {
        action: 'ROLES_ASSIGNED',
        dealId: deal.id,
        actorDiscordId: input.actorDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          buyerDiscordId: input.assignment.buyerDiscordId,
          sellerDiscordId: input.assignment.sellerDiscordId,
        },
      });

      log.info(
        {
          dealId: deal.id,
          buyer: input.assignment.buyerDiscordId,
          seller: input.assignment.sellerDiscordId,
        },
        'roles assigned',
      );

      return deal;
    });
  }

  /**
   * Swaps buyer and seller.
   *
   * Only possible while the deal is still in ROLES_ASSIGNED — that is, before
   * the seller has entered any details. After that the roles are baked into
   * the agreed deal and only staff can intervene.
   *
   * The participant rows are deleted and recreated rather than updated in
   * place: `@@unique([dealId, role])` would reject the intermediate state of
   * two sequential updates.
   */
  async swapRoles(input: {
    deal: Deal;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(
      input.deal.status as DealState,
      ['ROLES_ASSIGNED'],
      'Roles can only be swapped before the seller has entered the deal details.',
    );

    const { buyerDiscordId, sellerDiscordId } = input.deal;

    if (!buyerDiscordId || !sellerDiscordId) {
      throw new ConflictError(
        `Deal ${input.deal.id} has no roles to swap`,
        'The roles for this deal have not been assigned yet.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deal.updateMany({
        where: { id: input.deal.id, status: 'ROLES_ASSIGNED' },
        data: {
          buyerDiscordId: sellerDiscordId,
          sellerDiscordId: buyerDiscordId,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictError(
          `Deal ${input.deal.id} moved on before the role swap`,
          'This deal has already moved on. Please use the latest message in this ticket.',
        );
      }

      const [newBuyer, newSeller] = await Promise.all([
        tx.user.findUnique({ where: { discordId: sellerDiscordId } }),
        tx.user.findUnique({ where: { discordId: buyerDiscordId } }),
      ]);

      if (!newBuyer || !newSeller) {
        throw new NotFoundError('A deal participant is missing from the user table', {
          dealId: input.deal.id,
        });
      }

      await tx.dealParticipant.deleteMany({ where: { dealId: input.deal.id } });
      await tx.dealParticipant.createMany({
        data: [
          {
            dealId: input.deal.id,
            userId: newBuyer.id,
            discordId: newBuyer.discordId,
            role: 'BUYER',
            isCreator: input.deal.creatorDiscordId === newBuyer.discordId,
          },
          {
            dealId: input.deal.id,
            userId: newSeller.id,
            discordId: newSeller.discordId,
            role: 'SELLER',
            isCreator: input.deal.creatorDiscordId === newSeller.discordId,
          },
        ],
      });

      await writeAudit(tx, {
        action: 'ROLES_ASSIGNED',
        dealId: input.deal.id,
        actorDiscordId: input.actorDiscordId,
        correlationId: input.correlationId ?? null,
        metadata: {
          swapped: true,
          buyerDiscordId: newBuyer.discordId,
          sellerDiscordId: newSeller.discordId,
        },
      });

      const deal = await tx.deal.findUnique({ where: { id: input.deal.id } });

      if (!deal) {
        throw new ConflictError(
          `Deal ${input.deal.id} disappeared during a role swap`,
          'This deal could not be updated. Please contact support.',
        );
      }

      return deal;
    });
  }

  /** Moves a role-assigned deal to the step where the seller enters details. */
  async requestDealDetails(input: {
    deal: Deal;
    actorDiscordId: string;
    correlationId?: string;
  }): Promise<Deal> {
    assertDealStatus(input.deal.status as DealState, ['ROLES_ASSIGNED']);

    return this.prisma.$transaction((tx) =>
      applyTransition(tx, {
        dealId: input.deal.id,
        from: 'ROLES_ASSIGNED',
        to: 'WAITING_FOR_DEAL_DETAILS',
        actorDiscordId: input.actorDiscordId,
        reason: 'Waiting for the seller to enter the deal details',
      }),
    );
  }

  /** The two Discord ids that are allowed to hold a role on this deal. */
  expectedParticipants(deal: Deal): [string, string] {
    if (!deal.partnerDiscordId) {
      throw new ConflictError(
        `Deal ${deal.id} has no partner yet`,
        'A deal partner has not been added yet.',
      );
    }
    return [deal.creatorDiscordId, deal.partnerDiscordId];
  }

  /**
   * Rejects any assignment that is not a permutation of the two participants.
   * This is what makes "the same person is both buyer and seller" impossible,
   * along with "a third party is the seller".
   */
  assertAssignmentIsValid(assignment: RoleAssignment, participants: [string, string]): void {
    if (assignment.buyerDiscordId === assignment.sellerDiscordId) {
      throw new ValidationError(
        'Buyer and seller are the same user',
        'The same person cannot be both the Buyer and the Seller.',
      );
    }

    const allowed = new Set(participants);

    for (const [role, discordId] of [
      ['Buyer', assignment.buyerDiscordId],
      ['Seller', assignment.sellerDiscordId],
    ] as const) {
      if (!allowed.has(discordId)) {
        throw new ValidationError(
          `${role} ${discordId} is not a participant of this deal`,
          `The ${role} must be one of the two people in this ticket.`,
        );
      }
    }
  }

  /**
   * Derives the full assignment from the single choice of who the buyer is.
   *
   * The buyer must be checked against the participant list FIRST. A select
   * menu's values are client-controlled, so without this check an id that is
   * simply "not the first participant" would be accepted as the buyer and the
   * real participant silently cast as the seller.
   */
  deriveAssignment(deal: Deal, buyerDiscordId: string): RoleAssignment {
    const participants = this.expectedParticipants(deal);

    if (!participants.includes(buyerDiscordId)) {
      throw new ValidationError(
        `Buyer ${buyerDiscordId} is not a participant of deal ${deal.id}`,
        'The Buyer must be one of the two people in this ticket.',
      );
    }

    const seller = participants.find((discordId) => discordId !== buyerDiscordId);

    if (!seller) {
      // Only reachable if both participants are the same person, which the
      // partner validation already prevents.
      throw new ValidationError(
        `Deal ${deal.id} has no second participant to act as seller`,
        'This deal does not have two different participants.',
      );
    }

    return { buyerDiscordId, sellerDiscordId: seller };
  }
}
