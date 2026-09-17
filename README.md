# csanalysis

A personal price-tracking and deal-finding tool for CS2/CS:GO skins, built on
top of [CSFloat](https://csfloat.com)'s marketplace API. It polls a
user-curated watchlist every few minutes, stores price history in
Postgres, and surfaces trends, deal signals, and a heuristic "opportunity
score" in a Next.js dashboard.

Single-user, no auth — built to run against one person's own watchlist, not
as a multi-tenant product.

## Features

- **Watchlist-driven ingestion** — track specific skins (optionally scoped by
  float range and/or paint seed), polled on a schedule against the live
  CSFloat API.
- **Deal finder** — current listings for an item compared against its rolling
  7-day average price, with below-average listings flagged.
- **Price history** — a cheapest-listing trend chart per item, with bucket
  granularity that adapts to how much history actually exists (hourly for a
  fresh item, daily once it has real multi-day history).
- **Float vs. price scatter** — spot underpriced listings at a given wear/float.
- **Inferred sell tracking** — CSFloat's API only reports what's currently for
  sale, never actual sales. This app infers a "sold/delisted" event when a
  listing disappears from polling, and surfaces it as approximate sell history
  rather than pretending it's confirmed.
- **Opportunity scoring** — a 0-100 heuristic per watchlist item, blending
  price discount vs. average, recent momentum, liquidity (inferred sales in
  the last 7 days), and volatility. Explicitly **not** a prediction or a
  profit guarantee — it's a ranking aid over your own watchlist, with the
  weighting fully visible and tunable in `src/lib/metrics.ts`.
- **Ranked, filterable opportunities view** — all watchlist items ranked by
  score, filterable by price, weapon, skin, wear, and minimum score.

## Stack

- Next.js 14 (App Router) + Tailwind + Recharts
- Supabase (Postgres) via the service-role key, server-side only — the
  browser never talks to Supabase directly, and RLS is enabled with no
  policies as a second layer of protection
- Ingestion runs as a Next.js API route (`/api/ingest`), triggered by
  Supabase's own `pg_cron` + `pg_net` extensions — no third-party scheduler

## A few engineering decisions worth calling out

- **Two-table storage split** (`current_listings`, upserted, bounded, vs.
  `price_snapshots`, append-only but change-only) instead of one time-series
  table — a naive append-every-poll design would blow past Supabase's
  free-tier storage limit at few-minute polling intervals.
- **`pg_cron` + `pg_net` over Vercel Cron or a Deno Edge Function** — Vercel's
  free tier only supports daily cron jobs, too infrequent for "poll every few
  minutes"; keeping scheduling inside Supabase avoids a third paid service.
- **Pinned to Next.js 14.2.35**, not the latest major — a deliberate call for
  a low-traffic personal tool, revisited only if this ever becomes
  multi-user or publicly exposed. `npm audit` findings here are known and
  accepted, not overlooked.

## 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (free tier is enough).
2. In **Project Settings -> API**, copy the **Project URL** and the **service_role** key.
3. In the SQL editor (or via the CLI, see below), run the migrations in order:
   `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_removed_at.sql`.
   This creates `watchlist_items`, `current_listings`, `price_snapshots`, and
   `ingest_log`, with RLS enabled and no policies (only the service-role key,
   used server-side, can read/write).

Using the Supabase CLI instead:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## 2. Get a CSFloat API key

`csfloat.com/profile` -> **Developer** tab -> **New Key**. Sent as a raw
`Authorization` header (no `Bearer` prefix) -- already handled in `src/lib/csfloat.ts`.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CSFLOAT_API_KEY`,
and a random `CRON_SECRET` (used to authorize calls to `/api/ingest`).

## 4. Run locally

```bash
npm install
npm run dev
```

- Add skins on the **Watchlist** page (exact `market_hash_name`, optional float
  range / paint seed).
- Trigger an ingestion run manually while developing:

  ```bash
  curl -X POST http://localhost:3000/api/ingest \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

  (In development, if `CRON_SECRET` is unset, the route accepts unauthenticated
  requests -- set it before deploying.)

- Check the **Dashboard** page for per-item stats, the price history chart,
  float-vs-price scatter, and deal finder table.
- Check the **Opportunities** page for all watchlist items ranked by score,
  with filters.

## 5. Deploy and schedule ingestion

Deploy the Next.js app anywhere that can reach the internet over HTTPS (e.g.
Vercel free tier). Set the same env vars there.

Then schedule polling from inside Supabase, so no extra paid cron service is
needed:

1. Open the SQL editor on your Supabase project.
2. Edit `supabase/sql/schedule_ingest_cron.sql`, filling in your deployed app
   URL and `CRON_SECRET`.
3. Run it. This enables `pg_cron` + `pg_net` and schedules a POST to
   `/api/ingest` every 5 minutes (edit the cron expression to change frequency).

Check `select * from ingest_log order by started_at desc limit 20;` to confirm
runs are succeeding, or `select * from cron.job_run_details order by start_time desc limit 20;`
for the scheduler's own run history.

### Alternative schedulers

`pg_cron` + `pg_net` is the default because it needs nothing beyond Supabase.
If you'd rather not enable those extensions, any external pinger that can POST
a URL with a header on an interval works too (e.g. a free account on
cron-job.org) -- just point it at `<your-app-url>/api/ingest` with
`Authorization: Bearer <CRON_SECRET>`.

## How ingestion avoids duplicate storage

- `current_listings` holds one row per currently-active CSFloat listing and is
  **upserted** every poll -- it never grows with polling frequency. When a
  listing stops appearing, it's marked with `removed_at` (an inferred
  sold/delisted signal) rather than deleted immediately, and only hard-deleted
  30 days later -- long enough to be useful as sell history, short enough to
  stay bounded.
- `price_snapshots` is append-only, but a row is only inserted when a listing
  is new or its price/float actually changed since the last poll -- unchanged
  listings don't get a new row every few minutes.

## Data model

- `watchlist_items` -- skins to track, optionally scoped by float range and/or
  paint seed.
- `current_listings` -- latest known state of each listing per item, active
  (`removed_at is null`) or recently removed. Feeds the deal-finder,
  float/price scatter, and recently-sold views.
- `price_snapshots` -- time-series price-change history per item, indexed by
  `(watchlist_item_id, fetched_at)` for range queries (feeds the trend chart
  and the opportunity-score calculations).
- `ingest_log` -- one row per ingestion run, for monitoring cron health.

## Notes / known limitations

- CSFloat doesn't publish rate limits or fully document cursor pagination location;
  `src/lib/csfloat.ts` retries with backoff on 429/5xx and checks a couple of
  plausible cursor locations, capping at 4 pages (200 listings) per item per
  poll. If you see pagination behave oddly against the live API, check the
  actual response shape and adjust `fetchListingsForItem`.
- The price-history chart plots the cheapest listing per time bucket (hourly
  when the item's actual history spans under 48h, daily otherwise) rather than
  every raw snapshot, since a single item can have several listings changing
  price independently.
- "Sold" data is inferred, not confirmed. CSFloat's API never reports an
  actual sale — only what's currently listed. A listing disappearing usually
  means it sold, but could also mean it was delisted or edited. Treat
  `removed_at` and the opportunity score's liquidity input accordingly.
- Opportunity scoring is a hand-weighted heuristic (see `src/lib/metrics.ts`
  for the exact formula and tunable constants), not a model trained on
  outcomes. It's scoped to your own watchlist, not a market-wide scan of all
  CS2 skins.
