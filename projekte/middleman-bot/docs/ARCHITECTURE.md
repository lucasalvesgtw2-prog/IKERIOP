# Architecture

## 1. Guiding principles

| #   | Principle                                                                   | How it is enforced                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The canonical value of a deal is USD.** Crypto is only a settlement rail. | `Deal.dealAmountUsd` is `DECIMAL(18,2)`. Every crypto amount is derived from a stored `PriceQuote` and is reproducible. The deal amount modal rejects anything that is not a plain USD number.                               |
| 2   | **No floating point in financial math.**                                    | `decimal.js` everywhere, `DECIMAL` columns in PostgreSQL, an ESLint rule banning `parseFloat`. USD rounds HALF_UP to cents; crypto rounds **UP** to the asset precision so rounding can never under-fund escrow.             |
| 3   | **Discord is an input device, never an authority.**                         | Every interaction is re-authorised server-side against the database: deal id, actor id, current state, role, and guild role membership. A `customId` is untrusted input.                                                     |
| 4   | **The state machine is the only way a deal changes.**                       | `src/domain/deal/state.ts` holds the transition table. Persisting a transition uses `UPDATE ... WHERE id = ? AND status = ?` so a lost race fails instead of overwriting.                                                    |
| 5   | **Money is never assumed.**                                                 | A payment is confirmed only after the bot independently reads the transaction from a chain adapter and counts confirmations. Screenshots and user-supplied hashes are evidence, not proof.                                   |
| 6   | **A payout happens at most once.**                                          | One `Payout` row per deal (`@@unique([dealId])`), a derived `idempotencyKey`, a `payoutLockedAt` flag, a Redis mutex, and a signer contract that is idempotent on the key. Crash recovery **reconciles**, it never re-sends. |
| 7   | **Secrets stay out of the database, the logs and Discord.**                 | No key material in any model. `Wallet.signerRef` is an opaque handle. The logger redacts key-like paths. The audit writer strips them again.                                                                                 |
| 8   | **Mainnet is opt-in, loudly.**                                              | `LIVE_MODE=false` by default. Mainnet additionally requires `CHAIN_NETWORK_MODE=mainnet` and an explicit acknowledgement string, and refuses to start with the mock signer or mock price provider.                           |

## 2. Layers

```
                        Discord Gateway
                              │
┌─────────────────────────────▼──────────────────────────────┐
│  src/bot            Presentation                            │
│  commands · interactions (buttons/selects/modals)           │
│  components (embeds, rows) · guards (authz, state, rate)    │
│  No business rules. No direct database writes.              │
└─────────────────────────────┬──────────────────────────────┘
                              │ typed calls
┌─────────────────────────────▼──────────────────────────────┐
│  src/services       Application                             │
│  ticket · deal · payment · payout · dispute · audit · config│
│  Owns transactions, locking, idempotency, orchestration.    │
└──────┬──────────────────────┬──────────────────────┬───────┘
       │                      │                      │
┌──────▼────────┐   ┌─────────▼─────────┐   ┌────────▼───────┐
│ src/domain    │   │ src/repositories  │   │  Adapters      │
│ Pure logic:   │   │ Prisma access,    │   │ src/prices     │
│ state machine │   │ optimistic writes │   │ src/chains     │
│ fees, quotes  │   │                   │   │ src/wallets    │
│ No I/O.       │   └─────────┬─────────┘   └────────┬───────┘
└───────────────┘             │                      │
                    ┌─────────▼─────────┐   ┌────────▼───────┐
                    │  PostgreSQL       │   │ Chains, price  │
                    │  (Prisma)         │   │ APIs, signer   │
                    └───────────────────┘   └────────────────┘

  src/infra: Prisma client · Redis · distributed locks · rate limiting
  src/core:  money · errors · logger · ids
```

Dependencies point inwards only. `src/domain` imports nothing but `src/core`, which
is what makes the fee engine and state machine unit-testable without a database.

## 3. Background workers

| Worker           | Job                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentMonitor` | Polls chain adapters for deposits to the addresses of deals in `AWAITING_PAYMENT` / `PAYMENT_DETECTED` / `PAYMENT_CONFIRMING`, credits them idempotently, advances confirmations. |
| `payoutMonitor`  | Tracks broadcast payouts to confirmation. **Reconciles on boot**: any payout in `BROADCAST`/`SIGNING` is looked up by idempotency key at the signer before anything else happens. |
| `expiryWorker`   | Expires deals that never got paid. Only ever touches states where no funds are held.                                                                                              |
| `ticketCloser`   | Archives tickets after the configured delay.                                                                                                                                      |

## 4. Extension points

Adding a coin, a network, a price source, a chain or a signer is additive:

- **Asset / network** — add an entry to `src/config/assets.ts`.
- **Price provider** — implement `PriceProvider`, register it in `src/prices/index.ts`, select with `PRICE_PROVIDER`.
- **Chain** — implement `ChainAdapter` (validate address, read transfers, read tx status). Adapters cannot spend.
- **Signer** — implement `Signer`. Must be idempotent on `idempotencyKey`. Select with `SIGNER_BACKEND`.

No other module hard-codes an asset name, a network name or a provider.
