// Stock screener: fetches daily candles from Yahoo Finance (no key required),
// computes common technical indicators, and emits a composite "dip / oversold"
// score that highlights potential entry points in an uptrend.
//
// This is NOT investment advice. Indicators describe past price behavior,
// not future returns.

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (compatible; FVCEPortal/1.0; +https://foxvalleyclientengine.com)";

export type Action = "STRONG BUY" | "BUY" | "HOLD" | "SELL";

export type StockSignal = {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number;
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
  high52w: number;
  low52w: number;
  offHighPct: number;
  offLowPct: number;
  sma20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  zScore20: number;
  trendUp: boolean;
  score: number;
  action: Action;
  reasons: string[];
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  spark: number[];
  asOf: number;
};

export type StockError = { symbol: string; error: string };

export type StockResult =
  | ({ ok: true } & StockSignal)
  | ({ ok: false } & StockError);

type YahooMeta = {
  symbol: string;
  currency?: string;
  exchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  longName?: string;
  shortName?: string;
  instrumentType?: string;
};

type YahooChart = {
  chart: {
    result?: Array<{
      meta: YahooMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
        }>;
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
};

export function parseTickers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)),
    ),
  );
}

export async function analyzeTickers(symbols: string[]): Promise<StockResult[]> {
  const results = await Promise.all(symbols.map((s) => analyzeOne(s)));
  return results;
}

async function analyzeOne(symbol: string): Promise<StockResult> {
  try {
    const res = await fetch(
      `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
        // Cache aggressively at the edge — the data is daily.
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        symbol,
        error: `Yahoo responded ${res.status}`,
      };
    }
    const json = (await res.json()) as YahooChart;
    if (json.chart.error) {
      return { ok: false, symbol, error: json.chart.error.description };
    }
    const r = json.chart.result?.[0];
    if (!r) return { ok: false, symbol, error: "No data" };

    const closesRaw =
      r.indicators?.adjclose?.[0]?.adjclose ?? r.indicators?.quote?.[0]?.close;
    const highsRaw = r.indicators?.quote?.[0]?.high;
    const lowsRaw = r.indicators?.quote?.[0]?.low;
    if (!closesRaw || closesRaw.length < 30) {
      return { ok: false, symbol, error: "Not enough history" };
    }
    const closes = closesRaw.filter((x): x is number => typeof x === "number");
    const highs = (highsRaw ?? []).filter(
      (x): x is number => typeof x === "number",
    );
    const lows = (lowsRaw ?? []).filter(
      (x): x is number => typeof x === "number",
    );

    return { ok: true, ...computeSignal(symbol, r.meta, closes, highs, lows) };
  } catch (err) {
    return {
      ok: false,
      symbol,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

function computeSignal(
  symbol: string,
  meta: YahooMeta,
  closes: number[],
  highs: number[],
  lows: number[],
): StockSignal {
  const price = meta.regularMarketPrice ?? closes[closes.length - 1];
  const prevClose =
    meta.chartPreviousClose ??
    meta.previousClose ??
    closes[closes.length - 2] ??
    price;

  const sma = (n: number) =>
    closes.length >= n
      ? closes.slice(-n).reduce((a, b) => a + b, 0) / n
      : closes.reduce((a, b) => a + b, 0) / closes.length;

  const sma20 = sma(20);
  const sma50 = sma(50);
  const sma200 = sma(200);

  const window20 = closes.slice(-20);
  const mean20 = window20.reduce((a, b) => a + b, 0) / window20.length;
  const variance20 =
    window20.reduce((a, b) => a + (b - mean20) ** 2, 0) / window20.length;
  const std20 = Math.sqrt(variance20) || 1;
  const zScore20 = (price - mean20) / std20;

  const high52w = highs.length ? Math.max(...highs) : Math.max(...closes);
  const low52w = lows.length ? Math.min(...lows) : Math.min(...closes);
  const offHighPct = ((price - high52w) / high52w) * 100;
  const offLowPct = ((price - low52w) / low52w) * 100;

  const rsi14 = rsi(closes, 14);
  const dayChange = price - prevClose;
  const dayChangePct = (dayChange / prevClose) * 100;
  const trendUp = price > sma200 && sma50 > sma200;

  // Composite score: looks for oversold conditions inside a healthy long-term
  // uptrend ("buy the dip"), or extreme oversold even in a downtrend.
  let score = 0;
  const reasons: string[] = [];

  if (rsi14 < 30) {
    score += 2;
    reasons.push(`RSI ${rsi14.toFixed(0)} — oversold`);
  } else if (rsi14 < 40) {
    score += 1;
    reasons.push(`RSI ${rsi14.toFixed(0)} — weak`);
  } else if (rsi14 > 70) {
    score -= 2;
    reasons.push(`RSI ${rsi14.toFixed(0)} — overbought`);
  }

  if (price < sma20 * 0.97) {
    score += 1;
    reasons.push(`${pct((price - sma20) / sma20)} below 20d avg`);
  }
  if (price < sma50 * 0.95) {
    score += 1;
    reasons.push(`${pct((price - sma50) / sma50)} below 50d avg`);
  }
  if (trendUp) {
    score += 1;
    reasons.push("Long-term uptrend (above 200d)");
  } else if (price < sma200) {
    score -= 1;
    reasons.push("Below 200d avg — caution");
  }
  if (offHighPct < -15) {
    score += 1;
    reasons.push(`${offHighPct.toFixed(1)}% off 52w high`);
  }
  if (zScore20 < -1.5) {
    score += 1;
    reasons.push(`Stretched ${zScore20.toFixed(1)}σ below 20d mean`);
  } else if (zScore20 > 1.5) {
    score -= 1;
    reasons.push(`Stretched ${zScore20.toFixed(1)}σ above 20d mean`);
  }

  const action: Action =
    score >= 4
      ? "STRONG BUY"
      : score >= 2
        ? "BUY"
        : score <= -2
          ? "SELL"
          : "HOLD";

  // Plan: enter at the lower of price / SMA20, stop just below recent swing
  // low, target the 50d (or 52w high if already above 50d).
  const recentLow = Math.min(...closes.slice(-20));
  const entry = Math.min(price, sma20);
  const stop = recentLow * 0.98;
  const target = price > sma50 ? high52w : sma50;
  const reward = Math.max(0, target - entry);
  const risk = Math.max(0.0001, entry - stop);
  const riskReward = reward / risk;

  return {
    symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    currency: meta.currency ?? "USD",
    exchange: meta.exchangeName ?? "",
    price,
    prevClose,
    dayChange,
    dayChangePct,
    high52w,
    low52w,
    offHighPct,
    offLowPct,
    sma20,
    sma50,
    sma200,
    rsi14,
    zScore20,
    trendUp,
    score,
    action,
    reasons,
    entry,
    stop,
    target,
    riskReward,
    spark: closes.slice(-60),
    asOf: Date.now(),
  };
}

function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
