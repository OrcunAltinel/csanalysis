// Minimal server-side client for the CSFloat REST API (https://docs.csfloat.com).
// Never import this from client code -- it requires a private API key.

const CSFLOAT_BASE = "https://csfloat.com/api/v1";
const MAX_RETRIES = 4;
const MAX_PAGES_PER_ITEM = 4; // 4 x 50 = 200 listings/item/poll, a conservative cap.

export interface CsfloatSeller {
  steam_id?: string;
  username?: string;
}

export interface CsfloatItem {
  float_value?: number;
  wear_name?: string;
  paint_seed?: number;
  paint_index?: number;
  market_hash_name?: string;
}

export interface CsfloatListing {
  id: string;
  price: number; // cents
  created_at?: string;
  seller?: CsfloatSeller;
  item?: CsfloatItem;
}

export interface ListingFilter {
  marketHashName: string;
  minFloat?: number | null;
  maxFloat?: number | null;
  paintSeed?: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function csfloatFetch(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  attempt = 0
): Promise<Response> {
  const url = new URL(CSFLOAT_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
    cache: "no-store",
  });

  const isRetryable = res.status === 429 || res.status >= 500;
  if (isRetryable) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(
        `CSFloat request failed after ${MAX_RETRIES} retries: ${res.status} ${res.statusText}`
      );
    }
    const retryAfterHeader = res.headers.get("retry-after");
    const backoffMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 250;
    await sleep(backoffMs);
    return csfloatFetch(path, params, apiKey, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CSFloat request failed: ${res.status} ${res.statusText} ${body}`.trim());
  }

  return res;
}

/**
 * Fetches listings for a single watchlist item, following cursor pagination
 * up to MAX_PAGES_PER_ITEM pages. The CSFloat docs don't fully specify where
 * the next-page cursor is returned, so this checks a response header first,
 * then a couple of plausible body shapes, and stops paginating if none are
 * present (treating the page as the last one).
 */
export async function fetchListingsForItem(
  filter: ListingFilter,
  apiKey: string
): Promise<CsfloatListing[]> {
  const results: CsfloatListing[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES_PER_ITEM; page++) {
    const params: Record<string, string> = {
      market_hash_name: filter.marketHashName,
      limit: "50",
      // Auctions don't have a fixed "buy it now" price, so they don't fit
      // the deal-finder's price-comparison model -- exclude them at the
      // source rather than fetching and filtering them out later.
      type: "buy_now",
    };
    if (filter.minFloat != null) params.min_float = String(filter.minFloat);
    if (filter.maxFloat != null) params.max_float = String(filter.maxFloat);
    if (filter.paintSeed != null) params.paint_seed = String(filter.paintSeed);
    if (cursor) params.cursor = cursor;

    const res = await csfloatFetch("/listings", params, apiKey);
    const headerCursor = res.headers.get("x-next-cursor") ?? undefined;
    const body: unknown = await res.json();

    const pageItems: CsfloatListing[] = Array.isArray(body)
      ? (body as CsfloatListing[])
      : ((body as { data?: CsfloatListing[] })?.data ?? []);

    results.push(...pageItems);

    const bodyCursor = Array.isArray(body)
      ? undefined
      : ((body as { cursor?: string; next_cursor?: string })?.cursor ??
        (body as { cursor?: string; next_cursor?: string })?.next_cursor);

    cursor = headerCursor || bodyCursor;

    if (!cursor || pageItems.length < 50) break;
  }

  return results;
}
