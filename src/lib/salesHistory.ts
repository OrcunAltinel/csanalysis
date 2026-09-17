import type { SupabaseClient } from "@supabase/supabase-js";

export const RECENT_SALES_LIMIT = 30;

/**
 * Prices of the most recent inferred sales (current_listings rows marked
 * removed_at) for an item. Used as the "rolling average" baseline instead of
 * every price snapshot from listings still sitting unsold in inventory --
 * reflects what actually sold recently, not just what's been listed.
 */
export async function getRecentSoldListings(
  supabase: SupabaseClient,
  watchlistItemId: string,
  limit: number = RECENT_SALES_LIMIT
) {
  const { data, error } = await supabase
    .from("current_listings")
    .select("listing_id, price, float_value, wear_name, seller_username, removed_at")
    .eq("watchlist_item_id", watchlistItemId)
    .not("removed_at", "is", null)
    .order("removed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export function averagePrice(prices: number[]): number | null {
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

// Below this many inferred sales, "last N sold" is too small a sample to be
// meaningful (e.g. a single sale could be an outlier) -- fall back to a
// time-windowed average of listed prices instead, so low-turnover items
// still get a usable number rather than "not enough data".
export const MIN_SOLD_SAMPLES = 3;
const FALLBACK_WINDOW_DAYS = 7;

export interface RollingAverage {
  avgPrice: number | null;
  sampleSize: number;
  /** "sold": real recent sales. "listed": fallback, includes unsold inventory. null: no data at all. */
  basis: "sold" | "listed" | null;
}

/**
 * The "rolling average" shown across the app: prefers actual recent sales
 * (more honest -- reflects what things went for, not what's sitting
 * unsold), but falls back to a 7-day window of listed prices when an item
 * hasn't sold enough yet to trust the sold-only average.
 */
export async function getRollingAverage(
  supabase: SupabaseClient,
  watchlistItemId: string,
  recentSold: { price: number }[]
): Promise<RollingAverage> {
  if (recentSold.length >= MIN_SOLD_SAMPLES) {
    return {
      avgPrice: averagePrice(recentSold.map((r) => r.price)),
      sampleSize: recentSold.length,
      basis: "sold",
    };
  }

  const since = new Date(Date.now() - FALLBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("price_snapshots")
    .select("price")
    .eq("watchlist_item_id", watchlistItemId)
    .gte("fetched_at", since);
  if (error) throw error;

  const prices = (data ?? []).map((row) => row.price as number);
  if (prices.length === 0) return { avgPrice: null, sampleSize: 0, basis: null };

  return { avgPrice: averagePrice(prices), sampleSize: prices.length, basis: "listed" };
}
