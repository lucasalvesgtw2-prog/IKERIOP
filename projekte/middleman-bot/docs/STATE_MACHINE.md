# Deal state machine

The transition table lives in `src/domain/deal/state.ts` and is covered by
`tests/unit/state.test.ts`. A Discord interaction can only _request_ a
transition; `assertTransition` decides, and the write is guarded by
`WHERE id = ? AND status = ?` so a lost race fails loudly.

## Main path

```
CREATED
  └─ Add Deal Partner ──────────────► PARTNER_ADDED
       └─ Assign Buyer/Seller ──────► ROLES_ASSIGNED
            └─ prompt seller ───────► WAITING_FOR_DEAL_DETAILS
                 └─ modal submitted ► WAITING_FOR_BUYER_APPROVAL
                      ├─ Request Changes ──► WAITING_FOR_DEAL_DETAILS  (loop)
                      └─ Confirm Deal ─────► BUYER_APPROVED
                           └─────────────► CURRENCY_SELECTION
                                (buyer picks pay asset, seller picks receive asset)
                                └────────► PAYMENT_REQUEST_CREATED
                                     └───► AWAITING_PAYMENT
                                            ├─ quote expired ► PAYMENT_REQUEST_CREATED
                                            └─ deposit seen ─► PAYMENT_DETECTED
                                                 └──────────► PAYMENT_CONFIRMING
                                                      └─────► PAYMENT_CONFIRMED
                                                           └► DEAL_IN_PROGRESS
                                                             └► WAITING_FOR_COMPLETION_CONFIRMATIONS
                                                                 ├─ buyer first ► BUYER_COMPLETED
                                                                 └─ seller first► SELLER_COMPLETED
                                                                       └─ other party ► READY_FOR_PAYOUT_ADDRESS
                                                                            └► PAYOUT_ADDRESS_SUBMITTED
                                                                               ├─ invalid ► READY_FOR_PAYOUT_ADDRESS
                                                                               └────────► PAYOUT_REVIEW
                                                                                    ├─ rejected ► READY_FOR_PAYOUT_ADDRESS
                                                                                    └─ staff authorises ► PAYOUT_PENDING
                                                                                         ├─ signer refused ► FAILED
                                                                                         └────────────────► PAYOUT_BROADCAST
                                                                                              └──────────► PAYOUT_CONFIRMING
                                                                                                   ├─ stuck ► PAYOUT_REVIEW_REQUIRED
                                                                                                   └──────► PAYOUT_CONFIRMED
                                                                                                        └─► WAITING_FOR_SELLER_RECEIPT
                                                                                                             ├─ "I did not receive" ► PAYOUT_REVIEW_REQUIRED
                                                                                                             └─ "Yes, received" ────► COMPLETED
```

## Cross-cutting rules

These are rules, not table edges, so they stay correct as the table grows.

| Rule          | Allowed from                                                                    | Deliberate exclusions                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `→ DISPUTED`  | any state in `DISPUTABLE_STATES` (payment confirmed onwards)                    | **Not** from `PAYOUT_PENDING`, `PAYOUT_BROADCAST`, `PAYOUT_CONFIRMING`, `PAYOUT_CONFIRMED` — un-freezing a deal whose payout is in flight could produce a second payout. Not before payment either: with no escrowed funds there is nothing to dispute, the parties simply cancel. |
| `DISPUTED →`  | `READY_FOR_PAYOUT_ADDRESS`, `PAYOUT_REVIEW`, `COMPLETED`, `CANCELLED`, `FAILED` | **Never** straight to `PAYOUT_PENDING` or `PAYOUT_BROADCAST`: resolving a dispute re-enters the _review_ step, so a payout is still explicitly authorised.                                                                                                                         |
| `→ CANCELLED` | `USER_CANCELLABLE_STATES` — up to and including `AWAITING_PAYMENT`              | Nothing after a deposit is seen. Once funds may be in flight, only staff resolve the deal.                                                                                                                                                                                         |
| `→ EXPIRED`   | same set as cancellation                                                        | A deal holding funds never expires silently.                                                                                                                                                                                                                                       |
| `→ FAILED`    | any non-terminal state that is not payout-in-flight                             | A broadcast payout must be reconciled against the chain before the deal can be closed.                                                                                                                                                                                             |
| terminal      | `COMPLETED`, `CANCELLED`, `EXPIRED`, `FAILED`                                   | Zero outgoing transitions.                                                                                                                                                                                                                                                         |

## Guarantees the tests assert

- Every state is reachable from `CREATED`.
- No self-transitions.
- `CREATED → COMPLETED`, `CREATED → PAYOUT_PENDING`, `AWAITING_PAYMENT → PAYMENT_CONFIRMED`
  and `DEAL_IN_PROGRESS → READY_FOR_PAYOUT_ADDRESS` are all rejected.
- `PAYOUT_ADDRESS_SUBMITTED → PAYOUT_PENDING` is rejected: staff review is not skippable.
- From `PAYOUT_REVIEW_REQUIRED` the only exits are `COMPLETED`, `DISPUTED` and `FAILED` —
  **no path back into a payout**, which is what stops a double payout after a
  seller reports missing funds.
