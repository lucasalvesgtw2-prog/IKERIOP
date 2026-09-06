# Middleman / Escrow Bot

A Discord-based crypto middleman (escrow) bot. Two users open a private ticket,
agree a deal, the buyer pays into escrow, both confirm completion, and the funds
are released to the seller.

> **The canonical value of every deal is USD.** Cryptocurrency is only the
> payment rail. A deal is `$100.00`, never `0.001 BTC`.

> **Default middleman fee: 5%.** `$100.00` deal → `$5.00` fee → buyer pays `$105.00`.

---

## Status

All 17 phases are complete. The bot builds, starts, and carries a deal from an
empty ticket through to a confirmed payout and an archived ticket. 346 tests
pass; typecheck, ESLint, Prettier and the production build are clean.

| Phase | Scope                                                                        | State   |
| ----- | ---------------------------------------------------------------------------- | ------- |
| 1     | Architecture, project structure, money engine, state machine, schema, Docker | ✅ done |
| 2     | Discord ticket system                                                        | ✅ done |
| 3     | Buyer/Seller role system                                                     | ✅ done |
| 4     | Deal details + buyer approval                                                | ✅ done |
| 5     | Crypto selection + USD calculation                                           | ✅ done |
| 6     | Price provider + payment request                                             | ✅ done |
| 7     | Blockchain payment monitoring                                                | ✅ done |
| 8     | Deal completion confirmation                                                 | ✅ done |
| 9     | Payout address + validation                                                  | ✅ done |
| 10    | Secure payout system                                                         | ✅ done |
| 11    | Seller receipt confirmation                                                  | ✅ done |
| 12    | Dispute system                                                               | ✅ done |
| 13    | Database + audit logging                                                     | ✅ done |
| 14    | Security hardening + `SECURITY.md`                                           | ✅ done |
| 15    | Tests                                                                        | ✅ done |
| 16    | Docker + Windows setup                                                       | ✅ done |
| 17    | Final documentation                                                          | ✅ done |

### The complete flow

```
Open Middleman Ticket  →  private channel + support message
        ↓
Add Deal Partner       →  validated server-side, partner gets channel access
        ↓
Assign Buyer / Seller  →  one select; the other party becomes the seller
        ↓
Seller enters details  →  Item · Description · Terms · Deal Amount in USD
        ↓
Deal summary           →  Deal Value · Fee · Buyer Pays · Seller Receives
        ↓
Buyer approves         →  or requests changes; approval is re-earned each time
        ↓
Buyer picks payment    →  e.g. USDT on TRC20
Seller picks receiving →  e.g. BTC on Bitcoin — they may differ
        ↓
Payment request        →  address + exact amount from a stored, expiring quote
        ↓
Blockchain monitoring  →  detected → confirmations → confirmed
        ↓
"Payment Confirmed"    →  posted only after independent on-chain verification
        ↓
Both confirm complete  →  buyer and seller, independently
        ↓
Seller enters payout address  →  validated for that exact asset and network
        ↓
Payout review          →  authorised by a middleman who is not a party
        ↓
Payout broadcast       →  idempotent; a crash recovers, never re-sends
        ↓
Seller confirms receipt →  DEAL COMPLETED, ticket archived
```

At any point after the payment is confirmed, either party can open a dispute,
which freezes the deal and blocks the payout until staff resolve it.

### Commands

| Command                                   | Who                 | What                                          |
| ----------------------------------------- | ------------------- | --------------------------------------------- |
| `/setup`                                  | Admin               | Post the public "Open Middleman Ticket" panel |
| `/ticket`                                 | Anyone              | Open a ticket privately                       |
| `/deal status`                            | Participants, staff | Full status of the deal in this ticket        |
| `/deal dispute`                           | Participants        | How to open a dispute                         |
| `/admin config show`                      | Support             | The effective configuration and runtime mode  |
| `/admin config fee`                       | Admin               | Set the fee for **new** deals                 |
| `/admin config roles`                     | Admin               | Set the support, middleman and admin roles    |
| `/admin config limits`                    | Admin               | Set the minimum and maximum deal amount       |
| `/admin wallet list \| add`               | Admin               | Manage deposit and treasury addresses         |
| `/admin dispute list \| claim \| resolve` | Support             | Handle disputes                               |
| `/admin deal list \| note`                | Support             | Find deals needing attention; annotate one    |
| `/admin payout sent`                      | Middleman           | Record a manually broadcast payout            |
| `/admin payout reconcile`                 | Middleman           | Re-check every in-flight payout at the signer |

