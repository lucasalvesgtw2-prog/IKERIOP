# Discord interaction flow

## Component id scheme

Every button, select menu and modal carries a structured, versioned custom id:

```
v1:<domain>:<action>:<dealId>:<nonce>
      │        │        │        └─ random token stored on the deal/message;
      │        │        │           a stale button from an earlier render fails
      │        │        └─ the deal the click claims to be about
      │        └─ what the user is asking for
      └─ schema version, so old ids can be rejected after a deploy
```

The custom id is **untrusted input**. On every interaction the router:

1. Parses and version-checks the id (malformed → friendly error, no crash).
2. Rate-limits on `(userId, action)`.
3. Loads the deal by id — not by channel, not by anything the client said.
4. Checks the actor is the participant the action requires (buyer / seller / staff).
5. Checks the deal's **current** state allows the action.
6. Checks the nonce matches the deal's current render.
7. Takes the Redis deal lock, then executes inside a database transaction whose
   `UPDATE` is guarded on the expected previous status.

Steps 3–7 are why an old button, a replayed click, or a click from a user who
was removed from the ticket cannot do anything.

## Screen-by-screen

| #   | Trigger                   | Actor                                       | Bot response                                                                                                                                                                                                              |
| --- | ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/setup`                  | Admin                                       | Posts the public panel with **🎫 Open Middleman Ticket**.                                                                                                                                                                 |
| 2   | Panel button              | anyone                                      | Creates a private channel `middleman-0001`, deal `MM-0001`, posts the **support message** (always mentions the configured support role) and the ticket panel: **👤 Add Deal Partner**, **❌ Close Ticket**.               |
| 3   | Add Deal Partner          | creator                                     | User-select menu. Validates: not the creator, not a bot, not banned, in the guild. Adds the partner to the channel.                                                                                                       |
| 4   | Role assignment           | creator                                     | Two selects, or a swap button: _Who is the Buyer?_ / _Who is the Seller?_ Server rejects the same user in both roles; the database also enforces one BUYER and one SELLER row per deal.                                   |
| 5   | Enter Deal Details        | **seller only**                             | Modal: Item / Service · Description · Additional Terms · **Deal Amount (USD)**. The amount is parsed as USD; `0.001 BTC` is rejected.                                                                                     |
| 6   | Deal summary embed        | —                                           | Shows Deal ID, buyer, seller, item, description, terms and **Deal Value in USD**, with **✅ Confirm Deal** / **❌ Request Changes**.                                                                                      |
| 7   | Confirm / Request Changes | **buyer only**                              | Confirm → `buyerApproved = true`. Request Changes → modal for the reason, seller re-enters details as a new revision, buyer must approve again.                                                                           |
| 8   | Payment currency select   | **buyer only**                              | Asset, then network for that asset. Only assets/networks valid for the current runtime mode are offered.                                                                                                                  |
| 9   | Receiving currency select | **seller only**                             | Same menus. May differ from the buyer's choice.                                                                                                                                                                           |
| 10  | Payment breakdown embed   | —                                           | Deal Value · Middleman Fee (5%) · **Buyer Total** · Payment Currency · Network · Amount Required, plus the quote timestamp and expiry.                                                                                    |
| 11  | Payment instructions      | —                                           | Address from the wallet registry (never hard-coded), exact crypto amount, network warning. State → `AWAITING_PAYMENT`.                                                                                                    |
| 12  | _(no interaction)_        | chain                                       | The monitor detects the deposit, posts `Confirmations: 1 / 3`, and only after the required confirmations posts **✅ Payment Confirmed**.                                                                                  |
| 13  | ✅ Deal Completed         | buyer **and** seller                        | A live panel shows each party's status. The payout stage is reached only when both have confirmed.                                                                                                                        |
| 14  | Payout address modal      | **seller only**                             | Address validated for the seller's asset _and_ network (format, checksum, network family). Invalid → re-prompt naming the expected asset/network.                                                                         |
| 15  | Payout review             | seller + staff                              | Review embed. **Authorisation is a staff action**; the seller cannot authorise their own payout.                                                                                                                          |
| 16  | Payout broadcast          | staff                                       | Idempotent. Posts the tx hash and an explorer link, then tracks confirmations.                                                                                                                                            |
| 17  | Receipt confirmation      | **seller only**                             | **✅ Yes, I received the funds** → `COMPLETED`, summary embed, ticket archived after the configured delay. **❌ I did not receive the funds** → `PAYOUT_REVIEW_REQUIRED`, staff notified, **no automatic second payout**. |
| —   | ⚠️ Open Dispute           | buyer or seller, after payment confirmation | Freezes the deal, blocks the payout, notifies staff. Only staff resolve it.                                                                                                                                               |

## Error handling

Every handler is wrapped so the bot cannot crash on user behaviour:

| Situation                           | Response                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Modal dismissed                     | Nothing happens; the collector times out silently.                                                     |
| Button clicked twice                | The second click loses the lock or the guarded `UPDATE`, and gets _"This has already been processed."_ |
| Old button from a previous render   | Nonce mismatch → _"This message is out of date. Please use the latest message in this ticket."_        |
| Button for another deal             | Deal/actor check fails → _"You are not a participant in this deal."_                                   |
| Interaction token expired (>15 min) | `10062 Unknown interaction` / `40060` are caught and logged at debug; no stack trace, no crash.        |
| Invalid address / wrong network     | Validation error naming the expected asset and network.                                                |
| Price API down                      | _"An external service is temporarily unavailable."_ The deal state does not move.                      |
