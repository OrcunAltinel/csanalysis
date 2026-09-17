"use client";

import type { WatchlistItem } from "@/lib/types";

export default function ItemSelector({
  items,
  selectedId,
  onChange,
}: {
  items: WatchlistItem[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No watchlist items yet. Add one on the{" "}
        <a href="/watchlist" className="underline">
          Watchlist
        </a>{" "}
        page to see charts here.
      </p>
    );
  }

  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
    >
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label || item.market_hash_name}
        </option>
      ))}
    </select>
  );
}
