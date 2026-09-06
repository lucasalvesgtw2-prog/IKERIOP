# Security review

Reviewed: the whole codebase at Phase 14, before the project was declared
complete. This document records what was checked, what was found, and what
remains a known limitation.

`docs/SECURITY_MODEL.md` describes the design. This is the review of whether
the implementation matches it.

---

## Summary

| Area                 | Result                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Authentication       | ✅ Delegated to Discord; the bot never handles credentials           |
| Authorization        | ✅ Re-checked server-side on every interaction, from the database    |
| Privilege escalation | ✅ No path found; a party cannot authorise their own payout          |
| Interaction spoofing | ✅ Custom ids are untrusted input and grant nothing                  |
| Race conditions      | ✅ Redis mutex + guarded `UPDATE ... WHERE status = ?`               |
| Double payouts       | ✅ Six independent layers; crash recovery reconciles, never re-sends |
| Replay attacks       | ✅ Per-render nonces, plus state checks that make a replay a no-op   |
| Address manipulation | ✅ Real decoding and checksums, per asset and network                |
| Network mismatch     | ✅ (asset, network) is the unit throughout; mainnet gated by mode    |
| Price manipulation   | ✅ Server-side quotes, sanity bounds, persisted and expiring         |
| Database integrity   | ✅ The invariants are constraints, not conventions                   |
| Secret leakage       | ✅ No key material stored; two layers of log redaction               |
| API abuse            | ✅ Per-user, per-action rate limits; cached prices                   |
| Confirmation logic   | ✅ Requirement snapshotted per payment; re-orgs reset the count      |
| Mainnet safety       | ✅ Three independent switches, none of them default-on               |

Three real defects were found and fixed during development. They are recorded
below because "no findings" in a review of one's own code usually means the
review was not done.

---

## 1. Authentication and authorization

**Authentication** is Discord's. The bot never sees a password and stores no
session. The only credential it holds is its own bot token, which lives in the
environment and is redacted from logs.

**Authorization** is re-derived on every single interaction:

- The guild member is **re-fetched** rather than taken from the interaction
  payload, so removing someone's role takes effect on their very next click.
- The deal is loaded **from the database by the channel the interaction
  happened in** — not from the custom id. A component carried into another
  channel cannot reach a deal it does not belong to.
- Role checks (`isBuyer`, `isSeller`, `requireStaffLevel`) run against the
  stored deal, never against anything the client supplied.

A Discord server administrator is deliberately treated as bot-admin: they can
grant themselves any role anyway, so pretending otherwise would add complexity
without adding security.

### Finding 1 — role forgery via a select value _(fixed)_

`deriveAssignment` originally picked the seller as "the first participant who
is not the buyer". A crafted select value naming an outsider would therefore
have produced `buyer: outsider, seller: <real participant>`.

It was not exploitable — `assignRoles` re-validates and would have rejected it —
but a function that can _produce_ a corrupt assignment is a defect regardless of
what catches it downstream. The buyer is now checked against the participant
list before anything is derived from it. Covered by
`tests/unit/dealService.test.ts`.

---

## 2. Privilege escalation

The one privilege worth escalating to is **authorising a payout**. It requires:

1. the middleman (or admin) role, checked against live guild membership; and
2. that the authoriser is **not** the buyer or the seller of that deal.

Both are enforced in `PayoutService.authorize`, not in the button handler, so
they hold for every caller including the admin commands.

No path was found by which a deal participant can reach a payout authorisation.

---

## 3. Interaction spoofing and replay

Component ids are `v1:<domain>:<action>:<target>:<nonce>` and are treated as
**untrusted input**. An id selects a handler and names a record to look up; it
grants nothing. Segments cannot contain the separator, so extra segments cannot
be forged (`v1:ticket:close:MM-1:n:extra` parses to `null`).

Replay is blocked three ways, any one of which suffices:

- the **nonce** is rotated on every re-render, so a button from an earlier
  message fails freshness;
- the **state check** makes a replayed action a no-op, because the deal has
  already moved on; and
- the **guarded update** matches zero rows for the loser of a race.

A cache miss on the nonce counts as _stale_, never as fresh — the safe failure
is asking the user for the newest message.

---

## 4. Race conditions and double payouts

This is the failure mode that would cost real money, so the protections are
layered and independent.

**Every mutating operation** takes a Redis mutex on the deal, then runs a
database transaction whose write is `UPDATE ... WHERE id = ? AND status = ?`.
The lock removes contention; the guarded update is the actual correctness
guarantee. Every handler **re-reads the deal inside the lock** rather than
trusting the state it checked before acquiring it.

