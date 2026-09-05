import { type Deal, type DealStatus, type Prisma } from '@prisma/client';
import { ConflictError } from '../core/errors.js';
import { assertTransition, type DealState } from '../domain/deal/state.js';

/**
 * The single way a deal's state is allowed to change.
 *
 * Two layers guard every transition:
 *
 *  1. `assertTransition` rejects anything the state machine does not permit.
 *  2. The write is `UPDATE ... WHERE id = ? AND status = <expected>`, so if a
 *     concurrent interaction moved the deal in between the read and the write,
 *     zero rows match and the loser gets a `ConflictError` instead of silently
 *     overwriting the winner.
 *
 * Every accepted transition also appends a `StateTransition` row, so the full
 * history of a deal is reconstructable regardless of what the current row says.
 */

/** The subset of the Prisma client this helper needs, so it runs in a transaction. */
export type TransitionClient = Pick<Prisma.TransactionClient, 'deal' | 'stateTransition'>;

export interface TransitionInput {
  dealId: string;
  /** The status the caller believes the deal is in. */
  from: DealState;
  to: DealState;
  actorDiscordId?: string | null;
  reason?: string | null;
  /** Extra columns to write atomically with the state change. */
  data?: Prisma.DealUpdateInput;
}

export async function applyTransition(tx: TransitionClient, input: TransitionInput): Promise<Deal> {
  assertTransition(input.from, input.to);

  const updated = await tx.deal.updateMany({
    where: { id: input.dealId, status: input.from as DealStatus },
    data: {
      ...(input.data as Prisma.DealUpdateManyMutationInput | undefined),
      status: input.to as DealStatus,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError(
      `Deal ${input.dealId} was not in ${input.from} when transitioning to ${input.to}`,
      'This deal has already moved on. Please use the latest message in this ticket.',
      { dealId: input.dealId, from: input.from, to: input.to },
    );
  }

  await tx.stateTransition.create({
    data: {
      dealId: input.dealId,
      fromStatus: input.from as DealStatus,
      toStatus: input.to as DealStatus,
      reason: input.reason ?? null,
      actorDiscordId: input.actorDiscordId ?? null,
    },
  });

  const deal = await tx.deal.findUnique({ where: { id: input.dealId } });

  if (!deal) {
    // Unreachable: the guarded update above matched this row inside the same
    // transaction. Treated as a conflict rather than a crash.
    throw new ConflictError(
      `Deal ${input.dealId} disappeared during a transition`,
      'This deal could not be updated. Please contact support.',
    );
  }

  return deal;
}

/**
 * Asserts the deal is in one of the expected states before an action runs.
 *
 * Used by interaction handlers as an early, cheap rejection so a stale button
 * produces a clear message rather than a confusing conflict later.
 */
export function assertDealStatus(
  actual: DealState,
  expected: readonly DealState[],
  userMessage = 'This action is not available at the current stage of the deal.',
): void {
  if (!expected.includes(actual)) {
    throw new ConflictError(
      `Deal is in ${actual}, expected one of ${expected.join(', ')}`,
      userMessage,
      { actual, expected },
    );
  }
}
