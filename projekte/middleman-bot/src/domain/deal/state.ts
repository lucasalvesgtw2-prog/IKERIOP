import { InvalidStateError } from '../../core/errors.js';

/**
 * The authoritative deal state machine.
 *
 * Every state change goes through `assertTransition` inside a database
 * transaction with the previous state as an optimistic-concurrency guard
 * (`UPDATE ... WHERE id = $1 AND status = $2`). A Discord interaction can only
 * *request* a transition; it can never assert one.
 */
export const DEAL_STATES = [
  'CREATED',
  'PARTNER_ADDED',
  'ROLES_ASSIGNED',
  'WAITING_FOR_DEAL_DETAILS',
  'WAITING_FOR_BUYER_APPROVAL',
  'BUYER_APPROVED',
  'CURRENCY_SELECTION',
  'PAYMENT_REQUEST_CREATED',
  'AWAITING_PAYMENT',
  'PAYMENT_DETECTED',
  'PAYMENT_CONFIRMING',
  'PAYMENT_CONFIRMED',
  'DEAL_IN_PROGRESS',
  'WAITING_FOR_COMPLETION_CONFIRMATIONS',
  'BUYER_COMPLETED',
  'SELLER_COMPLETED',
  'READY_FOR_PAYOUT_ADDRESS',
  'PAYOUT_ADDRESS_SUBMITTED',
  'PAYOUT_REVIEW',
  'PAYOUT_PENDING',
  'PAYOUT_BROADCAST',
  'PAYOUT_CONFIRMING',
  'PAYOUT_CONFIRMED',
  'WAITING_FOR_SELLER_RECEIPT',
  'PAYOUT_REVIEW_REQUIRED',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
] as const;

export type DealState = (typeof DEAL_STATES)[number];

export const DEAL_STATE_SET: ReadonlySet<string> = new Set(DEAL_STATES);

export function isDealState(value: string): value is DealState {
  return DEAL_STATE_SET.has(value);
}

/**
 * Terminal states. Nothing leaves them except an explicit staff action, which
 * is modelled as its own transition below (dispute resolution).
 */
export const TERMINAL_STATES: ReadonlySet<DealState> = new Set<DealState>([
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
]);

/**
 * States in which escrowed funds are held by the service. Reaching one of
 * these means a cancellation can no longer be a simple "close the ticket" —
 * it requires staff involvement.
 */
export const FUNDS_HELD_STATES: ReadonlySet<DealState> = new Set<DealState>([
  'PAYMENT_CONFIRMED',
  'DEAL_IN_PROGRESS',
  'WAITING_FOR_COMPLETION_CONFIRMATIONS',
  'BUYER_COMPLETED',
  'SELLER_COMPLETED',
  'READY_FOR_PAYOUT_ADDRESS',
  'PAYOUT_ADDRESS_SUBMITTED',
  'PAYOUT_REVIEW',
  'PAYOUT_PENDING',
  'DISPUTED',
  'PAYOUT_REVIEW_REQUIRED',
]);

/**
 * States from which a dispute may be opened. A dispute is only meaningful once
 * money is actually in escrow — before payment confirmation the parties can
 * simply cancel.
 */
export const DISPUTABLE_STATES: ReadonlySet<DealState> = new Set<DealState>([
  'PAYMENT_CONFIRMED',
  'DEAL_IN_PROGRESS',
  'WAITING_FOR_COMPLETION_CONFIRMATIONS',
  'BUYER_COMPLETED',
  'SELLER_COMPLETED',
  'READY_FOR_PAYOUT_ADDRESS',
  'PAYOUT_ADDRESS_SUBMITTED',
  'PAYOUT_REVIEW',
  'WAITING_FOR_SELLER_RECEIPT',
  'PAYOUT_REVIEW_REQUIRED',
]);

/**
 * Once a payout transaction may exist on-chain, a dispute must NOT rewind the
 * deal into a state that could produce a second payout. These states are
 * therefore excluded from `DISPUTABLE_STATES` above and guarded again here.
 */
export const PAYOUT_IN_FLIGHT_STATES: ReadonlySet<DealState> = new Set<DealState>([
  'PAYOUT_PENDING',
  'PAYOUT_BROADCAST',
  'PAYOUT_CONFIRMING',
  'PAYOUT_CONFIRMED',
]);

