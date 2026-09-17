"use client";

import type { Opportunity } from "@/lib/types";
import { formatCents, formatPct } from "@/lib/format";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-medium text-neutral-100">{value}</div>
    </div>
  );
}

export default function OpportunityStats({ opportunity }: { opportunity: Opportunity | null }) {
  if (!opportunity) {
    return <p className="text-sm text-neutral-400">Not enough data yet for this item.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Lowest" value={formatCents(opportunity.lowest_price)} />
        <Stat label="7d avg" value={formatCents(opportunity.avg_price_7d)} />
        <Stat label="vs avg" value={formatPct(opportunity.pct_from_avg)} />
        <Stat label="24h" value={formatPct(opportunity.change_24h)} />
        <Stat label="7d" value={formatPct(opportunity.change_7d)} />
        <Stat label="30d" value={formatPct(opportunity.change_30d)} />
        <Stat label="Liquidity (7d)" value={`${opportunity.liquidity_7d} sold`} />
        <Stat label="Volatility (7d)" value={formatPct(opportunity.volatility_7d)} />
      </div>
      <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2">
        <div className="text-xs text-neutral-500">Opportunity score (0-100)</div>
        <div className="text-lg font-semibold text-neutral-100">
          {opportunity.opportunity_score ?? "not enough data yet"}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          A heuristic ranking aid based on discount, momentum, liquidity, and volatility. Not a
          prediction, and not a guarantee of profit.
        </p>
      </div>
    </div>
  );
}
