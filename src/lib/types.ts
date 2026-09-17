export interface WatchlistItem {
  id: string;
  market_hash_name: string;
  label: string | null;
  min_float: number | null;
  max_float: number | null;
  paint_seed: number | null;
  active: boolean;
  created_at: string;
}

export interface PriceSnapshot {
  id: number;
  listing_id: string;
  price: number;
  float_value: number | null;
  wear_name: string | null;
  fetched_at: string;
}

export interface CurrentListing {
  listing_id: string;
  price: number;
  float_value: number | null;
  wear_name: string | null;
  seller_username: string | null;
  last_seen_at: string;
  delta_from_avg: number | null;
  pct_from_avg: number | null;
  is_deal: boolean;
}

export interface RemovedListing {
  listing_id: string;
  price: number;
  float_value: number | null;
  wear_name: string | null;
  seller_username: string | null;
  removed_at: string;
}

export interface DealsResponse {
  avg_price: number | null;
  sample_size: number;
  avg_basis: "sold" | "listed" | null;
  listings: CurrentListing[];
  removed: RemovedListing[];
}

export interface OpportunityBreakdown {
  score: number | null;
  discountScore: number | null;
  momentumScore: number;
  liquidityScore: number;
  volatilityScore: number;
}

export interface Opportunity {
  watchlist_item_id: string;
  market_hash_name: string;
  label: string | null;
  lowest_price: number | null;
  avg_price: number | null;
  avg_basis: "sold" | "listed" | null;
  pct_from_avg: number | null;
  change_24h: number | null;
  change_7d: number | null;
  change_30d: number | null;
  liquidity_7d: number;
  volatility_7d: number | null;
  active_listing_count: number;
  wear_name: string | null;
  opportunity_score: number | null;
  score_breakdown: OpportunityBreakdown;
}

export interface IngestSummary {
  itemsProcessed: number;
  listingsSeen: number;
  snapshotsInserted: number;
  errors: string[];
}