**A payout is sent at most once.** Six independent mechanisms:

1. `Payout.dealId` is `UNIQUE` — one payout row per deal, enforced by PostgreSQL.
2. `idempotencyKey` is derived from the deal id, so a retry addresses the same row.
3. `Deal.payoutLockedAt` is set on authorisation and **never cleared**.
4. Every state change is a guarded update on the expected previous status.
5. The `Signer` contract is idempotent on the key — and the mock signer honours
   it too, so the guarantee is exercised in development, not only in production.
6. `reconcileOnBoot` runs **before any worker starts**: every payout that might
   be in flight is looked up at the signer by key. A crash immediately after
   broadcasting resolves by finding the existing transaction.

The state machine adds a seventh: `PAYOUT_REVIEW_REQUIRED` — the state a deal
enters when the seller reports missing funds — has **no transition back into
any payout state**. Its only exits are `COMPLETED`, `DISPUTED` and `FAILED`.

Tested in `tests/unit/payoutIdempotency.test.ts`, including ten concurrent
broadcasts on one key producing exactly one send, and a simulated crash
recovering by lookup rather than by re-sending.

---

## 5. Payment verification

A payment is credited **only** from a transfer the bot read from a chain
adapter and then verified independently by transaction hash. Specifically:

- A screenshot has no effect on state at all.
- A user-supplied hash is at most a hint about where to look; it is verified
  before it counts.
- `@@unique([network, txHash])` means one transaction funds exactly one deal —
  enforced by the database, not by application logic.
- A reverted EVM or Tron transaction (`status: 0x0`, non-`SUCCESS` receipt) is
  never counted, because no funds moved.
- An **under-payment never becomes CONFIRMED**. It stops, pings support, and
  the deal does not advance.

Confirmation counts come from the requirement **stored on the payment row**, so
lowering `CONFIRMATIONS_BTC` later cannot retroactively confirm an old payment.
A dropped or re-orged transaction takes the count back to zero rather than
keeping an optimistic value.

---

## 6. Address and network validation

Addresses are decoded, not pattern-matched:

| Chain   | Validation                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Bitcoin | bech32 / bech32m with witness-version rules, and base58check; network byte matched against the deal's network; mixed case rejected per BIP-173 |
| EVM     | EIP-55 checksum verified when the address is mixed-case; normalised when it is not                                                             |
| Tron    | base58check with the `0x41` version byte                                                                                                       |

Cross-chain and wrong-network addresses are rejected with a message naming what
was expected. Tested against real addresses in
`tests/unit/addressValidation.test.ts`.

The `(asset, network)` pair is the unit everything keys off, because "USDT"
alone is not a destination. Currency selection offers complete pairs rather than
an asset then a network, so a mismatched combination cannot be expressed.

---

## 7. Price manipulation

Prices come only from the configured provider, fetched server-side. A client
never supplies an amount.

Every quote is persisted with `usdPrice`, `usdAmount`, `cryptoAmount`,
`assetDecimals`, `provider` and timestamps, and `verifyStoredQuote` re-derives
the amount from those inputs — so any figure the bot ever asked for can be
audited and a tampered row detected.

`CachedPriceProvider` rejects a price outside a plausible band for the asset.
The bands are deliberately wide (BTC $1k–$10M): they catch an
order-of-magnitude error, a zeroed feed or a depegged stablecoin, not ordinary
volatility. **Acting on a bad price is worse than failing** — at $1/BTC the bot
would ask a buyer for 105 BTC.

Quotes expire. An expired quote forces a re-quote rather than being silently
extended, and re-quoting is refused once any funds have been seen.

---

## 8. Rounding

USD rounds HALF_UP to cents. Crypto rounds **UP** to the asset's precision,
always — rounding down would ask for fractionally less than the deal is worth
and leave escrow short.

The buyer total is derived from the **rounded** fee, so the displayed parts sum
to the displayed total. (A $33.33 deal: fee $1.67, total $35.00.)

The payment tolerance is one unit at the asset's precision — enough to absorb
the rounding-up above, far too small to hide a meaningful shortfall.

---

## 9. Secret handling

- **No key material is stored anywhere.** There is no private key, seed or
  mnemonic column in the schema; `tests/unit/security.test.ts` asserts this
  mechanically so a future migration cannot introduce one unnoticed.
- `Wallet.signerRef` is an opaque handle understood only by the external signer.
- Pino redacts key-like paths; the audit writer strips them again at any depth.
- No secret is ever sent to Discord.

