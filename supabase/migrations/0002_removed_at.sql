-- csanalysis: track when a listing disappears from CSFloat (inferred
-- sold/delisted event), instead of silently hard-deleting it.
--
-- CSFloat's API only reports what's currently for sale -- it never reports
-- an actual sale. "removed_at" is therefore an *inferred* signal: the
-- listing stopped appearing in polls, which usually means it sold, but may
-- also mean the seller delisted or edited it. There is no way to tell these
-- apart from the CSFloat API alone.

alter table current_listings
  add column if not exists removed_at timestamptz;

create index if not exists idx_current_listings_removed_at on current_listings (removed_at);

comment on column current_listings.removed_at is
  'Set when a listing stops appearing in a poll (inferred sold/delisted time). Null while still active. Rows are hard-deleted a retention window after this is set.';
