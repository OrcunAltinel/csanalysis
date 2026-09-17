"use client";

import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { CurrentListing } from "@/lib/types";
import { formatCents, formatFloat } from "@/lib/format";

const SERIES_COLOR = "var(--chart-series-1)";

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as CurrentListing;
  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-neutral-100">{formatCents(point.price)}</div>
      <div className="text-neutral-400">float {formatFloat(point.float_value)}</div>
      {point.wear_name && <div className="text-neutral-500">{point.wear_name}</div>}
    </div>
  );
}

export default function FloatPriceScatter({ listings }: { listings: CurrentListing[] }) {
  const points = listings.filter((l) => l.float_value != null);

  if (points.length === 0) {
    return <p className="text-sm text-neutral-400">No current listings with float data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" />
        <XAxis
          dataKey="float_value"
          type="number"
          name="float"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => v.toFixed(2)}
          stroke="var(--chart-axis)"
          tick={{ fill: "var(--chart-text-muted)", fontSize: 12 }}
        />
        <YAxis
          dataKey="price"
          type="number"
          name="price"
          tickFormatter={(v) => formatCents(v)}
          stroke="var(--chart-axis)"
          tick={{ fill: "var(--chart-text-muted)", fontSize: 12 }}
          width={72}
        />
        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} fill={SERIES_COLOR} r={4} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
