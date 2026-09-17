"use client";

import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { formatCents, formatPct } from "@/lib/format";

function ChangeCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-neutral-500">-</span>;
  const color = value < 0 ? "var(--chart-good)" : value > 0 ? "var(--chart-critical)" : undefined;
  return <span style={{ color }}>{formatPct(value)}</span>;
}

export default function OpportunityTable({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) {
    return <p className="text-sm text-neutral-400">No watchlist items match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-900 text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium">Lowest</th>
            <th className="px-3 py-2 font-medium">7d avg</th>
            <th className="px-3 py-2 font-medium">vs avg</th>
            <th className="px-3 py-2 font-medium">24h</th>
            <th className="px-3 py-2 font-medium">7d</th>
            <th className="px-3 py-2 font-medium">30d</th>
            <th className="px-3 py-2 font-medium">Liquidity (7d)</th>
            <th className="px-3 py-2 font-medium">Volatility (7d)</th>
            <th className="px-3 py-2 font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.watchlist_item_id} className="border-t border-neutral-800">
              <td className="px-3 py-2 text-neutral-100">
                <Link href={`/?item=${o.watchlist_item_id}`} className="hover:underline">
                  {o.label || o.market_hash_name}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-100">
                {formatCents(o.lowest_price)}
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-300">
                {formatCents(o.avg_price_7d)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                <ChangeCell value={o.pct_from_avg} />
              </td>
              <td className="px-3 py-2 tabular-nums">
                <ChangeCell value={o.change_24h} />
              </td>
              <td className="px-3 py-2 tabular-nums">
                <ChangeCell value={o.change_7d} />
              </td>
              <td className="px-3 py-2 tabular-nums">
                <ChangeCell value={o.change_30d} />
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-300">
                {o.liquidity_7d} sold
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-300">
                {formatPct(o.volatility_7d)}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium text-neutral-100">
                {o.opportunity_score ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
