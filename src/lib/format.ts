export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export function formatFloat(value: number | null | undefined): string {
  if (value == null) return "-";
  return value.toFixed(6);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "-";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
