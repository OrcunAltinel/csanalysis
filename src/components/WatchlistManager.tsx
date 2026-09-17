"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  createWatchlistItem,
  deleteWatchlistItem,
  fetchWatchlist,
  updateWatchlistItem,
} from "@/lib/api";
import type { WatchlistItem } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const emptyForm = {
  market_hash_name: "",
  label: "",
  min_float: "",
  max_float: "",
  paint_seed: "",
};

export default function WatchlistManager() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchWatchlist()
      .then(({ items }) => setItems(items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.market_hash_name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createWatchlistItem({
        market_hash_name: form.market_hash_name.trim(),
        label: form.label.trim() || null,
        min_float: form.min_float ? Number(form.min_float) : null,
        max_float: form.max_float ? Number(form.max_float) : null,
        paint_seed: form.paint_seed ? Number(form.paint_seed) : null,
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: WatchlistItem) {
    await updateWatchlistItem(item.id, { active: !item.active });
    load();
  }

  async function remove(item: WatchlistItem) {
    if (!confirm(`Remove "${item.label || item.market_hash_name}" from the watchlist?`)) return;
    await deleteWatchlistItem(item.id);
    load();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          required
          placeholder="Market hash name (exact)"
          value={form.market_hash_name}
          onChange={(e) => setForm({ ...form, market_hash_name: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm lg:col-span-2"
        />
        <input
          placeholder="Label (optional)"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <input
          placeholder="Min float (optional)"
          value={form.min_float}
          onChange={(e) => setForm({ ...form, min_float: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <input
          placeholder="Max float (optional)"
          value={form.max_float}
          onChange={(e) => setForm({ ...form, max_float: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <input
          placeholder="Paint seed (optional)"
          value={form.paint_seed}
          onChange={(e) => setForm({ ...form, paint_seed: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add to watchlist"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing on the watchlist yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Float range</th>
                <th className="px-3 py-2 font-medium">Paint seed</th>
                <th className="px-3 py-2 font-medium">Added</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-neutral-800">
                  <td className="px-3 py-2 text-neutral-100">
                    {item.label ? (
                      <>
                        {item.label}
                        <span className="ml-2 text-xs text-neutral-500">
                          {item.market_hash_name}
                        </span>
                      </>
                    ) : (
                      item.market_hash_name
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-300">
                    {item.min_float != null || item.max_float != null
                      ? `${item.min_float ?? 0} - ${item.max_float ?? 1}`
                      : "any"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-300">
                    {item.paint_seed ?? "any"}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{formatDateTime(item.created_at)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.active
                          ? "bg-emerald-900/40 text-emerald-300"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {item.active ? "active" : "paused"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(item)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
