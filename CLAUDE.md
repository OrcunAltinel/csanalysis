# csanalysis

Personal, single-user CS2/CS:GO skin price tracker for watchlisted items on
[CSFloat](https://csfloat.com). Polls the CSFloat API for a small user-curated
watchlist every few minutes, stores price history in Supabase/Postgres, and
shows price trend, deal-finder, and float-vs-price views in a Next.js
dashboard. No auth, no multi-tenancy — built for one person.

## Stack

- Next.js 14 (App Router, pinned at **14.2.35** — see "Key decisions" below)
- Tailwind CSS, Recharts
- Supabase (Postgres) accessed only via the **service-role key, server-side**
- Ingestion runs as a Next.js API route, triggered by Supabase's own
  `pg_cron` + `pg_net` extensions (no third-party scheduler)

## Architecture

```
CSFloat API  <--(server-side fetch, retry/backoff)--  src/lib/csfloat.ts
                                                              |
                                                        src/lib/ingest.ts
                                                              |
                                                     Supabase (service role)
                                                    /                      \
                                     current_listings                price_snapshots
                                     (upserted, bounded)          (append-only, change-only)
                                                    \                      /
                                              src/app/api/{deals,snapshots}/route.ts
                                                              |
                                                   Dashboard components (Recharts)
```

- **Browser never talks to Supabase directly.** Every read/write goes through
  a Next.js API route using `src/lib/supabaseAdmin.ts` (service-role key).
  RLS is enabled on every table with **no policies**, so even a leaked
  anon/public key can't touch the data.
- **CSFloat key is never exposed client-side** — only used inside
  `src/lib/csfloat.ts`, called from `src/lib/ingest.ts`, called from
  `src/app/api/ingest/route.ts`.

### Data model

- `watchlist_items` — skins to track, optionally scoped by float range and/or
  paint seed.
- `current_listings` — latest known state of each active CSFloat listing per
  item. **Upserted** every poll (bounded size). A listing that stops
  appearing gets `removed_at` set immediately (an *inferred* sold/delisted
  signal — CSFloat's API never reports actual sales, only current listings),
  and rows are hard-deleted 30 days after `removed_at` to keep the table
  bounded. Active rows (`removed_at is null`) feed the deal-finder table and
  float/price scatter; recently-removed rows feed the "recently sold /
  delisted" list.
- `price_snapshots` — append-only price-change history. A row is inserted
  **only** when a listing is new or its price/float changed since the last
  poll — this is the dedup mechanism that keeps storage well under the
  Supabase free-tier 500 MB limit. Feeds the price-history chart.
- `ingest_log` — one row per ingestion run (counts + errors), for checking
  cron health.

### Key files

| File | Purpose |
|---|---|
| `supabase/migrations/0001_init.sql` | Full schema, indexes, RLS |
| `supabase/sql/schedule_ingest_cron.sql` | Manual, post-deploy: schedules `/api/ingest` via pg_cron+pg_net |
| `src/lib/csfloat.ts` | CSFloat REST client: pagination, retry/backoff on 429/5xx |
| `src/lib/ingest.ts` | Orchestrates one ingestion run: fetch -> filter -> dedup -> write |
| `src/lib/supabaseAdmin.ts` | Server-only Supabase client (service role) |
| `src/app/api/ingest/route.ts` | Cron entry point, guarded by `CRON_SECRET` |
| `src/app/api/watchlist/**` | Watchlist CRUD |
| `src/app/api/{snapshots,deals}/route.ts` | Read APIs for the dashboard |
| `src/app/page.tsx` | Dashboard (stats strip + chart + scatter + deal table) |
| `src/app/watchlist/page.tsx` | Watchlist management UI |
| `src/lib/metrics.ts` | Pure heuristic calculations: 24h/7d/30d price-change trend, volatility (coefficient of variation), and the 0-100 opportunity score |
| `src/app/api/opportunities/route.ts` | Computes lowest/avg price, price-change windows, liquidity, volatility, and opportunity score per watchlist item; sorted desc by score |
| `src/app/opportunities/page.tsx` | Ranked, filterable (price/weapon/skin/wear/score) view across the watchlist |
| `src/lib/skinName.ts` | Best-effort `market_hash_name` -> {weapon, skin, wear} parser backing the Opportunities filters (no catalog, just string structure) |

## Key decisions (don't relitigate without a reason)

- **Next.js pinned at 14.2.35, not upgraded to 16.** `npm audit` flags CVEs
  only fully patched in Next 16, but that's a breaking major version (async
  `params` in route handlers, etc.). User explicitly chose to stay on 14.x
  given this is a low-traffic personal tool, not upgrade blindly. Revisit if
  this app ever becomes multi-user or publicly exposed.
- **Ingestion is a Next.js API route + Supabase `pg_cron`/`pg_net`**, not a
  Deno Edge Function, and not Vercel Cron. Reasoning: Vercel's free tier only
  allows daily cron (too infrequent for "every few minutes"); pg_cron keeps
  everything inside Supabase with no extra paid service.
- **Two-table split (`current_listings` + `price_snapshots`)** instead of one
  time-series table, specifically to satisfy "avoid unnecessary duplicate
  storage" — a naive append-every-poll design would blow past free-tier
  storage fast at few-minute polling intervals.
- **CSFloat's pagination cursor location is undocumented** (confirmed via
  their own docs site — they don't say whether it's a response header or
  body field). `fetchListingsForItem` in `src/lib/csfloat.ts` defensively
  checks a few plausible locations and caps at 4 pages (200 listings) per
  item per poll. If real traffic shows pagination behaving oddly, inspect a
  live response and adjust.
