# csanalysis

Personal CS2/CS:GO skin price tracker for watchlisted items on [CSFloat](https://csfloat.com).
Polls the CSFloat API for a small, user-curated watchlist every few minutes, stores
price history in Supabase/Postgres, and shows price trend, deal-finder, and
float-vs-price views in a Next.js dashboard.

Single-user, no auth. All CSFloat and Supabase writes happen server-side.

## Stack

- Next.js 14 (App Router) + Tailwind + Recharts
- Supabase (Postgres) via the service-role key, server-side only
- Ingestion runs as a Next.js API route (`/api/ingest`), triggered by Supabase's
  `pg_cron` + `pg_net` extensions -- no third-party services required

## 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (free tier is enough).
2. In **Project Settings -> API**, copy the **Project URL** and the **service_role** key.
3. In the SQL editor (or via the CLI, see below), run the migration:
   `supabase/migrations/0001_init.sql`. This creates `watchlist_items`,
   `current_listings`, `price_snapshots`, and `ingest_log`, with RLS enabled and
   no policies (only the service-role key, used server-side, can read/write).

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

- Check the **Dashboard** page for the price history chart, float-vs-price
  scatter, and deal finder table for a selected item.

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
  **upserted** every poll -- it never grows with polling frequency, and rows
  for listings that stop appearing (sold/removed) are pruned after 30 minutes.
- `price_snapshots` is append-only, but a row is only inserted when a listing
  is new or its price/float actually changed since the last poll -- unchanged
  listings don't get a new row every few minutes.

## Data model

- `watchlist_items` -- skins to track, optionally scoped by float range and/or
  paint seed.
- `current_listings` -- latest known state of each active listing per item
  (feeds the deal-finder and float/price views).
- `price_snapshots` -- time-series price-change history per item, indexed by
  `(watchlist_item_id, fetched_at)` for range queries (feeds the trend chart).
- `ingest_log` -- one row per ingestion run, for monitoring cron health.

## Notes / known limitations

- CSFloat doesn't publish rate limits or fully document cursor pagination location;
  `src/lib/csfloat.ts` retries with backoff on 429/5xx and checks a couple of
  plausible cursor locations, capping at 4 pages (200 listings) per item per
  poll. If you see pagination behave oddly against the live API, check the
  actual response shape and adjust `fetchListingsForItem`.
- The price-history chart plots the cheapest listing per time bucket (hourly
  under 48h, daily otherwise) rather than every raw snapshot, since a single
  item can have several listings changing price independently.