/**
 * States from which a deal may be cancelled by a participant without staff.
 * Deliberately stops at AWAITING_PAYMENT: after that, funds may be in flight.
 */
export const USER_CANCELLABLE_STATES: ReadonlySet<DealState> = new Set<DealState>([
  'CREATED',
  'PARTNER_ADDED',
  'ROLES_ASSIGNED',
  'WAITING_FOR_DEAL_DETAILS',
  'WAITING_FOR_BUYER_APPROVAL',
  'BUYER_APPROVED',
  'CURRENCY_SELECTION',
  'PAYMENT_REQUEST_CREATED',
  'AWAITING_PAYMENT',
]);

/**
 * States from which the expiry worker may expire a deal. Never includes a
 * state where funds are held — those escalate to staff instead.
 */
export const EXPIRABLE_STATES: ReadonlySet<DealState> = USER_CANCELLABLE_STATES;

/** The allowed forward transitions. Anything not listed here is rejected. */
const BASE_TRANSITIONS: Readonly<Record<DealState, readonly DealState[]>> = {
  CREATED: ['PARTNER_ADDED'],
  PARTNER_ADDED: ['ROLES_ASSIGNED'],
  ROLES_ASSIGNED: ['WAITING_FOR_DEAL_DETAILS'],
  WAITING_FOR_DEAL_DETAILS: ['WAITING_FOR_BUYER_APPROVAL'],
  // "Request changes" sends the deal back for a new set of details.
  WAITING_FOR_BUYER_APPROVAL: ['BUYER_APPROVED', 'WAITING_FOR_DEAL_DETAILS'],
  BUYER_APPROVED: ['CURRENCY_SELECTION'],
  // Both currencies must be chosen before a payment request is created.
  CURRENCY_SELECTION: ['PAYMENT_REQUEST_CREATED'],
  PAYMENT_REQUEST_CREATED: ['AWAITING_PAYMENT'],
  // A quote can expire before any payment shows up; the buyer re-quotes.
  AWAITING_PAYMENT: ['PAYMENT_DETECTED', 'PAYMENT_REQUEST_CREATED'],
  PAYMENT_DETECTED: ['PAYMENT_CONFIRMING'],
  PAYMENT_CONFIRMING: ['PAYMENT_CONFIRMED'],
  PAYMENT_CONFIRMED: ['DEAL_IN_PROGRESS'],
  DEAL_IN_PROGRESS: ['WAITING_FOR_COMPLETION_CONFIRMATIONS'],
  WAITING_FOR_COMPLETION_CONFIRMATIONS: ['BUYER_COMPLETED', 'SELLER_COMPLETED'],
  // Whoever confirms first parks in their own state; the second confirmation
  // moves the deal on. Order does not matter.
  BUYER_COMPLETED: ['READY_FOR_PAYOUT_ADDRESS'],
  SELLER_COMPLETED: ['READY_FOR_PAYOUT_ADDRESS'],
  READY_FOR_PAYOUT_ADDRESS: ['PAYOUT_ADDRESS_SUBMITTED'],
  // A rejected address sends the seller back to the address prompt.
  PAYOUT_ADDRESS_SUBMITTED: ['PAYOUT_REVIEW', 'READY_FOR_PAYOUT_ADDRESS'],
  // Staff either authorises the payout or rejects it back to the address step.
  PAYOUT_REVIEW: ['PAYOUT_PENDING', 'READY_FOR_PAYOUT_ADDRESS'],
  // PAYOUT_PENDING -> FAILED covers a signer that refused *before* broadcast.
  PAYOUT_PENDING: ['PAYOUT_BROADCAST', 'FAILED'],
  PAYOUT_BROADCAST: ['PAYOUT_CONFIRMING'],
  PAYOUT_CONFIRMING: ['PAYOUT_CONFIRMED', 'PAYOUT_REVIEW_REQUIRED'],
  PAYOUT_CONFIRMED: ['WAITING_FOR_SELLER_RECEIPT'],
  WAITING_FOR_SELLER_RECEIPT: ['COMPLETED', 'PAYOUT_REVIEW_REQUIRED'],
  // Only staff resolve a payout review; never an automatic re-payout.
  PAYOUT_REVIEW_REQUIRED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  DISPUTED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};

