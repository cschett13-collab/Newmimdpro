// Server-side quote lookups for stocks (Yahoo Finance unofficial) and
// Polymarket markets (gamma API). Used by the /api/quote route so the
// browser never has to talk to either API directly.

export type StockQuote = {
  symbol: string;
  price: number;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  currency: string | null;
  marketState: string | null;
  fetchedAt: number;
};

export type PolymarketQuote = {
  slug: string;
  outcome: string;
  price: number;
  question: string;
  endDate: string | null;
  volume24hr: number | null;
  fetchedAt: number;
};

export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
  };
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  const num = (k: string) => {
    const v = meta[k];
    return typeof v === "number" ? v : null;
  };
  const str = (k: string) => {
    const v = meta[k];
    return typeof v === "string" ? v : null;
  };
  return {
    symbol: str("symbol") ?? symbol.toUpperCase(),
    price: meta.regularMarketPrice as number,
    previousClose: num("chartPreviousClose") ?? num("previousClose"),
    dayHigh: num("regularMarketDayHigh"),
    dayLow: num("regularMarketDayLow"),
    fiftyTwoWeekHigh: num("fiftyTwoWeekHigh"),
    fiftyTwoWeekLow: num("fiftyTwoWeekLow"),
    currency: str("currency"),
    marketState: str("marketState"),
    fetchedAt: Date.now(),
  };
}

export async function getPolymarketQuote(
  slug: string,
  outcome: string,
): Promise<PolymarketQuote | null> {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(
    slug,
  )}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) return null;
  const arr = (await res.json()) as unknown;
  const m =
    Array.isArray(arr) && arr.length > 0
      ? (arr[0] as Record<string, unknown>)
      : null;
  if (!m) return null;
  const outcomes = parseJson(m.outcomes);
  const prices = parseJson(m.outcomePrices);
  if (!outcomes || !prices) return null;
  const idx = outcomes.findIndex(
    (o) => String(o).toLowerCase() === outcome.toLowerCase(),
  );
  if (idx < 0) return null;
  const price = Number(prices[idx]);
  if (!Number.isFinite(price)) return null;
  return {
    slug,
    outcome,
    price,
    question: String(m.question ?? ""),
    endDate:
      typeof m.endDate === "string"
        ? m.endDate
        : typeof m.end_date_iso === "string"
          ? (m.end_date_iso as string)
          : null,
    volume24hr:
      typeof m.volume24hr === "number"
        ? m.volume24hr
        : typeof m.volume24hr === "string"
          ? Number(m.volume24hr)
          : null,
    fetchedAt: Date.now(),
  };
}

function parseJson(v: unknown): unknown[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}