Normal users never need a command: the whole flow runs on buttons, select menus
and modals inside the ticket.

Nothing in this repository fakes a blockchain confirmation. Development runs in
**MOCK MODE**, which is labelled as such in every message it produces.

---

## Documentation

| Document                                               | Contents                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)         | Principles, layers, workers, extension points                             |
| [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md)       | Every state, every legal transition, and why the illegal ones are illegal |
| [`docs/INTERACTION_FLOW.md`](docs/INTERACTION_FLOW.md) | Screen-by-screen Discord flow, component id scheme, error handling        |
| [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)     | Trust boundaries, threats and controls                                    |
| `prisma/schema.prisma`                                 | The database schema, commented                                            |

---

## Requirements

- **Node.js 20.11 or newer** (22 LTS recommended)
- **PostgreSQL 14+**
- **Redis 6+**
- Optional: **Docker Desktop** — the easiest way to get PostgreSQL and Redis on Windows

---

## Windows setup, step by step

### 1. Install Node.js

Download the **LTS** installer from <https://nodejs.org> and run it. Then open
PowerShell and check:

```powershell
node -v    # v22.x.x
npm -v
```

### 2. Get the project

```powershell
git clone <your-repository-url>
cd IKERIOP\projekte\middleman-bot
```

### 3. Install dependencies

```powershell
npm install
```

### 4. Create your `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in at minimum `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`,
`DATABASE_URL` and `REDIS_URL`. Leave `LIVE_MODE=false`.

### 5. Create the Discord application

1. Open <https://discord.com/developers/applications> → **New Application**.
2. Copy the **Application ID** into `DISCORD_CLIENT_ID`.

### 6. Create the bot user and get the token

1. In your application → **Bot** → **Add Bot**.
2. **Reset Token** → copy it → paste into `.env` as the value of
   `DISCORD_BOT_TOKEN`.
3. Under **Privileged Gateway Intents**, enable **Server Members Intent**
   (the bot needs it to add deal partners to a ticket channel).
   Message Content Intent is **not** needed and should stay off.

> Never paste your token into source code, a Discord message, or a screenshot.
> It lives only in `.env`, which is git-ignored. If it leaks, reset it.

### 7. Invite the bot

**OAuth2 → URL Generator**, scopes `bot` and `applications.commands`, then the
permissions below. Open the generated URL and add the bot to your server.

### 8. Required Discord permissions

| Permission                             | Why                                              |
| -------------------------------------- | ------------------------------------------------ |
| View Channels                          | See the panel and ticket channels                |
| Manage Channels                        | Create, rename and archive ticket channels       |
| Manage Roles                           | Set per-channel permission overwrites on tickets |
| Send Messages                          | Post in tickets                                  |
| Embed Links                            | The deal, payment and payout embeds              |
| Attach Files                           | Optional receipts/exports                        |
| Read Message History                   | Re-render its own panels                         |
| Use Application Commands               | Slash commands                                   |
| Mention @everyone, @here and All Roles | Ping the support role in a ticket                |

Put the bot's role **above** the members it manages in Server Settings → Roles.

### 9. Get your server and role IDs

Enable **User Settings → Advanced → Developer Mode**, then right-click →
**Copy ID** on the server and on each role, and fill in `DISCORD_GUILD_ID`,
`SUPPORT_ROLE_ID`, `MIDDLEMAN_ROLE_ID`, `ADMIN_ROLE_ID`.

### 10. Run the databases

With Docker Desktop:

```powershell
docker compose -f docker-compose.dev.yml up -d
```

That starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`,
matching the defaults in `.env.example`. Without Docker, install PostgreSQL and
Redis natively and point `DATABASE_URL` / `REDIS_URL` at them.

Create the schema:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

### 11. Start the bot

```powershell
npm run build
npm start
```

or, while developing:

```powershell
npm run dev
```

### 12. Run the tests

```powershell
npm test
npm run check    # format + lint + typecheck + tests
```

### 13. Testnet / mock mode

The defaults are already safe:

```env
LIVE_MODE=false
CHAIN_NETWORK_MODE=mock
PRICE_PROVIDER=mock
SIGNER_BACKEND=mock
```

In this mode the bot only offers testnet networks, uses a mock price provider
and a mock signer, and labels every simulated payment as simulated. See
[Mainnet safety](#mainnet-safety) before changing any of it.

### 14. Configure support and admin roles

Set `SUPPORT_ROLE_ID`, `MIDDLEMAN_ROLE_ID` and `ADMIN_ROLE_ID` in `.env`, or
override them per server at runtime with `/admin configure` once Phase 13 lands.
The support role is the one mentioned in the welcome message of every ticket.

---

## Docker (everything in containers)

```powershell
Copy-Item .env.example .env   # fill in your Discord values
docker compose up -d
docker compose logs -f bot
```

`docker compose up` starts PostgreSQL, Redis and the bot, and applies the
database migrations before the bot starts.

---

## Configuration

Every variable is documented inline in [`.env.example`](.env.example). The ones
that decide whether real money can move:

| Variable                               | Default           | Meaning                                                             |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| `LIVE_MODE`                            | `false`           | Master switch. `false` = mock/testnet only.                         |
| `LIVE_MODE_CONFIRMATION`               | _(empty)_         | Must be `I_UNDERSTAND_THIS_MOVES_REAL_FUNDS` when `LIVE_MODE=true`. |
| `CHAIN_NETWORK_MODE`                   | `mock`            | `mock`, `testnet` or `mainnet`. Mainnet requires `LIVE_MODE=true`.  |
| `SIGNER_BACKEND`                       | `mock`            | `mock` is rejected in live mode.                                    |
| `PRICE_PROVIDER`                       | `mock`            | `mock` is rejected in live mode.                                    |
| `DEFAULT_FEE_PERCENTAGE`               | `5`               | The middleman fee.                                                  |
| `CONFIRMATIONS_BTC` / `_ETH` / `_TRON` | `3` / `12` / `20` | Confirmations before a payment counts.                              |

The bot refuses to start if these are inconsistent — see
`tests/unit/env.test.ts` for the exact rules.

---

## Mainnet safety

Mainnet is never enabled automatically. All of the following must be true:

```env
LIVE_MODE=true
LIVE_MODE_CONFIRMATION=I_UNDERSTAND_THIS_MOVES_REAL_FUNDS
CHAIN_NETWORK_MODE=mainnet
SIGNER_BACKEND=manual        # or external — never mock
PRICE_PROVIDER=coingecko     # never mock
PRICE_API_KEY=<your key>
```

Private keys and seed phrases are never stored in the database, never written to
source, never logged, and never sent to Discord. Payout signing happens in an
external signer (hardware wallet, HSM or wallet service) behind the `Signer`
interface.

---

## How the money works

```
Deal Value      $100.00 USD     ← the canonical value, agreed by both parties
Middleman Fee   $  5.00 USD     ← 5% of the deal value
Buyer Total     $105.00 USD     ← what the buyer sends
Seller Receives $100.00 USD     ← in the seller's chosen currency
```

The buyer and the seller can use different currencies — the buyer may pay USDT
on TRC20 while the seller receives BTC. Both legs are priced from the same USD
figures, and every conversion is stored as a `PriceQuote` (`usdPrice`,
`usdAmount`, `cryptoAmount`, `assetDecimals`, `quotedAt`) so any amount can be
recomputed later. Network fees are shown explicitly in the payout review; nothing
is silently deducted.

USD is rounded to cents (half up). Crypto amounts are rounded **up** to the
asset's precision, so rounding can never leave escrow under-funded.

---

## Troubleshooting

| Symptom                                      | Fix                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration` on start | The message lists each bad variable. Compare with `.env.example`.                                   |
| `DISCORD_BOT_TOKEN is required`              | `.env` is missing or was not copied from `.env.example`.                                            |
| `Can't reach database server`                | The database is not running. `docker compose -f docker-compose.dev.yml up -d`.                      |
| `redis error: connect ECONNREFUSED`          | Redis is not running, or `REDIS_URL` is wrong.                                                      |
| Prisma: `The table does not exist`           | Run `npm run prisma:migrate`.                                                                       |
| Bot is online but slash commands are missing | Run `npm run commands:register`, and check `DISCORD_GUILD_ID`.                                      |
| `Missing Permissions` when opening a ticket  | The bot needs Manage Channels and Manage Roles, and its role must sit above the members it manages. |
| `Missing Access` on adding a partner         | Enable the **Server Members Intent** in the Developer Portal.                                       |
| Token leaked                                 | Reset it in the Developer Portal, update `.env`, restart.                                           |

---

## Going live: the operator checklist

