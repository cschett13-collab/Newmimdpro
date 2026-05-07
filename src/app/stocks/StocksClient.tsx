"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { StockResult, StockSignal } from "@/lib/stocks";

const STORAGE_KEY = "fvce_stocks_watchlist_v1";
const DEFAULT_WATCHLIST = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "TSLA",
  "AMD",
  "SPY",
  "QQQ",
];
const REFRESH_MS = 60_000;

type SortKey = "score" | "rsi" | "offHigh" | "dayChange" | "symbol";

export function StocksClient() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const inFlight = useRef<AbortController | null>(null);

  // Load persisted watchlist on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? (JSON.parse(raw) as string[]) : null;
      setWatchlist(list && Array.isArray(list) && list.length ? list : DEFAULT_WATCHLIST);
    } catch {
      setWatchlist(DEFAULT_WATCHLIST);
    }
  }, []);

  useEffect(() => {
    if (watchlist.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      /* ignore quota errors */
    }
  }, [watchlist]);

  const fetchSignals = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) {
      setResults([]);
      return;
    }
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/stocks?symbols=${encodeURIComponent(symbols.join(","))}`,
        { signal: ctrl.signal, cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: StockResult[] };
      setResults(data.results);
      setLastUpdated(Date.now());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when watchlist changes + every REFRESH_MS.
  useEffect(() => {
    if (watchlist.length === 0) return;
    fetchSignals(watchlist);
    const t = setInterval(() => fetchSignals(watchlist), REFRESH_MS);
    return () => clearInterval(t);
  }, [watchlist, fetchSignals]);

  const addTickers = (raw: string) => {
    const cleaned = raw
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(t));
    if (!cleaned.length) return;
    setWatchlist((prev) => Array.from(new Set([...prev, ...cleaned])));
    setInput("");
  };

  const removeTicker = (symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
  };

  const sorted = useMemo(() => {
    const ok = results.filter((r): r is { ok: true } & StockSignal => r.ok);
    const errs = results.filter(
      (r): r is { ok: false; symbol: string; error: string } => !r.ok,
    );
    const cmp = (a: StockSignal, b: StockSignal) => {
      switch (sortKey) {
        case "score":
          return b.score - a.score;
        case "rsi":
          return a.rsi14 - b.rsi14;
        case "offHigh":
          return a.offHighPct - b.offHighPct;
        case "dayChange":
          return a.dayChangePct - b.dayChangePct;
        case "symbol":
          return a.symbol.localeCompare(b.symbol);
      }
    };
    return { ok: [...ok].sort(cmp), errs };
  }, [results, sortKey]);

  const buys = sorted.ok.filter((s) => s.score >= 2);
  const watch = sorted.ok.filter((s) => s.score >= 0 && s.score < 2);
  const sells = sorted.ok.filter((s) => s.score < 0);

  return (
    <div className="space-y-6">
      <Disclaimer />

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="ticker-input">
            Add tickers
          </label>
          <input
            id="ticker-input"
            className="input"
            placeholder="e.g. AAPL, MSFT, NVDA"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTickers(input);
              }
            }}
          />
        </div>
        <button
          className="btn-primary"
          onClick={() => addTickers(input)}
          disabled={!input.trim()}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
        <button
          className="btn-ghost"
          onClick={() => fetchSignals(watchlist)}
          disabled={loading || watchlist.length === 0}
          title="Refresh"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
        <div className="ml-auto text-xs text-ink-500">
          {lastUpdated
            ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
            : loading
              ? "Loading…"
              : "—"}
        </div>
      </div>

      {error && (
        <div className="card p-3 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Buy candidates"
          value={buys.length}
          tone="positive"
          icon={TrendingUp}
        />
        <SummaryCard label="Neutral" value={watch.length} tone="neutral" />
        <SummaryCard
          label="Avoid / Sell"
          value={sells.length}
          tone="negative"
          icon={TrendingDown}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Signals</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">Sort by</span>
            <select
              className="input py-1 text-xs w-auto"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="score">Buy score (best first)</option>
              <option value="rsi">RSI (lowest first)</option>
              <option value="offHigh">% off 52w high</option>
              <option value="dayChange">Day change</option>
              <option value="symbol">Symbol A→Z</option>
            </select>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">
            Add some tickers above to start screening.
          </div>
        ) : sorted.ok.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-ink-500">
            No data yet. {sorted.errs.length > 0 && "Check the errors below."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-ink-500 bg-ink-50">
                <tr>
                  <th className="text-left px-4 py-2">Symbol</th>
                  <th className="text-right px-3 py-2">Price</th>
                  <th className="text-right px-3 py-2">Day</th>
                  <th className="text-right px-3 py-2">RSI</th>
                  <th className="text-right px-3 py-2">Off 52w High</th>
                  <th className="text-right px-3 py-2">Trend</th>
                  <th className="text-left px-3 py-2">Plan (entry / stop / target)</th>
                  <th className="text-center px-3 py-2">Action</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.ok.map((s) => (
                  <Row key={s.symbol} s={s} onRemove={removeTicker} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sorted.errs.length > 0 && (
        <div className="card p-3 text-sm">
          <div className="text-xs font-semibold uppercase text-ink-500 mb-2">
            Could not load
          </div>
          <ul className="space-y-1">
            {sorted.errs.map((e) => (
              <li key={e.symbol} className="flex items-center justify-between">
                <span>
                  <strong>{e.symbol}</strong>
                  <span className="text-ink-500"> — {e.error}</span>
                </span>
                <button
                  className="btn-ghost text-xs px-2 py-1"
                  onClick={() => removeTicker(e.symbol)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  s,
  onRemove,
}: {
  s: StockSignal;
  onRemove: (symbol: string) => void;
}) {
  const dayUp = s.dayChangePct >= 0;
  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/40">
      <td className="px-4 py-3">
        <div className="font-semibold">{s.symbol}</div>
        <div className="text-[11px] text-ink-500 truncate max-w-[180px]">
          {s.name}
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {fmtPrice(s.price, s.currency)}
      </td>
      <td
        className={`px-3 py-3 text-right tabular-nums ${
          dayUp ? "text-green-700" : "text-red-700"
        }`}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          {dayUp ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {s.dayChangePct.toFixed(2)}%
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <RsiPill value={s.rsi14} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {s.offHighPct.toFixed(1)}%
      </td>
      <td className="px-3 py-3 text-right">
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded ${
            s.trendUp
              ? "bg-green-50 text-green-700"
              : "bg-ink-100 text-ink-600"
          }`}
          title={`Price ${formatNumber(s.price)} vs SMA200 ${formatNumber(s.sma200)}`}
        >
          {s.trendUp ? "Up" : "Down"}
        </span>
      </td>
      <td className="px-3 py-3 text-[12px] tabular-nums text-ink-700">
        <div>
          Entry <strong>{formatNumber(s.entry)}</strong> · Stop{" "}
          <strong>{formatNumber(s.stop)}</strong> · Target{" "}
          <strong>{formatNumber(s.target)}</strong>
        </div>
        <div className="text-[11px] text-ink-500">
          R:R {s.riskReward.toFixed(2)} ·{" "}
          {s.reasons.slice(0, 2).join(" · ") || "—"}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <ActionBadge action={s.action} />
      </td>
      <td className="px-2 py-3 text-right">
        <button
          className="btn-ghost text-xs px-2 py-1"
          onClick={() => onRemove(s.symbol)}
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

