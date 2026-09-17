import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchListingsForItem, CsfloatListing } from "@/lib/csfloat";
import type { IngestSummary } from "@/lib/types";

interface WatchlistItemRow {
  id: string;
  market_hash_name: string;
  min_float: number | null;
  max_float: number | null;
  paint_seed: number | null;
}

const REMOVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // keep removed/sold listings 30 days for history, then prune

function matchesFilter(listing: CsfloatListing, item: WatchlistItemRow): boolean {
  const floatValue = listing.item?.float_value;
  if (item.min_float != null && (floatValue == null || floatValue < item.min_float)) return false;
  if (item.max_float != null && (floatValue == null || floatValue > item.max_float)) return false;
  if (item.paint_seed != null && listing.item?.paint_seed !== item.paint_seed) return false;
  return true;
}

/**
 * Polls CSFloat for every active watchlist item and writes the results to
 * Supabase. `current_listings` is upserted (bounded, always fresh);
 * `price_snapshots` only gets a new row when a listing is new or its price
 * changed, to avoid storing duplicate unchanged snapshots every poll.
 */
export async function runIngestion(): Promise<IngestSummary> {
  const supabase = getSupabaseAdmin();
  const apiKey = process.env.CSFLOAT_API_KEY;
  if (!apiKey) throw new Error("CSFLOAT_API_KEY is not set");

  const { data: logRow, error: logInsertError } = await supabase
    .from("ingest_log")
    .insert({ started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (logInsertError) throw logInsertError;

  const summary: IngestSummary = {
    itemsProcessed: 0,
    listingsSeen: 0,
    snapshotsInserted: 0,
    errors: [],
  };

  const { data: items, error: itemsError } = await supabase
    .from("watchlist_items")
    .select("id, market_hash_name, min_float, max_float, paint_seed")
    .eq("active", true);
  if (itemsError) throw itemsError;

  for (const item of (items ?? []) as WatchlistItemRow[]) {
    try {
      await ingestOneItem(item, apiKey, summary);
      summary.itemsProcessed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${item.market_hash_name}: ${message}`);
    }
  }

  await supabase
    .from("ingest_log")
    .update({
      finished_at: new Date().toISOString(),
      items_processed: summary.itemsProcessed,
      listings_seen: summary.listingsSeen,
      snapshots_inserted: summary.snapshotsInserted,
      errors: summary.errors.length ? summary.errors : null,
      ok: summary.errors.length === 0,
    })
    .eq("id", logRow.id);

  return summary;
}

async function ingestOneItem(
  item: WatchlistItemRow,
  apiKey: string,
  summary: IngestSummary
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const listings = await fetchListingsForItem(
    {
      marketHashName: item.market_hash_name,
      minFloat: item.min_float,
      maxFloat: item.max_float,
      paintSeed: item.paint_seed,
    },
    apiKey
  );

  const filtered = listings.filter((listing) => matchesFilter(listing, item));
  summary.listingsSeen += filtered.length;
  if (filtered.length === 0) return;

  const listingIds = filtered.map((listing) => listing.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("current_listings")
    .select("listing_id, price, float_value, removed_at")
    .eq("watchlist_item_id", item.id);
  if (existingError) throw existingError;

  const existingByListingId = new Map(
    (existingRows ?? []).map((row) => [row.listing_id as string, row])
  );

  const now = new Date().toISOString();
  const upserts = [];
  const newSnapshots = [];

  for (const listing of filtered) {
    const price = listing.price;
    const floatValue = listing.item?.float_value ?? null;
    const previous = existingByListingId.get(listing.id);
    const changed = !previous || previous.price !== price || previous.float_value !== floatValue;

    upserts.push({
      listing_id: listing.id,
      watchlist_item_id: item.id,
      price,
      float_value: floatValue,
      wear_name: listing.item?.wear_name ?? null,
      paint_seed: listing.item?.paint_seed ?? null,
      seller_steam_id: listing.seller?.steam_id ?? null,
      seller_username: listing.seller?.username ?? null,
      item_type: listing.item?.market_hash_name ?? item.market_hash_name,
      last_seen_at: now,
      removed_at: null,
    });

    if (changed) {
      newSnapshots.push({
        watchlist_item_id: item.id,
        listing_id: listing.id,
        price,
        float_value: floatValue,
        wear_name: listing.item?.wear_name ?? null,
        paint_seed: listing.item?.paint_seed ?? null,
        seller_steam_id: listing.seller?.steam_id ?? null,
        fetched_at: now,
      });
    }
  }

  const { error: upsertError } = await supabase
    .from("current_listings")
    .upsert(upserts, { onConflict: "listing_id" });
  if (upsertError) throw upsertError;

  if (newSnapshots.length > 0) {
    const { error: insertError } = await supabase.from("price_snapshots").insert(newSnapshots);
    if (insertError) throw insertError;
    summary.snapshotsInserted += newSnapshots.length;
  }

  // Listings that were active before but didn't show up in this poll have
  // disappeared -- mark when, as an inferred sold/delisted signal, instead
  // of deleting immediately. This is the only "sold" signal CSFloat gives
  // us: it never reports actual sales, only current listings.
  const seenIds = new Set(listingIds);
  const disappearedIds = (existingRows ?? [])
    .filter((row) => row.removed_at == null && !seenIds.has(row.listing_id as string))
    .map((row) => row.listing_id as string);

  if (disappearedIds.length > 0) {
    const { error: markRemovedError } = await supabase
      .from("current_listings")
      .update({ removed_at: now })
      .in("listing_id", disappearedIds);
    if (markRemovedError) throw markRemovedError;
  }

  // Hard-delete listings that have been marked removed for a while, so the
  // table doesn't grow unbounded while still keeping recent sell history.
  const retentionBefore = new Date(Date.now() - REMOVED_RETENTION_MS).toISOString();
  const { error: pruneError } = await supabase
    .from("current_listings")
    .delete()
    .eq("watchlist_item_id", item.id)
    .lt("removed_at", retentionBefore);
  if (pruneError) throw pruneError;
}
