"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOpportunities } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import { parseMarketHashName } from "@/lib/skinName";
import OpportunityTable from "@/components/OpportunityTable";

const emptyFilters = {
  minPrice: "",
  maxPrice: "",
  weapon: "",
  skin: "",
  wear: "any",
  minScore: "",
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyFilters);

  useEffect(() => {
    fetchOpportunities()
      .then(({ opportunities }) => setOpportunities(opportunities))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const wearOptions = useMemo(() => {
    const wears = new Set<string>();
    for (const o of opportunities) {
      const { wear } = parseMarketHashName(o.market_hash_name);
      if (wear) wears.add(wear);
    }
    return Array.from(wears).sort();
  }, [opportunities]);

  const filtered = useMemo(() => {
    const minPrice = filters.minPrice ? Number(filters.minPrice) * 100 : null;
    const maxPrice = filters.maxPrice ? Number(filters.maxPrice) * 100 : null;
    const minScore = filters.minScore ? Number(filters.minScore) : null;
    const weaponQuery = filters.weapon.trim().toLowerCase();
    const skinQuery = filters.skin.trim().toLowerCase();

    return opportunities.filter((o) => {
      if (minPrice != null && (o.lowest_price == null || o.lowest_price < minPrice)) return false;
      if (maxPrice != null && (o.lowest_price == null || o.lowest_price > maxPrice)) return false;
      if (minScore != null && (o.opportunity_score == null || o.opportunity_score < minScore))
        return false;

      const parsed = parseMarketHashName(o.market_hash_name);
      if (weaponQuery && !parsed.weapon?.toLowerCase().includes(weaponQuery)) return false;
      if (skinQuery && !parsed.skin?.toLowerCase().includes(skinQuery)) return false;
      if (filters.wear !== "any" && parsed.wear !== filters.wear) return false;

      return true;
    });
  }, [opportunities, filters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Opportunities</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Watchlist items ranked by a heuristic opportunity score (discount, momentum, liquidity,
          volatility). This is a ranking aid based on past data, not a prediction and not a
          guarantee of profit.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <input
          placeholder="Min price ($)"
          value={filters.minPrice}
          onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <input
          placeholder="Max price ($)"
          value={filters.maxPrice}
          onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <input
          placeholder="Weapon"
          value={filters.weapon}
          onChange={(e) => setFilters({ ...filters, weapon: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <input
          placeholder="Skin"
          value={filters.skin}
          onChange={(e) => setFilters({ ...filters, skin: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <select
          value={filters.wear}
          onChange={(e) => setFilters({ ...filters, wear: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="any">Any wear</option>
          {wearOptions.map((wear) => (
            <option key={wear} value={wear}>
              {wear}
            </option>
          ))}
        </select>
        <input
          placeholder="Min score"
          value={filters.minScore}
          onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : (
        <OpportunityTable opportunities={filtered} />
      )}
    </div>
  );
}
