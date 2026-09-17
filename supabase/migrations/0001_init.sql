-- csanalysis: initial schema
-- Watchlist-scoped CS2/CS:GO skin price tracking against the CSFloat API.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- watchlist_items: the skins (optionally float/pattern-scoped) we poll for.
-- ---------------------------------------------------------------------------
create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  market_hash_name text not null,
  label text,
  min_float numeric(10, 8),
  max_float numeric(10, 8),
  paint_seed integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_watchlist_items_active on watchlist_items (active);

comment on table watchlist_items is 'User-curated list of skins (optionally scoped by float range / paint seed) to poll on CSFloat.';

-- ---------------------------------------------------------------------------
-- current_listings: latest known state of each active listing per watchlist
-- item. Upserted every ingestion run so it never grows unbounded, and rows
-- for listings that stop appearing are pruned by the ingestion job. This is
-- what the "deal finder" and "float vs price" views read from.
-- ---------------------------------------------------------------------------
create table if not exists current_listings (
  listing_id text primary key,
  watchlist_item_id uuid not null references watchlist_items (id) on delete cascade,
  price integer not null,
  float_value numeric(10, 8),
  wear_name text,
  paint_seed integer,
  seller_steam_id text,
  seller_username text,
  item_type text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_current_listings_item on current_listings (watchlist_item_id);
create index if not exists idx_current_listings_last_seen on current_listings (last_seen_at);

comment on table current_listings is 'Latest observed state per active CSFloat listing_id. Upserted, not appended, to bound storage.';

-- ---------------------------------------------------------------------------
-- price_snapshots: append-only price-change history, one row per listing
-- only when it is first seen or its price/float actually changes. This is
-- the time-series that price-history charts read from.
-- ---------------------------------------------------------------------------
create table if not exists price_snapshots (
  id bigint generated always as identity primary key,
  watchlist_item_id uuid not null references watchlist_items (id) on delete cascade,
  listing_id text not null,
  price integer not null,
  float_value numeric(10, 8),
  wear_name text,
  paint_seed integer,
  seller_steam_id text,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_price_snapshots_item_time on price_snapshots (watchlist_item_id, fetched_at desc);
create index if not exists idx_price_snapshots_listing on price_snapshots (listing_id, fetched_at desc);

comment on table price_snapshots is 'Append-only price-change log. A row is inserted only when a listing is new or its price/float differs from the last known value.';

-- ---------------------------------------------------------------------------
-- ingest_log: one row per ingestion run, for observing whether the
-- scheduled job is actually running and succeeding.
-- ---------------------------------------------------------------------------
create table if not exists ingest_log (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_processed integer,
  listings_seen integer,
  snapshots_inserted integer,
  errors jsonb,
  ok boolean
);

create index if not exists idx_ingest_log_started_at on ingest_log (started_at desc);

comment on table ingest_log is 'One row per scheduled ingestion run, for monitoring cron health.';

-- ---------------------------------------------------------------------------
-- RLS: enabled with no policies. This app is single-user and never talks to
-- Supabase from the browser -- all reads/writes go through Next.js API
-- routes using the service role key, which bypasses RLS. Enabling RLS with
-- no policies means the anon/authenticated keys can't touch these tables
-- even if one leaked.
-- ---------------------------------------------------------------------------
alter table watchlist_items enable row level security;
alter table current_listings enable row level security;
alter table price_snapshots enable row level security;
alter table ingest_log enable row level security;
