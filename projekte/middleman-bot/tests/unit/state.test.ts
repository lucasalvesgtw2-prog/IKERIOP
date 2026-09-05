import { describe, expect, it } from 'vitest';
import { InvalidStateError } from '../../src/core/errors.js';
import {
  DEAL_STATES,
  DEAL_STATE_LABELS,
  allowedTransitions,
  assertTransition,
  canTransition,
  holdsFunds,
  isDealState,
  isPayoutInFlight,
  isTerminal,
  type DealState,
} from '../../src/domain/deal/state.js';

describe('state registry', () => {
  it('exposes every state required by the specification', () => {
    const required: DealState[] = [
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
      'COMPLETED',
      'DISPUTED',
      'CANCELLED',
      'EXPIRED',
      'FAILED',
    ];

    for (const state of required) {
      expect(DEAL_STATES).toContain(state);
    }
  });

  it('has a label for every state', () => {
    for (const state of DEAL_STATES) {
      expect(DEAL_STATE_LABELS[state]).toBeTruthy();
    }
  });

  it('recognises only known states', () => {
    expect(isDealState('CREATED')).toBe(true);
    expect(isDealState('PAID_LOL')).toBe(false);
    expect(isDealState('')).toBe(false);
  });
});

describe('happy path', () => {
  const happyPath: DealState[] = [
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
    'READY_FOR_PAYOUT_ADDRESS',
    'PAYOUT_ADDRESS_SUBMITTED',
    'PAYOUT_REVIEW',
    'PAYOUT_PENDING',
    'PAYOUT_BROADCAST',
    'PAYOUT_CONFIRMING',
    'PAYOUT_CONFIRMED',
    'WAITING_FOR_SELLER_RECEIPT',
    'COMPLETED',
  ];

  it('walks end to end without an illegal step', () => {
    for (let i = 0; i < happyPath.length - 1; i += 1) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it('accepts the seller confirming completion first', () => {
    expect(canTransition('WAITING_FOR_COMPLETION_CONFIRMATIONS', 'SELLER_COMPLETED')).toBe(true);
    expect(canTransition('SELLER_COMPLETED', 'READY_FOR_PAYOUT_ADDRESS')).toBe(true);
  });
});

describe('illegal transitions', () => {
  it('cannot skip from CREATED straight to payout or completion', () => {
    expect(canTransition('CREATED', 'PAYOUT_PENDING')).toBe(false);
    expect(canTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(canTransition('CREATED', 'PAYMENT_CONFIRMED')).toBe(false);
    expect(() => assertTransition('CREATED', 'COMPLETED')).toThrow(InvalidStateError);
  });

  it('cannot confirm a payment that was never detected', () => {
    expect(canTransition('AWAITING_PAYMENT', 'PAYMENT_CONFIRMED')).toBe(false);
    expect(canTransition('PAYMENT_REQUEST_CREATED', 'PAYMENT_CONFIRMED')).toBe(false);
  });

  it('cannot reach a payout without both completion confirmations', () => {
    expect(canTransition('DEAL_IN_PROGRESS', 'READY_FOR_PAYOUT_ADDRESS')).toBe(false);
    expect(canTransition('WAITING_FOR_COMPLETION_CONFIRMATIONS', 'READY_FOR_PAYOUT_ADDRESS')).toBe(
      false,
    );
    expect(canTransition('BUYER_COMPLETED', 'PAYOUT_PENDING')).toBe(false);
  });

  it('cannot broadcast a payout without staff authorisation', () => {
    expect(canTransition('PAYOUT_ADDRESS_SUBMITTED', 'PAYOUT_PENDING')).toBe(false);
    expect(canTransition('PAYOUT_ADDRESS_SUBMITTED', 'PAYOUT_BROADCAST')).toBe(false);
    expect(canTransition('PAYOUT_REVIEW', 'PAYOUT_BROADCAST')).toBe(false);
  });

  it('cannot re-enter the payout track from a confirmed payout', () => {
    expect(canTransition('PAYOUT_CONFIRMED', 'PAYOUT_PENDING')).toBe(false);
    expect(canTransition('PAYOUT_CONFIRMED', 'READY_FOR_PAYOUT_ADDRESS')).toBe(false);
    expect(canTransition('WAITING_FOR_SELLER_RECEIPT', 'PAYOUT_PENDING')).toBe(false);
  });

  it('never allows a self-transition', () => {
    for (const state of DEAL_STATES) {
      expect(canTransition(state, state), state).toBe(false);
    }
  });

  it('never leaves a terminal state', () => {
    for (const terminal of ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] as DealState[]) {
      expect(isTerminal(terminal)).toBe(true);
      expect(allowedTransitions(terminal)).toEqual([]);
    }
  });
});

describe('disputes', () => {
  it('can be opened once funds are in escrow', () => {
    expect(canTransition('PAYMENT_CONFIRMED', 'DISPUTED')).toBe(true);
    expect(canTransition('DEAL_IN_PROGRESS', 'DISPUTED')).toBe(true);
    expect(canTransition('BUYER_COMPLETED', 'DISPUTED')).toBe(true);
    expect(canTransition('READY_FOR_PAYOUT_ADDRESS', 'DISPUTED')).toBe(true);
    expect(canTransition('WAITING_FOR_SELLER_RECEIPT', 'DISPUTED')).toBe(true);
  });

  it('cannot be opened before a payment is confirmed', () => {
    expect(canTransition('CREATED', 'DISPUTED')).toBe(false);
    expect(canTransition('AWAITING_PAYMENT', 'DISPUTED')).toBe(false);
    expect(canTransition('PAYMENT_DETECTED', 'DISPUTED')).toBe(false);
  });

  it('cannot freeze a payout that is already in flight', () => {
    for (const state of [
      'PAYOUT_PENDING',
      'PAYOUT_BROADCAST',
      'PAYOUT_CONFIRMING',
      'PAYOUT_CONFIRMED',
    ] as DealState[]) {
      expect(isPayoutInFlight(state)).toBe(true);
      expect(canTransition(state, 'DISPUTED'), state).toBe(false);
    }
  });

  it('is resolved only by staff, and never straight back into a payout broadcast', () => {
    expect(canTransition('DISPUTED', 'READY_FOR_PAYOUT_ADDRESS')).toBe(true);
    expect(canTransition('DISPUTED', 'PAYOUT_REVIEW')).toBe(true);
    expect(canTransition('DISPUTED', 'COMPLETED')).toBe(true);
    expect(canTransition('DISPUTED', 'CANCELLED')).toBe(true);
    expect(canTransition('DISPUTED', 'PAYOUT_BROADCAST')).toBe(false);
    expect(canTransition('DISPUTED', 'PAYOUT_PENDING')).toBe(false);
  });
});

describe('payout review required', () => {
  it('is reachable when the seller reports missing funds', () => {
    expect(canTransition('WAITING_FOR_SELLER_RECEIPT', 'PAYOUT_REVIEW_REQUIRED')).toBe(true);
    expect(canTransition('PAYOUT_CONFIRMING', 'PAYOUT_REVIEW_REQUIRED')).toBe(true);
  });

  it('never sends a second payout automatically', () => {
    expect(canTransition('PAYOUT_REVIEW_REQUIRED', 'PAYOUT_PENDING')).toBe(false);
    expect(canTransition('PAYOUT_REVIEW_REQUIRED', 'PAYOUT_BROADCAST')).toBe(false);
    expect(canTransition('PAYOUT_REVIEW_REQUIRED', 'READY_FOR_PAYOUT_ADDRESS')).toBe(false);
    // The only exits are staff decisions that end the deal or escalate it.
    // None of them can produce a second payout.
    expect(allowedTransitions('PAYOUT_REVIEW_REQUIRED').sort()).toEqual([
      'COMPLETED',
      'DISPUTED',
      'FAILED',
    ]);
  });
});

describe('cancellation and expiry', () => {
  it('are allowed only before any money can be in flight', () => {
    expect(canTransition('CREATED', 'CANCELLED')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'CANCELLED')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'EXPIRED')).toBe(true);

    expect(canTransition('PAYMENT_DETECTED', 'CANCELLED')).toBe(false);
    expect(canTransition('PAYMENT_CONFIRMED', 'CANCELLED')).toBe(false);
    expect(canTransition('PAYMENT_CONFIRMED', 'EXPIRED')).toBe(false);
    expect(canTransition('READY_FOR_PAYOUT_ADDRESS', 'EXPIRED')).toBe(false);
  });
});

describe('funds accounting', () => {
  it('marks every state after payment confirmation as holding funds', () => {
    expect(holdsFunds('PAYMENT_CONFIRMED')).toBe(true);
    expect(holdsFunds('DISPUTED')).toBe(true);
    expect(holdsFunds('PAYOUT_REVIEW_REQUIRED')).toBe(true);
    expect(holdsFunds('AWAITING_PAYMENT')).toBe(false);
    expect(holdsFunds('CREATED')).toBe(false);
  });
});

describe('reachability', () => {
  it('reaches every non-initial state from CREATED', () => {
    const seen = new Set<DealState>(['CREATED']);
    const queue: DealState[] = ['CREATED'];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of allowedTransitions(current)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    const unreachable = DEAL_STATES.filter((state) => !seen.has(state));
    expect(unreachable).toEqual([]);
  });
});