function RsiPill({ value }: { value: number }) {
  const tone =
    value < 30
      ? "bg-green-50 text-green-700"
      : value > 70
        ? "bg-red-50 text-red-700"
        : "bg-ink-100 text-ink-700";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded ${tone}`}>
      {value.toFixed(0)}
    </span>
  );
}

function ActionBadge({ action }: { action: StockSignal["action"] }) {
  const styles: Record<StockSignal["action"], string> = {
    "STRONG BUY": "bg-green-600 text-white",
    BUY: "bg-green-100 text-green-800",
    HOLD: "bg-ink-100 text-ink-700",
    SELL: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`text-[11px] font-semibold tracking-wide px-2 py-1 rounded ${styles[action]}`}
    >
      {action}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "positive" | "neutral" | "negative";
  icon?: typeof TrendingUp;
}) {
  const toneClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "negative"
        ? "text-red-700"
        : "text-ink-700";
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </div>
        {Icon && <Icon className={`h-4 w-4 ${toneClass}`} />}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="card p-4 text-[12px] leading-relaxed text-ink-600 border-amber-200 bg-amber-50/40">
      <strong className="text-ink-800">Heads up.</strong> This screener flags
      historically oversold stocks inside long-term uptrends — a common
      "buy-the-dip" pattern. It is <em>not</em> investment advice and signals
      are not guarantees. Markets can keep falling. Size positions, set stops,
      and don&apos;t risk money you can&apos;t lose.
    </div>
  );
}

function fmtPrice(n: number, ccy = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: n < 10 ? 4 : 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

function formatNumber(n: number): string {
  return n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toFixed(2);
}
