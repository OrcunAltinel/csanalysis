import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const watchlistItemId = searchParams.get("watchlist_item_id");
  const hours = Number(searchParams.get("hours") ?? "168");

  if (!watchlistItemId) {
    return NextResponse.json({ error: "watchlist_item_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("price_snapshots")
    .select("id, listing_id, price, float_value, wear_name, fetched_at")
    .eq("watchlist_item_id", watchlistItemId)
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: data });
}