- **Opportunity scoring stays scoped to the curated watchlist** — it does not
  search or rank the whole CSFloat catalog. A market-wide scanner needs
  on-demand CSFloat search, scoring across many items, and its own rate-limit
  strategy; that's a different architecture from "poll a small fixed list,"
  and was explicitly deferred. The score itself (`src/lib/metrics.ts`) is a
  heuristic blend of discount/momentum/liquidity/volatility with hand-picked
  weights and saturation points — not derived from historical outcome data,
  and never to be presented as a prediction or profit guarantee.

## Environment variables

See `.env.example` for the full list with descriptions. Never put real values
in `.env.example` — it's a committed template. Real values belong only in
`.env.local` (gitignored).

Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`CSFLOAT_API_KEY`, `CRON_SECRET`.

## Commands

```bash
npm install
npm run dev      # local dev server
npm run build    # production build + type-check + lint
```

Manually trigger ingestion (dev):

```bash
curl -X POST http://localhost:3000/api/ingest -H "Authorization: Bearer $CRON_SECRET"
```

## Setup / deployment status

Environment on the primary dev machine (Windows):

- [x] Node.js installed via `winget install OpenJS.NodeJS.LTS` (v24.19.0,
      npm 11.17.0). It wasn't present initially — if `npm`/`node` are
      "not recognized" in a terminal, that terminal predates the PATH
      update; open a **brand-new** terminal window (PowerShell/cmd only read
      PATH at process start).
- [x] `npm install` run, `npm run build` verified clean (compiles, type
      -checks, and lints with no errors).
- [x] Supabase project created; `0001_init.sql` applied. Verified via a
      direct REST call that all four tables exist (currently all empty —
      no watchlist items added yet, no ingestion runs yet).
- [x] `.env.local` populated with real Supabase + CSFloat credentials
      (gitignored, not committed).

Still to do:

- [ ] Add a real skin to the watchlist via the `/watchlist` page (exact
      `market_hash_name` — check CSFloat for the precise string).
- [ ] Manually POST to `/api/ingest` once and confirm rows land in
      `current_listings` / `price_snapshots` (check `ingest_log` for errors).
- [ ] Deploy the app somewhere reachable over HTTPS (e.g. Vercel free tier),
      with the same env vars set there.
- [ ] Fill in and run `supabase/sql/schedule_ingest_cron.sql` in the Supabase
      SQL editor (needs the deployed URL + `CRON_SECRET`) to start scheduled
      polling every few minutes.
- [ ] After a few scheduled runs, check `ingest_log` and `current_listings`
      to confirm the cron is actually firing and succeeding.
- [ ] Nothing in this repo has been committed to git yet — everything is
      currently untracked working-tree state.

## Gotchas already hit once

- Real secrets were briefly pasted into `.env.example` instead of
  `.env.local` — caught before anything was committed, fixed. Always double
  -check which `.env*` file you're editing; only `.env.local`/`.env` are
  gitignored.