The **manual signer** is the recommended production configuration: the bot holds
no keys at all. It prepares the payout, a middleman sends it from a hardware
wallet, and the bot then verifies that hash on chain. A compromise of the bot or
its database cannot move funds, because the bot has nothing to move them with.

### Finding 2 — money errors reached users as "Something went wrong" _(fixed)_

`MoneyError` did not extend `AppError`, so it carried no user-safe message. A
seller typing `0.001 BTC` as the deal amount would have seen the generic
internal-error fallback instead of the reason.

Not a confidentiality problem — it leaked nothing — but a correctness one: the
error path silently discarded a message written specifically for the user.
Worth noting _how_ it surfaced: the unit tests passed, because they assert
`toThrow(MoneyError)`. Only running the compiled build and printing what a user
would actually see exposed it.

---

## 10. Message spoofing

Deal text written by one party is rendered to the other **inside an embed the
bot authored**, which is the most convincing possible place to fake an
instruction from the middleman.

Every user-written field is markdown-escaped and has mentions defused before
rendering, so a description cannot render as a bold "Payment address:" line.
Invisible and bidi-control characters are stripped on input, so text cannot be
hidden, made to read in reverse, or used as zero-width padding to satisfy a
length check.

### Finding 3 — user text was rendered unescaped _(fixed)_

Found during the Phase 4 review, before the summary embed shipped. Addressed by
`src/core/text.ts`; covered by `tests/unit/text.test.ts`.

---

## 11. Rate limiting and abuse

Fixed-window Redis limits per `(user, action)`, tighter on the expensive and
dangerous paths:

| Action             | Limit         |
| ------------------ | ------------- |
| Ticket creation    | 3 / minute    |
| Deal mutations     | 20 / minute   |
| Modal submissions  | 10 / minute   |
| Price quotes       | 10 / minute   |
| Payout submissions | 5 / 5 minutes |
| Opening a dispute  | 3 / 5 minutes |

Plus: at most 3 open tickets per user, prices cached, and chain polling batched
per address with a per-payment lock so passes cannot overlap.

Rate limiting protects resources. It is **not** what prevents duplicate effects —
that is the state machine — and is not relied on for correctness.

---

## 12. Availability

A failure in one payment or payout never stops the rest of a monitoring pass.
Redis failures degrade to direct lookups rather than errors. The interaction
error boundary converts every throw into a user-safe ephemeral reply, and drops
expired interaction tokens quietly, so user behaviour cannot crash the bot.

---

## Known limitations

These are deliberate, and are the things to address before handling large
volumes or large amounts.

1. **The mock chain and mock signer move no money.** That is the point, but it
   means the live path is exercised by construction and code review rather than
   by end-to-end runs. Test on testnet before mainnet.
2. **`external` signer backend is declared but not implemented.** It throws a
   clear configuration error rather than silently falling back. Implement the
   `Signer` interface for your HSM or wallet service.
3. **Native EVM deposit scanning is bounded** to recent blocks to avoid
   hammering the node. Deposits are expected within the payment window; a
   deposit arriving long after would need a manual check. ERC20 and TRC20 use
   log/feed queries and are not affected.
4. **No automatic refunds.** A dispute resolved in the buyer's favour cancels
   the deal and support moves the funds by hand. This is intentional: an
   automatic refund path is a second way for the bot to move money.
5. **Re-org handling resets confirmations** but does not alert on a deep
   re-org that invalidates an already-confirmed payment. Set confirmation
   requirements appropriately for the amounts you handle.
6. **The audit log is append-only by convention**, not by database permission.
   For a high-value deployment, grant the bot's role `INSERT` but not
   `UPDATE`/`DELETE` on `audit_logs` and `state_transitions`.
7. **One Redis instance is assumed.** The lock is a single-instance mutex, not
   Redlock. Correctness does not depend on it — the guarded updates do — but a
   Redis failover could briefly allow two handlers to contend.

---

## Reproducing this review

```bash
npm run check          # format, lint, typecheck, full test suite
npm test -- tests/unit/security.test.ts       # the mechanical invariants
npm test -- tests/unit/payoutIdempotency.test.ts   # double-payout protection
npm test -- tests/unit/addressValidation.test.ts   # address and network safety
npm test -- tests/unit/state.test.ts               # illegal transitions
```

## Reporting a vulnerability

Do not open a public issue. Contact the repository owner directly, and include
enough detail to reproduce. If it concerns funds at risk, say so in the first
line.
