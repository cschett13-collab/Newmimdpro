"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { IntradayResult, IntradaySignal, Setup } from "@/lib/intraday";

const WATCHLIST_KEY = "fvce_day_watchlist_v1";
const ACCOUNT_KEY = "fvce_day_account_v1";
const REFRESH_MS = 30_000;

// Liquid, high-volume names commonly used by day traders.
const DEFAULT_WATCHLIST = [
  "SPY",
  "QQQ",
  "TSLA",
  "NVDA",
  "AMD",
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
  "COIN",
];

type AccountSettings = {
  size: number;
  riskPct: number;
  showOnlySetups: boolean;
};

const DEFAULT_ACCOUNT: AccountSettings = {
  size: 2000,
  riskPct: 1,
  showOnlySetups: true,
};

type SortKey = "rvol" | "rr" | "atrPct" | "gap" | "symbol";

export function DayTraderClient() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [account, setAccount] = useState<AccountSettings>(DEFAULT_ACCOUNT);
  const [results, setResults] = useState<IntradayResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rvol");
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const wl = localStorage.getItem(WATCHLIST_KEY);
      const list = wl ? (JSON.parse(wl) as string[]) : null;
      setWatchlist(list && Array.isArray(list) && list.length ? list : DEFAULT_WATCHLIST);
    } catch {
      setWatchlist(DEFAULT_WATCHLIST);
    }
    try {
      const a = localStorage.getItem(ACCOUNT_KEY);
      if (a) setAccount({ ...DEFAULT_ACCOUNT, ...JSON.parse(a) });
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    if (watchlist.length) {
      try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
      } catch {
        /* ignore */
      }
    }
  }, [watchlist]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    } catch {
      /* ignore */
    }
  }, [account]);

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
        `/api/stocks/intraday?symbols=${encodeURIComponent(symbols.join(","))}`,
        { signal: ctrl.signal, cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: IntradayResult[] };
      setResults(data.results);
      setLastUpdated(Date.now());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const okResults = useMemo(
    () => results.filter((r): r is { ok: true } & IntradaySignal => r.ok),
    [results],
  );
  const errResults = useMemo(
    () =>
      results.filter(
        (r): r is { ok: false; symbol: string; error: string } => !r.ok,
      ),
    [results],
  );

  const filtered = useMemo(() => {
    let xs = okResults;
    if (account.showOnlySetups) xs = xs.filter((s) => s.setup !== "NONE");
    const cmp = (a: IntradaySignal, b: IntradaySignal) => {
      switch (sortKey) {
        case "rvol":
          return b.rvol - a.rvol;
        case "rr":
          return b.rr - a.rr;
        case "atrPct":
          return b.atrPct - a.atrPct;
        case "gap":
          return Math.abs(b.gapPct) - Math.abs(a.gapPct);
        case "symbol":
          return a.symbol.localeCompare(b.symbol);
      }
    };
    return [...xs].sort(cmp);
  }, [okResults, sortKey, account.showOnlySetups]);

  const pdt = account.size > 0 && account.size < 25000;

  return (
    <div className="space-y-6">
      <RealityCheck pdt={pdt} />

      <div className="card p-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end">
        <div>
          <label className="label" htmlFor="account-size">
            Account size (USD)
          </label>
          <input
            id="account-size"
            className="input"
            type="number"
            min={0}
            step={100}
            value={account.size}
            onChange={(e) =>
              setAccount((a) => ({ ...a, size: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="w-32">
          <label className="label" htmlFor="risk-pct">
            Risk per trade
          </label>
          <div className="flex items-center gap-1">
            <input
              id="risk-pct"
              className="input"
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={account.riskPct}
              onChange={(e) =>
                setAccount((a) => ({
                  ...a,
                  riskPct: Math.max(0.1, Number(e.target.value) || 0.1),
                }))
              }
            />
            <span className="text-sm text-ink-500">%</span>
          </div>
        </div>
        <div className="text-xs text-ink-500">
          <div className="label">Max $ at risk</div>
          <div className="text-base font-semibold text-ink-800 tabular-nums">
            ${(account.size * (account.riskPct / 100)).toFixed(0)}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-600 select-none">
          <input
            type="checkbox"
            checked={account.showOnlySetups}
            onChange={(e) =>
              setAccount((a) => ({ ...a, showOnlySetups: e.target.checked }))
            }
          />
          Only show active setups
        </label>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="day-ticker">
            Add tickers
          </label>
          <input
            id="day-ticker"
            className="input"
            placeholder="e.g. NVDA, COIN, TSLA"
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
            : "—"}
        </div>
      </div>

      {error && (
        <div className="card p-3 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Live setups</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">Sort by</span>
            <select
              className="input py-1 text-xs w-auto"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="rvol">Relative volume (highest)</option>
              <option value="rr">Risk:Reward (highest)</option>
              <option value="atrPct">ATR % (most volatile)</option>
              <option value="gap">Gap size</option>
              <option value="symbol">Symbol A→Z</option>
            </select>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <Empty msg="Add some tickers above. Liquid names with daily ATR > 1% work best for day trading." />
        ) : filtered.length === 0 && !loading ? (
          <Empty
            msg={
              account.showOnlySetups
                ? "No active setups right now. Uncheck the filter to see the watchlist anyway, or wait for price action."
                : "No data yet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-ink-500 bg-ink-50">
                <tr>
                  <th className="text-left px-4 py-2">Symbol</th>
                  <th className="text-right px-3 py-2">Price</th>
                  <th className="text-right px-3 py-2">Gap</th>
                  <th className="text-right px-3 py-2">vs VWAP</th>
                  <th className="text-right px-3 py-2">RVOL</th>
                  <th className="text-right px-3 py-2">ATR%</th>
                  <th className="text-left px-3 py-2">Setup</th>
                  <th className="text-left px-3 py-2">Plan</th>
                  <th className="text-right px-3 py-2">Shares</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <Row
                    key={s.symbol}
                    s={s}
                    account={account}
                    onRemove={removeTicker}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {errResults.length > 0 && (
        <div className="card p-3 text-sm">
          <div className="text-xs font-semibold uppercase text-ink-500 mb-2">
            Could not load
          </div>
          <ul className="space-y-1">
            {errResults.map((e) => (
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

      <Playbook />
    </div>
  );
}

function Row({
  s,
  account,
  onRemove,
}: {
  s: IntradaySignal;
  account: AccountSettings;
  onRemove: (sym: string) => void;
}) {
  const dollarsAtRisk = (account.size * account.riskPct) / 100;
  const shares =
    s.riskPerShare > 0 && dollarsAtRisk > 0
      ? Math.floor(dollarsAtRisk / s.riskPerShare)
      : 0;
  const positionCost = shares * s.entry;
  const tooBig = positionCost > account.size && shares > 0;
  const dayUp = s.dayChangePct >= 0;

  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/40 align-top">
      <td className="px-4 py-3">
        <div className="font-semibold">{s.symbol}</div>
        <div className="text-[11px] text-ink-500 truncate max-w-[160px]">
          {s.name}
        </div>
        {!s.marketOpen && (
          <div className="text-[10px] text-amber-700 mt-0.5">Market closed</div>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <div>{fmtUsd(s.price)}</div>
        <div
          className={`text-[11px] inline-flex items-center gap-0.5 ${dayUp ? "text-green-700" : "text-red-700"}`}
        >
          {dayUp ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {s.dayChangePct.toFixed(2)}%
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span
          className={
            Math.abs(s.gapPct) > 2
              ? "font-semibold"
              : s.gapPct > 0
                ? "text-green-700"
                : "text-red-700"
          }
        >
          {s.gapPct >= 0 ? "+" : ""}
          {s.gapPct.toFixed(2)}%
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span
          className={s.vwapDistPct >= 0 ? "text-green-700" : "text-red-700"}
        >
          {s.vwapDistPct >= 0 ? "+" : ""}
          {s.vwapDistPct.toFixed(2)}%
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <RvolPill rvol={s.rvol} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {s.atrPct.toFixed(2)}%
      </td>
      <td className="px-3 py-3">
        <SetupPill setup={s.setup} bias={s.bias} />
      </td>
      <td className="px-3 py-3 text-[12px] tabular-nums text-ink-700">
        <div>
          {s.bias === "short" ? "Short" : "Long"}{" "}
          <strong>{fmtNum(s.entry)}</strong> · Stop{" "}
          <strong>{fmtNum(s.stop)}</strong> · Target{" "}
          <strong>{fmtNum(s.target)}</strong>
        </div>
        <div className="text-[11px] text-ink-500">
          R:R {s.rr.toFixed(2)} · Risk/share ${s.riskPerShare.toFixed(2)}
        </div>
        {s.notes[0] && (
          <div className="text-[11px] text-ink-500 mt-0.5">{s.notes[0]}</div>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {s.setup === "NONE" ? (
          <span className="text-ink-400">—</span>
        ) : shares > 0 ? (
          <>
            <div className="font-semibold">{shares}</div>
            <div
              className={`text-[11px] ${tooBig ? "text-amber-700" : "text-ink-500"}`}
            >
              ≈ ${fmtNum(positionCost)}
              {tooBig && " ⚠"}
            </div>
          </>
        ) : (
          <span className="text-ink-400">0</span>
        )}
      </td>
      <td className="px-2 py-3 text-right">
        <button
          className="btn-ghost text-xs px-2 py-1"
          onClick={() => onRemove(s.symbol)}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

function SetupPill({ setup, bias }: { setup: Setup; bias: IntradaySignal["bias"] }) {
  const labels: Record<Setup, string> = {
    GAP_AND_GO: "Gap & Go",
    ORB_LONG: "ORB Long",
    VWAP_RECLAIM: "VWAP Reclaim",
    FAILED_BREAKOUT_SHORT: "Failed BO Short",
    NONE: "—",
  };
  const styles: Record<Setup, string> = {
    GAP_AND_GO: "bg-green-600 text-white",
    ORB_LONG: "bg-green-100 text-green-800",
    VWAP_RECLAIM: "bg-brand-100 text-brand-800",
    FAILED_BREAKOUT_SHORT: "bg-red-100 text-red-800",
    NONE: "bg-ink-100 text-ink-500",
  };
  return (
    <div>
      <span
        className={`text-[11px] font-semibold tracking-wide px-2 py-1 rounded ${styles[setup]}`}
      >
        {labels[setup]}
      </span>
      {setup !== "NONE" && (
        <div className="text-[10px] uppercase text-ink-500 mt-1">
          {bias} bias
        </div>
      )}
    </div>
  );
}

function RvolPill({ rvol }: { rvol: number }) {
  const tone =
    rvol >= 2
      ? "bg-green-600 text-white"
      : rvol >= 1.2
        ? "bg-green-100 text-green-800"
        : rvol < 0.7
          ? "bg-red-50 text-red-700"
          : "bg-ink-100 text-ink-700";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded ${tone}`}>
      {rvol.toFixed(2)}x
    </span>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="p-8 text-center text-sm text-ink-500">{msg}</div>;
}

function RealityCheck({ pdt }: { pdt: boolean }) {
  return (
    <div className="card p-4 border-amber-200 bg-amber-50/40 text-[12px] leading-relaxed text-ink-700">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1.5">
          <div>
            <strong className="text-ink-900">Reality check.</strong> Multiple
            regulator studies (FINRA, AMF, Brazilian and Taiwanese exchange
            data) consistently find 70–90% of retail day traders lose money
            over time. The structure here — defined entries, hard stops, fixed
            position sizing — improves your odds vs. winging it. It does not
            change the base rate. Trade small until you have an edge that shows
            up across at least 30–50 trades.
          </div>
          {pdt && (
            <div>
              <strong>PDT rule:</strong> US accounts under $25,000 are limited
              to 3 day trades per rolling 5 business days. Pick your best setup
              of the day, don&apos;t spray.
            </div>
          )}
          <div>This page is a tool, not investment advice.</div>
        </div>
      </div>
    </div>
  );
}

function Playbook() {
  return (
    <div className="card p-4 text-[12px] leading-relaxed text-ink-700">
      <h3 className="text-sm font-semibold mb-2 text-ink-900">Setup playbook</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink-900">Gap &amp; Go (long)</dt>
          <dd>
            Stock gaps up &gt;2%, RVOL &gt; 1.5×, holds above VWAP, breaks the
            first 30-min high. Stop just under VWAP or the breakout level.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-900">ORB Long</dt>
          <dd>
            Price breaks the opening 30-min high with above-average volume.
            Stop just under the breakout level. Target = measured move (range
            of opening 30 min projected up).
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-900">VWAP Reclaim</dt>
          <dd>
            Lost VWAP earlier, now reclaimed it on a green bar with rising
            volume. Stop ¼ ATR under VWAP. Target = today&apos;s high.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-900">
            Failed Breakout (short)
          </dt>
          <dd>
            Price broke the opening high then failed back below it and below
            VWAP. Stop just above the failed high. Target = VWAP or opening
            range low.
          </dd>
        </div>
      </dl>
      <div className="mt-3 text-ink-500">
        Discipline beats analysis. Take only A+ setups, size from your stop
        (not your gut), and stop trading after two losers in a day.
      </div>
    </div>
  );
}

function fmtUsd(n: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: n < 10 ? 4 : 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

function fmtNum(n: number): string {
  return n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toFixed(2);
}
