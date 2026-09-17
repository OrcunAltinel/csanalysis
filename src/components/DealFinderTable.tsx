"use client";

import type { CurrentListing } from "@/lib/types";
import { formatCents, formatFloat, formatPct } from "@/lib/format";

export default function DealFinderTable({
  listings,
  avgPrice,
  sampleSize,
  avgBasis,
}: {
  listings: CurrentListing[];
  avgPrice: number | null;
  sampleSize: number;
  avgBasis: "sold" | "listed" | null;
}) {
  const basisLabel =
    avgBasis === "sold"
      ? `last ${sampleSize} sold`
      : avgBasis === "listed"
        ? `est. from ${sampleSize} listed prices, last 7d -- not enough sales yet`
        : null;

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-400">
        Rolling average: {avgPrice != null ? formatCents(avgPrice) : "not enough data yet"}
        {basisLabel && ` (${basisLabel})`}
      </p>

      {listings.length === 0 ? (
        <p className="text-sm text-neutral-400">No current listings for this item.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">vs avg</th>
                <th className="px-3 py-2 font-medium">Float</th>
                <th className="px-3 py-2 font-medium">Wear</th>
                <th className="px-3 py-2 font-medium">Seller</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.listing_id} className="border-t border-neutral-800">
                  <td className="px-3 py-2 tabular-nums text-neutral-100">
                    {formatCents(listing.price)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {listing.is_deal ? (
                      <span
                        className="inline-flex items-center gap-1 font-medium"
                        style={{ color: "var(--chart-good)" }}
                      >
                        ▼ {formatPct(listing.pct_from_avg)} deal
                      </span>
                    ) : (
                      <span className="text-neutral-400">{formatPct(listing.pct_from_avg)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-300">
                    {formatFloat(listing.float_value)}
                  </td>
                  <td className="px-3 py-2 text-neutral-300">{listing.wear_name ?? "-"}</td>
                  <td className="px-3 py-2 text-neutral-300">{listing.seller_username ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
