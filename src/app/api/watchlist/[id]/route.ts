import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PATCHABLE_FIELDS = [
  "market_hash_name",
  "label",
  "min_float",
  "max_float",
  "paint_seed",
  "active",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no updatable fields provided" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("watchlist_items")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("watchlist_items").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
