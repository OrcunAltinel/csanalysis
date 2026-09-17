// Heuristic price-analysis helpers computed from stored price_snapshots /
// current_listings rows. None of this predicts future price -- it
// summarizes what's already happened, for ranking a personal watchlist.

export interface PricePoint {
  price: number;
  fetched_at: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

function bucketGranularityMs(spanMs: number): number {
  return spanMs <= 48 * MS_PER_HOUR ? MS_PER_HOUR : 24 * MS_PER_HOUR;
}

function bucketedMinPrices(points: PricePoint[]): { time: number; price: number }[] {
  if (points.length === 0) return [];
  const times = points.map((p) => new Date(p.fetched_at).getTime());
  const granularity = bucketGranularityMs(Math.max(...times) - Math.min(...times));

  const buckets = new Map<number, number>();
  for (const p of points) {
    const key = Math.floor(new Date(p.fetched_at).getTime() / granularity) * granularity;
    const existing = buckets.get(key);
    if (existing == null || p.price < existing) buckets.set(key, p.price);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, price]) => ({ time, price }));
}

/**
 * % change in the cheapest-listing trend from the start to the end of
 * `windowHours`. Null when there isn't enough spread in the window to call
 * it a trend (fewer than 2 buckets).
 */
export function priceChangePct(points: PricePoint[], windowHours: number): number | null {
  const since = Date.now() - windowHours * MS_PER_HOUR;
  const inWindow = points.filter((p) => new Date(p.fetched_at).getTime() >= since);
  const buckets = bucketedMinPrices(inWindow);
  if (buckets.length < 2) return null;
  const start = buckets[0].price;
  const end = buckets[buckets.length - 1].price;
  if (start <= 0) return null;
  return (end - start) / start;
}

/**
 * Coefficient of variation (stdev / mean) of raw listing prices within
 * `windowHours` -- a unitless volatility measure comparable across items at
 * different price points. Null when there are too few samples to trust.
 */
export function volatilityPct(points: PricePoint[], windowHours: number): number | null {
  const since = Date.now() - windowHours * MS_PER_HOUR;
  const prices = points
    .filter((p) => new Date(p.fetched_at).getTime() >= since)
    .map((p) => p.price);
  if (prices.length < 3) return null;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (mean <= 0) return null;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance) / mean;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Tunable heuristic caps -- there's no ground truth for these, they're
// starting points for how aggressively each signal saturates to its 0-100
// extreme. Retune freely as real data comes in.
const DISCOUNT_SATURATION = 0.25; // 25%+ below the 7d average -> full discount score
const MOMENTUM_RANGE = 0.15; // +/-15% 7d trend maps across the full momentum score range
const LIQUIDITY_SATURATION = 15; // 15+ inferred sales/week -> full liquidity score
const VOLATILITY_SATURATION = 0.5; // 50%+ coefficient of variation -> zero volatility score

const WEIGHTS = { discount: 0.4, momentum: 0.2, liquidity: 0.2, volatility: 0.2 };

export interface OpportunityInputs {
  /** Current lowest listing price vs the 7d rolling average, e.g. -0.12 = 12% below average. */
  pctFromAvg: number | null;
  /** 7d price trend, from priceChangePct. */
  momentumPct: number | null;
  /** Count of listings inferred sold/delisted in the last 7 days. */
  liquidityCount: number;
  /** 7d coefficient of variation, from volatilityPct. */
  volatility: number | null;
}

export interface OpportunityBreakdown {
  /** Null only when there's no rolling average yet to measure a discount against. */
  score: number | null;
  discountScore: number | null;
  momentumScore: number;
  liquidityScore: number;
  volatilityScore: number;
}

/**
 * A heuristic 0-100 "opportunity" score blending discount, momentum,
 * liquidity, and (inverse) volatility. This is a ranking aid for a personal
 * watchlist, NOT a prediction of future price and NOT a guarantee of
 * profit -- treat it the same as any other single indicator.
 */
export function opportunityScore(inputs: OpportunityInputs): OpportunityBreakdown {
  const discountScore =
    inputs.pctFromAvg == null ? null : clamp01(-inputs.pctFromAvg / DISCOUNT_SATURATION) * 100;

  // Neutral (50) when we don't have enough history yet, so a fresh watchlist
  // item still gets a usable score driven by discount alone.
  const momentumScore =
    inputs.momentumPct == null
      ? 50
      : clamp01((inputs.momentumPct + MOMENTUM_RANGE) / (2 * MOMENTUM_RANGE)) * 100;

  const liquidityScore = clamp01(inputs.liquidityCount / LIQUIDITY_SATURATION) * 100;

  const volatilityScore =
    inputs.volatility == null ? 50 : clamp01(1 - inputs.volatility / VOLATILITY_SATURATION) * 100;

  if (discountScore == null) {
    return { score: null, discountScore, momentumScore, liquidityScore, volatilityScore };
  }

  const score = Math.round(
    WEIGHTS.discount * discountScore +
      WEIGHTS.momentum * momentumScore +
      WEIGHTS.liquidity * liquidityScore +
      WEIGHTS.volatility * volatilityScore
  );

  return { score, discountScore, momentumScore, liquidityScore, volatilityScore };
}
