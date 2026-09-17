import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRecentSoldListings, getRollingAverage } from "@/lib/salesHistory";

const DEAL_THRESHOLD = 0.9; // flag listings priced below 90% of the rolling average

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const watchlistItemId = searchParams.get("watchlist_item_id");

  if (!watchlistItemId) {
    return NextResponse.json({ error: "watchlist_item_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const [currentResult, recentSold] = await Promise.all([
    supabase
      .from("current_listings")
      .select("listing_id, price, float_value, wear_name, seller_username, last_seen_at")
      .eq("watchlist_item_id", watchlistItemId)
      .is("removed_at", null)
      .order("price", { ascending: true }),
    getRecentSoldListings(supabase, watchlistItemId),
  ]);

  if (currentResult.error) {
    return NextResponse.json({ error: currentResult.error.message }, { status: 500 });
  }

  const { avgPrice, sampleSize, basis } = await getRollingAverage(
    supabase,
    watchlistItemId,
    recentSold
  );

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
    sample_size: sampleSize,
    avg_basis: basis,
    listings,
    removed: recentSold,
  });
}
