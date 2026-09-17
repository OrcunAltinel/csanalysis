import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const marketHashName = body?.market_hash_name;

  if (!marketHashName || typeof marketHashName !== "string") {
    return NextResponse.json({ error: "market_hash_name is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      market_hash_name: marketHashName,
      label: body.label || null,
      min_float: body.min_float ?? null,
      max_float: body.max_float ?? null,
      paint_seed: body.paint_seed ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
