"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchDeals, fetchOpportunities, fetchSnapshots, fetchWatchlist } from "@/lib/api";
import type { DealsResponse, Opportunity, PriceSnapshot, WatchlistItem } from "@/lib/types";
import ItemSelector from "@/components/ItemSelector";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import DealFinderTable from "@/components/DealFinderTable";
import RecentlySoldTable from "@/components/RecentlySoldTable";
import FloatPriceScatter from "@/components/FloatPriceScatter";
import OpportunityStats from "@/components/OpportunityStats";

const HISTORY_HOURS = 168; // 7 days

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-400">Loading...</p>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [deals, setDeals] = useState<DealsResponse | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlist()
      .then(({ items }) => {
        setItems(items);
        const requested = searchParams.get("item");
        const initial = requested && items.some((i) => i.id === requested) ? requested : items[0]?.id;
        if (initial) setSelectedId(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    fetchOpportunities()
      .then(({ opportunities }) => setOpportunities(opportunities))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setError(null);
    Promise.all([fetchSnapshots(selectedId, HISTORY_HOURS), fetchDeals(selectedId)])
      .then(([snapshotsRes, dealsRes]) => {
        setSnapshots(snapshotsRes.snapshots);
        setDeals(dealsRes);
      })
      .catch((err) => setError(err.message));
  }, [selectedId]);

  if (loading) return <p className="text-sm text-neutral-400">Loading...</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-100">Dashboard</h1>
        <ItemSelector items={items} selectedId={selectedId} onChange={setSelectedId} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {selectedId && (
        <>
          <section>
            <h2 className="mb-3 text-sm font-medium text-neutral-300">Summary</h2>
            <OpportunityStats
              opportunity={opportunities.find((o) => o.watchlist_item_id === selectedId) ?? null}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Price history (last 7 days, cheapest listing per period)
            </h2>
            <PriceHistoryChart snapshots={snapshots} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Float vs. price (current listings)
            </h2>
            <FloatPriceScatter listings={deals?.listings ?? []} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Deal finder (current listings vs. 7-day rolling average)
            </h2>
            <DealFinderTable
              listings={deals?.listings ?? []}
              avgPrice={deals?.avg_price ?? null}
              sampleSize={deals?.sample_size ?? 0}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Recently sold / delisted (inferred from disappearance, not confirmed by CSFloat)
            </h2>
            <RecentlySoldTable listings={deals?.removed ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
