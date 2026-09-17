"use client";

import type { RemovedListing } from "@/lib/types";
import { formatCents, formatDateTime, formatFloat } from "@/lib/format";

export default function RecentlySoldTable({ listings }: { listings: RemovedListing[] }) {
  if (listings.length === 0) {
    return <p className="text-sm text-neutral-400">No listings have disappeared recently.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-900 text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Float</th>
            <th className="px-3 py-2 font-medium">Wear</th>
            <th className="px-3 py-2 font-medium">Seller</th>
            <th className="px-3 py-2 font-medium">Sold (approx.)</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.listing_id} className="border-t border-neutral-800">
              <td className="px-3 py-2 tabular-nums text-neutral-100">
                {formatCents(listing.price)}
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-300">
                {formatFloat(listing.float_value)}
              </td>
              <td className="px-3 py-2 text-neutral-300">{listing.wear_name ?? "-"}</td>
              <td className="px-3 py-2 text-neutral-300">{listing.seller_username ?? "-"}</td>
              <td className="px-3 py-2 text-neutral-500">{formatDateTime(listing.removed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
