// Intraday signal builder for day-trading setups: VWAP, opening range, relative
// volume, and gap analysis on 5-minute bars from Yahoo Finance.
//
// This is NOT investment advice. Day trading has a high failure rate. The
// indicators below describe price/volume mechanics — they do not predict.

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (compatible; FVCEPortal/1.0; +https://foxvalleyclientengine.com)";

export type Setup =
  | "GAP_AND_GO"
  | "ORB_LONG"
  | "VWAP_RECLAIM"
  | "FAILED_BREAKOUT_SHORT"
  | "NONE";

export type IntradaySignal = {
  symbol: string;
  name: string;
  currency: string;
  marketOpen: boolean;
  price: number;
  prevClose: number;
  open: number;
  gapPct: number;
  dayChangePct: number;
  todayHigh: number;
  todayLow: number;
  vwap: number;
  vwapDistPct: number;
  orh: number;
  orl: number;
  orbStatus: "pre" | "inside" | "breakout-up" | "breakout-down";
  rvol: number;
  avgDailyVolume: number;
  atr14: number;
  atrPct: number;
  setup: Setup;
  bias: "long" | "short" | "flat";
  entry: number;
  stop: number;
  target: number;
  riskPerShare: number;
  rr: number;
  notes: string[];
  asOf: number;
};

export type IntradayResult =
  | ({ ok: true } & IntradaySignal)
  | { ok: false; symbol: string; error: string };

type Quote = {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
};

type ChartResp = {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        longName?: string;
        shortName?: string;
        currentTradingPeriod?: {
          regular?: { start: number; end: number; gmtoffset?: number };
        };
      };
      timestamp?: number[];
      indicators?: { quote?: Quote[] };
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

export async function analyzeIntraday(
  symbols: string[],
): Promise<IntradayResult[]> {
  return Promise.all(symbols.map(analyzeOne));
}

async function analyzeOne(symbol: string): Promise<IntradayResult> {
  try {
    const [intraRes, dailyRes] = await Promise.all([
      fetch(
        `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=2d&interval=5m&includePrePost=false`,
        { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 30 } },
      ),
      fetch(
        `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
        { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 300 } },
      ),
    ]);
    if (!intraRes.ok)
      return { ok: false, symbol, error: `Yahoo intraday ${intraRes.status}` };
    if (!dailyRes.ok)
      return { ok: false, symbol, error: `Yahoo daily ${dailyRes.status}` };

    const intra = (await intraRes.json()) as ChartResp;
    const daily = (await dailyRes.json()) as ChartResp;
    if (intra.chart.error)
      return { ok: false, symbol, error: intra.chart.error.description };

    const ir = intra.chart.result?.[0];
    const dr = daily.chart.result?.[0];
    if (!ir || !dr) return { ok: false, symbol, error: "No data" };

    return computeSignal(symbol, ir, dr);
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
  ir: NonNullable<ChartResp["chart"]["result"]>[number],
  dr: NonNullable<ChartResp["chart"]["result"]>[number],
): IntradayResult {
  const dq = dr.indicators?.quote?.[0];
  if (!dq?.close || dq.close.length < 15) {
    return { ok: false, symbol, error: "Not enough daily history" };
  }
  const dCloses = dq.close.filter((x): x is number => typeof x === "number");
  const dHighs = (dq.high ?? []).filter((x): x is number => typeof x === "number");
  const dLows = (dq.low ?? []).filter((x): x is number => typeof x === "number");
  const dVols = (dq.volume ?? []).filter((x): x is number => typeof x === "number");

  const atr14 = atr(dHighs, dLows, dCloses, 14);
  const avgDailyVolume =
    dVols.slice(-20).reduce((a, b) => a + b, 0) / Math.max(1, dVols.slice(-20).length);
  const prevClose =
    ir.meta.chartPreviousClose ??
    ir.meta.previousClose ??
    dCloses[dCloses.length - 2] ??
    dCloses[dCloses.length - 1];

  const reg = ir.meta.currentTradingPeriod?.regular;
  const ts = ir.timestamp ?? [];
  const iq = ir.indicators?.quote?.[0];
  const allBars = ts
    .map((t, i) => ({
      t,
      o: iq?.open?.[i] ?? null,
      h: iq?.high?.[i] ?? null,
      l: iq?.low?.[i] ?? null,
      c: iq?.close?.[i] ?? null,
      v: iq?.volume?.[i] ?? null,
    }))
    .filter(
      (b): b is { t: number; o: number; h: number; l: number; c: number; v: number } =>
        b.o !== null && b.h !== null && b.l !== null && b.c !== null && b.v !== null,
    );

  // Filter to today's regular session bars.
  const session = reg
    ? allBars.filter((b) => b.t >= reg.start && b.t < reg.end)
    : allBars;

  const livePrice = ir.meta.regularMarketPrice ?? session[session.length - 1]?.c ?? prevClose;
  const atrPct = (atr14 / livePrice) * 100;

  if (session.length === 0) {
    return {
      ok: true,
      symbol,
      name: ir.meta.longName ?? ir.meta.shortName ?? symbol,
      currency: ir.meta.currency ?? "USD",
      marketOpen: false,
      price: livePrice,
      prevClose,
      open: livePrice,
      gapPct: 0,
      dayChangePct: 0,
      todayHigh: livePrice,
      todayLow: livePrice,
      vwap: livePrice,
      vwapDistPct: 0,
      orh: livePrice,
      orl: livePrice,
      orbStatus: "pre",
      rvol: 0,
      avgDailyVolume,
      atr14,
      atrPct,
      setup: "NONE",
      bias: "flat",
      entry: livePrice,
      stop: livePrice - atr14,
      target: livePrice + atr14,
      riskPerShare: atr14,
      rr: 1,
      notes: ["Market closed — re-check during regular session."],
      asOf: Date.now(),
    };
  }

  const open = session[0].o;
  const last = session[session.length - 1];
  const price = last.c;
  const todayHigh = Math.max(...session.map((b) => b.h));
  const todayLow = Math.min(...session.map((b) => b.l));
  const gapPct = ((open - prevClose) / prevClose) * 100;
  const dayChangePct = ((price - prevClose) / prevClose) * 100;

  // VWAP across the whole session so far.
  let pv = 0;
  let v = 0;
  for (const b of session) {
    const tp = (b.h + b.l + b.c) / 3;
    pv += tp * b.v;
    v += b.v;
  }
  const vwap = v > 0 ? pv / v : price;
  const vwapDistPct = ((price - vwap) / vwap) * 100;

  // Opening range = first 30 minutes (≈ 6 5-min bars).
  const orBars = session.slice(0, 6);
  const orh = Math.max(...orBars.map((b) => b.h));
  const orl = Math.min(...orBars.map((b) => b.l));

  let orbStatus: IntradaySignal["orbStatus"];
  if (session.length < 6) orbStatus = "pre";
  else if (price > orh) orbStatus = "breakout-up";
  else if (price < orl) orbStatus = "breakout-down";
  else orbStatus = "inside";

  // Relative volume vs same-fraction-of-day expected volume.
  const todayVol = session.reduce((a, b) => a + b.v, 0);
  let rvol = 0;
  if (reg) {
    const now = Math.min(Date.now() / 1000, reg.end);
    const elapsed = Math.max(60, now - reg.start);
    const total = Math.max(60, reg.end - reg.start);
    const expected = avgDailyVolume * (elapsed / total);
    rvol = expected > 0 ? todayVol / expected : 0;
  }

  // Pattern detection.
  const everAboveOrh = session.some((b) => b.h > orh && b.t > orBars[orBars.length - 1].t);
  const everBelowVwap = (() => {
    let pp = 0;
    let vv = 0;
    for (const b of session) {
      const tp = (b.h + b.l + b.c) / 3;
      pp += tp * b.v;
      vv += b.v;
      if (vv === 0) continue;
      const w = pp / vv;
      if (b.c < w) return true;
    }
    return false;
  })();
  const lastGreen = last.c > last.o;

  let setup: Setup = "NONE";
  if (
    gapPct >= 2 &&
    rvol >= 1.5 &&
    price > vwap &&
    orbStatus === "breakout-up"
  ) {
    setup = "GAP_AND_GO";
  } else if (orbStatus === "breakout-up" && rvol >= 1.2 && price > vwap) {
    setup = "ORB_LONG";
  } else if (
    everBelowVwap &&
    price > vwap &&
    Math.abs(vwapDistPct) < 0.6 &&
    lastGreen &&
    rvol >= 1
  ) {
    setup = "VWAP_RECLAIM";
  } else if (
    everAboveOrh &&
    price < orh &&
    price < vwap &&
    orbStatus !== "pre"
  ) {
    setup = "FAILED_BREAKOUT_SHORT";
  }

  // Build trade plan based on setup. Each plan defines entry, a hard stop,
  // and a target sized in ATR / measured-move terms.
  const bias: IntradaySignal["bias"] =
    setup === "FAILED_BREAKOUT_SHORT"
      ? "short"
      : setup === "NONE"
        ? "flat"
        : "long";

  let entry = price;
  let stop = price - atr14 * 0.5;
  let target = price + atr14;
  const notes: string[] = [];

  switch (setup) {
    case "GAP_AND_GO": {
      entry = price;
      stop = Math.max(orh - atr14 * 0.2, vwap);
      target = entry + 2 * (entry - stop);
      notes.push(
        `Gap ${gapPct.toFixed(1)}% with RVOL ${rvol.toFixed(1)} — momentum trend day candidate`,
      );
      break;
    }
    case "ORB_LONG": {
      entry = price;
      stop = orh - atr14 * 0.15;
      const range = orh - orl;
      target = orh + range; // measured move
      notes.push(
        `Broke 30-min high ${orh.toFixed(2)} with RVOL ${rvol.toFixed(1)}`,
      );
      break;
    }
    case "VWAP_RECLAIM": {
      entry = price;
      stop = vwap - atr14 * 0.25;
      target = Math.max(todayHigh, entry + 2 * (entry - stop));
      notes.push(`Reclaimed VWAP ${vwap.toFixed(2)} after dip`);
      break;
    }
    case "FAILED_BREAKOUT_SHORT": {
      entry = price;
      stop = orh + atr14 * 0.15;
      target = Math.min(orl, entry - 2 * (stop - entry));
      notes.push(`Failed above ${orh.toFixed(2)} — reverting toward VWAP/ORL`);
      break;
    }
    case "NONE": {
      notes.push("No clean intraday setup right now — wait.");
      break;
    }
  }

  if (rvol < 0.7 && setup !== "NONE") {
    notes.push("Low RVOL — momentum is thin, treat as half-size or skip");
  }
  if (atrPct < 0.7) {
    notes.push("Low daily ATR — not enough range to day trade efficiently");
  }

  const riskPerShare =
    bias === "short" ? Math.max(0.01, stop - entry) : Math.max(0.01, entry - stop);
  const rewardPerShare =
    bias === "short" ? Math.max(0, entry - target) : Math.max(0, target - entry);
  const rr = rewardPerShare / riskPerShare;

  return {
    ok: true,
    symbol,
    name: ir.meta.longName ?? ir.meta.shortName ?? symbol,
    currency: ir.meta.currency ?? "USD",
    marketOpen: true,
    price,
    prevClose,
    open,
    gapPct,
    dayChangePct,
    todayHigh,
    todayLow,
    vwap,
    vwapDistPct,
    orh,
    orl,
    orbStatus,
    rvol,
    avgDailyVolume,
    atr14,
    atrPct,
    setup,
    bias,
    entry,
    stop,
    target,
    riskPerShare,
    rr,
    notes,
    asOf: Date.now(),
  };
}

function atr(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = Math.min(highs.length, lows.length, closes.length);
  if (n < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < n; i++) {
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
}
