"use client";

import type { DealsResponse, Opportunity, PriceSnapshot, WatchlistItem } from "@/lib/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Request to ${path} failed (${res.status})`);
  }
  return body as T;
}

export function fetchWatchlist(): Promise<{ items: WatchlistItem[] }> {
  return request("/api/watchlist");
}

export interface WatchlistItemInput {
  market_hash_name: string;
  label?: string | null;
  min_float?: number | null;
  max_float?: number | null;
  paint_seed?: number | null;
}

export function createWatchlistItem(input: WatchlistItemInput): Promise<{ item: WatchlistItem }> {
  return request("/api/watchlist", { method: "POST", body: JSON.stringify(input) });
}

export function updateWatchlistItem(
  id: string,
  patch: Partial<WatchlistItemInput & { active: boolean }>
): Promise<{ item: WatchlistItem }> {
  return request(`/api/watchlist/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteWatchlistItem(id: string): Promise<{ ok: true }> {
  return request(`/api/watchlist/${id}`, { method: "DELETE" });
}

export function fetchSnapshots(
  watchlistItemId: string,
  hours = 168
): Promise<{ snapshots: PriceSnapshot[] }> {
  return request(`/api/snapshots?watchlist_item_id=${watchlistItemId}&hours=${hours}`);
}

export function fetchDeals(watchlistItemId: string, windowDays = 7): Promise<DealsResponse> {
  return request(`/api/deals?watchlist_item_id=${watchlistItemId}&window_days=${windowDays}`);
}

export function fetchOpportunities(): Promise<{ opportunities: Opportunity[] }> {
  return request("/api/opportunities");
}