/**
 * Transitions that are legal from many states and are therefore modelled as
 * rules rather than as edges in the table above.
 */
function isSpecialTransition(from: DealState, to: DealState): boolean {
  // A dispute freezes the deal wherever it is — but never while a payout is
  // in flight, because unfreezing must not be able to produce a second payout.
  if (to === 'DISPUTED') {
    return DISPUTABLE_STATES.has(from);
  }

  // Staff resolving a dispute returns the deal to the payout track or ends it.
  if (from === 'DISPUTED') {
    return (
      to === 'READY_FOR_PAYOUT_ADDRESS' ||
      to === 'PAYOUT_REVIEW' ||
      to === 'COMPLETED' ||
      to === 'CANCELLED' ||
      to === 'FAILED'
    );
  }

  if (to === 'CANCELLED') {
    return USER_CANCELLABLE_STATES.has(from);
  }

  if (to === 'EXPIRED') {
    return EXPIRABLE_STATES.has(from);
  }

  // A hard failure is always reachable from a non-terminal state that is not
  // holding a broadcast payout — a broadcast payout must be reconciled first.
  if (to === 'FAILED') {
    return !TERMINAL_STATES.has(from) && !PAYOUT_IN_FLIGHT_STATES.has(from);
  }

  return false;
}

export function canTransition(from: DealState, to: DealState): boolean {
  if (from === to) return false;
  if (TERMINAL_STATES.has(from)) return false;
  if (BASE_TRANSITIONS[from].includes(to)) return true;
  return isSpecialTransition(from, to);
}

/** Every state reachable from `from` in exactly one step. */
export function allowedTransitions(from: DealState): DealState[] {
  return DEAL_STATES.filter((to) => canTransition(from, to));
}

export function assertTransition(from: DealState, to: DealState): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateError(
      `Illegal deal state transition ${from} -> ${to}`,
      'This action is not available at the current stage of the deal.',
      { from, to },
    );
  }
}

export function isTerminal(state: DealState): boolean {
  return TERMINAL_STATES.has(state);
}

export function holdsFunds(state: DealState): boolean {
  return FUNDS_HELD_STATES.has(state);
}

export function isPayoutInFlight(state: DealState): boolean {
  return PAYOUT_IN_FLIGHT_STATES.has(state);
}

/** Human-readable label used in embeds. */
export const DEAL_STATE_LABELS: Readonly<Record<DealState, string>> = {
  CREATED: 'Ticket created',
  PARTNER_ADDED: 'Deal partner added',
  ROLES_ASSIGNED: 'Buyer and seller assigned',
  WAITING_FOR_DEAL_DETAILS: 'Waiting for deal details',
  WAITING_FOR_BUYER_APPROVAL: 'Waiting for buyer approval',
  BUYER_APPROVED: 'Buyer approved the deal',
  CURRENCY_SELECTION: 'Selecting currencies',
  PAYMENT_REQUEST_CREATED: 'Payment request created',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAYMENT_DETECTED: 'Payment detected',
  PAYMENT_CONFIRMING: 'Waiting for confirmations',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  DEAL_IN_PROGRESS: 'Deal in progress',
  WAITING_FOR_COMPLETION_CONFIRMATIONS: 'Waiting for completion confirmations',
  BUYER_COMPLETED: 'Buyer confirmed completion',
  SELLER_COMPLETED: 'Seller confirmed completion',
  READY_FOR_PAYOUT_ADDRESS: 'Waiting for payout address',
  PAYOUT_ADDRESS_SUBMITTED: 'Payout address submitted',
  PAYOUT_REVIEW: 'Payout under review',
  PAYOUT_PENDING: 'Payout authorised',
  PAYOUT_BROADCAST: 'Payout broadcast',
  PAYOUT_CONFIRMING: 'Payout confirming',
  PAYOUT_CONFIRMED: 'Payout confirmed',
  WAITING_FOR_SELLER_RECEIPT: 'Waiting for seller receipt confirmation',
  PAYOUT_REVIEW_REQUIRED: 'Payout review required',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
};