Work through this in order. Every step is deliberately manual.

1. **Run on testnet first.** Set `CHAIN_NETWORK_MODE=testnet`, point
   `BTC_RPC_URL` / `EVM_RPC_URL` / `TRON_API_URL` at testnet endpoints, and run
   a complete deal end to end with real testnet coins.
2. **Register deposit addresses.** `/admin wallet add kind:Deposit …` for every
   asset and network you enable. Add **several per rail**: an address is
   reserved per deal and a deal cannot start when the pool is empty.
3. **Choose a signer.** `SIGNER_BACKEND=manual` is recommended: the bot holds
   no keys, a middleman sends from a hardware wallet, and the bot verifies the
   hash on chain. Only use `external` once you have implemented the `Signer`
   interface for your signing service.
4. **Set the roles.** `/admin config roles` — the support role is the one users
   are told to tag, and the middleman role is the only one that can authorise a
   payout.
5. **Set confirmations for your amounts.** `CONFIRMATIONS_BTC` and friends are
   snapshotted onto each payment, so raising them protects new deals
   immediately and never retroactively unconfirms an old one.
6. **Read `SECURITY.md`**, especially the known limitations.
7. **Only then** set `LIVE_MODE=true`, `CHAIN_NETWORK_MODE=mainnet` and
   `LIVE_MODE_CONFIRMATION=I_UNDERSTAND_THIS_MOVES_REAL_FUNDS`. The bot refuses
   to start if any of these is inconsistent, or if a mock provider is still
   configured.

### Daily operation

| Situation                              | What to do                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A deal is stuck                        | `/deal status` in the ticket shows the state, the payment, the payout and every confirmation flag |
| Something needs attention              | `/admin deal list` shows disputed, review-required and failed deals                               |
| A dispute comes in                     | `/admin dispute claim`, investigate, then `/admin dispute resolve`                                |
| A payout is authorised (manual signer) | Send the funds, then `/admin payout sent txhash:…`                                                |
| The bot restarted mid-payout           | Reconciliation runs automatically on boot; `/admin payout reconcile` forces it                    |
| A buyer under-paid                     | The bot stops and pings support. Resolve it with the buyer; nothing is credited automatically     |

---

## Testing

```bash
npm test                 # the whole suite
npm run test:coverage    # with coverage
npm run check            # format + lint + typecheck + tests, as CI would
```

346 tests. The ones worth knowing about:

| File                        | Covers                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `payoutIdempotency.test.ts` | Ten concurrent broadcasts on one key produce exactly one send; a crash recovers by lookup            |
| `state.test.ts`             | Every illegal shortcut, and the **full reachable set** from `PAYOUT_REVIEW_REQUIRED`                 |
| `addressValidation.test.ts` | Real addresses, cross-chain and wrong-network rejection, checksum failures                           |
| `quotes.test.ts`            | USD→crypto conversion, always-up rounding, tamper detection on a stored quote                        |
| `security.test.ts`          | The mechanical invariants: no key columns, no floats in money, constraints present, secrets redacted |
| `dealLifecycle.test.ts`     | A whole deal driven through the services in flow order                                               |

---

## Project layout

```
src/
  bot/          Discord layer: commands, interactions, components, guards
  config/       env validation (zod), asset & network registry
  core/         money (Decimal), errors, logger, ids
  domain/       pure business logic: state machine, fees, quotes
  services/     application services: tickets, deals, payments, payouts, audit
  repositories/ Prisma data access
  infra/        Prisma client, Redis, locks, rate limiting
  prices/       PriceProvider interface + implementations
  chains/       ChainAdapter interface + per-chain adapters
  wallets/      Signer interface + signing backends
  workers/      payment monitor, payout reconciler, expiry, ticket closer
prisma/         database schema and migrations
tests/          unit and integration tests
docs/           architecture, state machine, interaction flow, security model
```

## Scripts

| Command                     | Does                                    |
| --------------------------- | --------------------------------------- |
| `npm run dev`               | Run with hot reload                     |
| `npm run build`             | Compile TypeScript to `dist/`           |
| `npm start`                 | Run the compiled bot                    |
| `npm test`                  | Run the test suite                      |
| `npm run check`             | Format check + lint + typecheck + tests |
| `npm run prisma:migrate`    | Create/apply a database migration       |
| `npm run prisma:studio`     | Browse the database                     |
| `npm run commands:register` | Register slash commands with Discord    |
