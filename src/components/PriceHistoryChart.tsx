"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceSnapshot } from "@/lib/types";
import { formatCents, formatDateTime } from "@/lib/format";

const SERIES_COLOR = "var(--chart-series-1)";

function bucketKey(iso: string, granularityMs: number): number {
  const t = new Date(iso).getTime();
  return Math.floor(t / granularityMs) * granularityMs;
}

/**
 * Buckets raw price-change snapshots into a "cheapest listing over time"
 * trend line -- the single most useful market signal, and keeps the chart
 * to one series/one axis per the price-history job (magnitude over time).
 *
 * Bucket size is based on the actual spread of the data, not the requested
 * window -- a fresh watchlist item with only a few hours of history should
 * show hourly movement, not collapse into a single daily point just because
 * the window is 7 days. As real history accumulates past ~2 days, this
 * naturally switches to daily buckets.
 */
function toTrendPoints(snapshots: PriceSnapshot[]) {
  if (snapshots.length === 0) return [];
  const times = snapshots.map((s) => new Date(s.fetched_at).getTime());
  const spanMs = Math.max(...times) - Math.min(...times);
  const granularityMs = spanMs <= 48 * 60 * 60 * 1000 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const buckets = new Map<number, number>();
  for (const snap of snapshots) {
    const key = bucketKey(snap.fetched_at, granularityMs);
    const existing = buckets.get(key);
    if (existing == null || snap.price < existing) buckets.set(key, snap.price);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, price]) => ({ time, price }));
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs shadow-lg">
      <div className="text-neutral-400">{formatDateTime(new Date(point.time).toISOString())}</div>
      <div className="font-medium text-neutral-100">{formatCents(point.price)}</div>
    </div>
  );
}

export default function PriceHistoryChart({ snapshots }: { snapshots: PriceSnapshot[] }) {
  const points = useMemo(() => toTrendPoints(snapshots), [snapshots]);

  if (points.length === 0) {
    return <p className="text-sm text-neutral-400">No price history yet for this item.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          stroke="var(--chart-axis)"
          tick={{ fill: "var(--chart-text-muted)", fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v) => formatCents(v)}
          stroke="var(--chart-axis)"
          tick={{ fill: "var(--chart-text-muted)", fontSize: 12 }}
          width={72}
        />
        <Tooltip content={<TrendTooltip />} />
        <Line
          type="monotone"
          dataKey="price"
          stroke={SERIES_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: SERIES_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
