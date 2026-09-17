import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { opportunityScore, priceChangePct, volatilityPct } from "@/lib/metrics";
import { getRecentSoldListings, getRollingAverage } from "@/lib/salesHistory";

export const dynamic = "force-dynamic";

const HISTORY_WINDOW_DAYS = 30;
const LIQUIDITY_WINDOW_DAYS = 7;
const VOLATILITY_WINDOW_HOURS = 24 * 7;

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: items, error: itemsError } = await supabase
    .from("watchlist_items")
    .select("id, market_hash_name, label")
    .eq("active", true);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const historySince = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const liquiditySince = new Date(
    Date.now() - LIQUIDITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Processed sequentially, not fanned out with Promise.all across items --
  // firing many concurrent queries off the one shared Supabase client here
  // was observed to intermittently return stale/wrong results for some
  // items (see git history). This app's watchlist is small, so the
  // sequential cost is negligible.
  const opportunities = [];
  for (const item of items ?? []) {
    const [snapshotsRes, activeRes, recentSold, removedRes] = await Promise.all([
      supabase
        .from("price_snapshots")
        .select("price, fetched_at")
        .eq("watchlist_item_id", item.id)
        .gte("fetched_at", historySince)
        .order("fetched_at", { ascending: true })
        .limit(5000),
      supabase
        .from("current_listings")
        .select("price, wear_name")
        .eq("watchlist_item_id", item.id)
        .is("removed_at", null)
        .order("price", { ascending: true }),
      getRecentSoldListings(supabase, item.id),
      supabase
        .from("current_listings")
        .select("listing_id", { count: "exact", head: true })
        .eq("watchlist_item_id", item.id)
        .not("removed_at", "is", null)
        .gte("removed_at", liquiditySince),
    ]);

    if (snapshotsRes.error) throw snapshotsRes.error;
    if (activeRes.error) throw activeRes.error;
    if (removedRes.error) throw removedRes.error;

    const snapshots = snapshotsRes.data ?? [];
    const activeListings = activeRes.data ?? [];
    const liquidityCount = removedRes.count ?? 0;

    const lowestPrice = activeListings.length ? (activeListings[0].price as number) : null;

    const { avgPrice, basis: avgBasis } = await getRollingAverage(
      supabase,
      item.id,
      recentSold
    );
    const pctFromAvg =
      lowestPrice != null && avgPrice ? (lowestPrice - avgPrice) / avgPrice : null;

    const change24h = priceChangePct(snapshots, 24);
    const change7d = priceChangePct(snapshots, 24 * 7);
    const change30d = priceChangePct(snapshots, 24 * 30);
    const volatility7d = volatilityPct(snapshots, VOLATILITY_WINDOW_HOURS);

    const breakdown = opportunityScore({
      pctFromAvg,
      momentumPct: change7d,
      liquidityCount,
      volatility: volatility7d,
    });

    opportunities.push({
      watchlist_item_id: item.id as string,
      market_hash_name: item.market_hash_name as string,
      label: item.label as string | null,
      lowest_price: lowestPrice,
      avg_price: avgPrice,
      avg_basis: avgBasis,
      pct_from_avg: pctFromAvg,
      change_24h: change24h,
      change_7d: change7d,
      change_30d: change30d,
      liquidity_7d: liquidityCount,
      volatility_7d: volatility7d,
      active_listing_count: activeListings.length,
      wear_name: (activeListings[0]?.wear_name as string | null) ?? null,
      opportunity_score: breakdown.score,
      score_breakdown: breakdown,
    });
  }

  opportunities.sort((a, b) => (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1));

  return NextResponse.json({ opportunities });
}
