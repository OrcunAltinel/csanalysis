import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEAL_THRESHOLD = 0.9; // flag listings priced below 90% of the rolling average

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const watchlistItemId = searchParams.get("watchlist_item_id");
  const windowDays = Number(searchParams.get("window_days") ?? "7");

  if (!watchlistItemId) {
    return NextResponse.json({ error: "watchlist_item_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const [currentResult, removedResult, avgResult] = await Promise.all([
    supabase
      .from("current_listings")
      .select("listing_id, price, float_value, wear_name, seller_username, last_seen_at")
      .eq("watchlist_item_id", watchlistItemId)
      .is("removed_at", null)
      .order("price", { ascending: true }),
    supabase
      .from("current_listings")
      .select("listing_id, price, float_value, wear_name, seller_username, removed_at")
      .eq("watchlist_item_id", watchlistItemId)
      .not("removed_at", "is", null)
      .order("removed_at", { ascending: false })
      .limit(20),
    supabase
      .from("price_snapshots")
      .select("price")
      .eq("watchlist_item_id", watchlistItemId)
      .gte("fetched_at", since),
  ]);

  if (currentResult.error) {
    return NextResponse.json({ error: currentResult.error.message }, { status: 500 });
  }
  if (removedResult.error) {
    return NextResponse.json({ error: removedResult.error.message }, { status: 500 });
  }
  if (avgResult.error) {
    return NextResponse.json({ error: avgResult.error.message }, { status: 500 });
  }

  const prices = (avgResult.data ?? []).map((row) => row.price as number);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const listings = (currentResult.data ?? []).map((listing) => {
    const price = listing.price as number;
    const deltaFromAvg = avgPrice != null ? price - avgPrice : null;
    const pctFromAvg = avgPrice ? (price - avgPrice) / avgPrice : null;
    return {
      ...listing,
      delta_from_avg: deltaFromAvg,
      pct_from_avg: pctFromAvg,
      is_deal: avgPrice != null ? price < avgPrice * DEAL_THRESHOLD : false,
    };
  });

  return NextResponse.json({
    avg_price: avgPrice,
    sample_size: prices.length,
    listings,
    removed: removedResult.data ?? [],
  });
}
