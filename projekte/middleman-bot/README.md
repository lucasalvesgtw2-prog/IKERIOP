# Middleman / Escrow Bot

A Discord-based crypto middleman (escrow) bot. Two users open a private ticket,
agree a deal, the buyer pays into escrow, both confirm completion, and the funds
are released to the seller.

> **The canonical value of every deal is USD.** Cryptocurrency is only the
> payment rail. A deal is `$100.00`, never `0.001 BTC`.

> **Default middleman fee: 5%.** `$100.00` deal → `$5.00` fee → buyer pays `$105.00`.

---

## Status

Phases 1–6 of 17 are complete. The bot builds, starts, and carries a deal from
opening a ticket through to the buyer's approval of the agreed USD price;
216 tests pass.

| Phase | Scope                                                                        | State              |
| ----- | ---------------------------------------------------------------------------- | ------------------ |
| 1     | Architecture, project structure, money engine, state machine, schema, Docker | ✅ done            |
| 2     | Discord ticket system                                                        | ✅ done            |
| 3     | Buyer/Seller role system                                                     | ✅ done            |
| 4     | Deal details + buyer approval                                                | ✅ done            |
| 5     | Crypto selection + USD calculation                                           | ✅ done            |
| 6     | Price provider + payment request                                             | ✅ done            |
| 7     | Blockchain payment monitoring                                                | next               |
| 8     | Deal completion confirmation                                                 | planned            |
| 9     | Payout address + validation                                                  | planned            |
| 10    | Secure payout system                                                         | planned            |
| 11    | Seller receipt confirmation                                                  | planned            |
| 12    | Dispute system                                                               | planned            |
| 13    | Database + audit logging                                                     | planned            |
| 14    | Security hardening + `SECURITY.md`                                           | planned            |
| 15    | Tests                                                                        | ongoing each phase |
| 16    | Docker + Windows setup                                                       | ✅ done            |
| 17    | Final documentation                                                          | planned            |

### What works today

- `/setup` posts the public panel with the **🎫 Open Middleman Ticket** button (admin only, checked server-side).
- `/ticket` offers the same button privately.
- Clicking it creates a private channel `middleman-0001` and deal `MM-0001`, visible only to the opener, staff roles and the bot.
- The ticket receives the support welcome message, which always tells users they can tag the configured support role, and warns never to send funds to an address posted outside the ticket.
- **👤 Add Deal Partner** opens a user picker for the ticket creator. The selection is validated server-side — not yourself, not a bot, not a banned user, must be a member of this server — and the partner is granted access to the channel.
- The bot then asks **who is the Buyer**. The seller is derived as the other participant, so "the same person is both" cannot even be expressed, and is rejected again on the server.
- **🔄 Swap Buyer / Seller** stays available until the seller submits deal details.
- **📝 Enter Deal Details** opens a modal for the seller: Item / Service, Description, Additional Terms, and **Deal Amount in USD**. The amount is parsed as US Dollars; `0.001 BTC` and `100 USDT` are rejected with a message that says exactly why. Minimum and maximum deal amounts are enforced.
- The bot posts the **deal summary** — Deal Value, Middleman Fee, **Buyer Pays** and Seller Receives, all in USD, so the buyer knows the total _before_ agreeing. Everything the seller typed is escaped, so it cannot imitate the bot's own formatting.
- **✅ Confirm Deal** / **❌ Request Changes** — only the buyer's click is accepted. A change request collects a written reason, sends the deal back to the seller with the previous values pre-filled, and stores a new revision. **The old approval never carries over: every revision must be approved again.**

Currency selection is the next step and answers "not available yet" until Phase 5.

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
