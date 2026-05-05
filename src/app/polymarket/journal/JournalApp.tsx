"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeStats,
  DEFAULT_STATE,
  exportJson,
  loadState,
  newId,
  saveState,
  tradePnL,
  type JournalState,
  type Trade,
  type TradeStatus,
} from "@/lib/journal";
import { fmtMoney, fmtPct } from "@/lib/format";

export function JournalApp() {
  const [state, setState] = useState<JournalState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const stats = useMemo(() => computeStats(state), [state]);

  if (!hydrated) {
    return <div className="text-sm text-ink-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {stats.lockTriggered && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="font-semibold text-red-900">
            Daily loss limit hit. Stop for today.
          </div>
          <p className="text-sm text-red-800 mt-1">
            You&rsquo;ve lost {fmtMoney(Math.abs(stats.todayPnL))} today, at or
            beyond your {state.settings.dailyLossLimitPct}% daily limit
            ({fmtMoney(stats.todayLossLimit)}). Trade entry is locked. The
            biggest single edge a retail trader has is the discipline to walk
            away on red days. Come back tomorrow.
          </p>
        </div>
      )}

      <Settings state={state} setState={setState} />
      <StatsPanel stats={stats} state={state} />
      <NewTradeForm
        state={state}
        setState={setState}
        locked={stats.lockTriggered}
      />
      <TradeList state={state} setState={setState} />
      <DangerZone state={state} setState={setState} />
    </div>
  );
}

function Settings({
  state,
  setState,
}: {
  state: JournalState;
  setState: (s: JournalState) => void;
}) {
  const update = (patch: Partial<JournalState["settings"]>) =>
    setState({ ...state, settings: { ...state.settings, ...patch } });
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-4">Bankroll &amp; rules</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Starting bankroll ($)</label>
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            value={state.settings.startingBankroll || ""}
            onChange={(e) =>
              update({ startingBankroll: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="label">Daily loss limit (%)</label>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={state.settings.dailyLossLimitPct || ""}
            onChange={(e) =>
              update({ dailyLossLimitPct: Number(e.target.value) || 0 })
            }
          />
          <p className="text-xs text-ink-500 mt-1">
            5% is the upper bound for serious traders. 1–2% is healthier.
          </p>
        </div>
        <div>
          <label className="label">Enforce lock</label>
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={state.settings.enforceLock}
              onChange={(e) => update({ enforceLock: e.target.checked })}
            />
            <span className="text-sm">
              Block new trades after limit hit
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}

function StatsPanel({
  stats,
  state,
}: {
  stats: ReturnType<typeof computeStats>;
  state: JournalState;
}) {
  const items = [
    {
      label: "Bankroll now",
      value: fmtMoney(stats.bankrollNow),
      hint: `Starting ${fmtMoney(state.settings.startingBankroll)}`,
    },
    {
      label: "Total PnL",
      value: fmtMoney(stats.totalPnL),
      positive: stats.totalPnL >= 0,
    },
    {
      label: "Today's PnL",
      value: fmtMoney(stats.todayPnL),
      positive: stats.todayPnL >= 0,
      hint:
        stats.todayLossLimit > 0
          ? `Limit ${fmtMoney(stats.todayLossLimit)} (${stats.todayLossUsedPct.toFixed(
              0,
            )}% used)`
          : "Set a limit above",
    },
    {
      label: "Win rate",
      value: stats.closedTrades ? fmtPct(stats.winRate) : "—",
      hint: `${stats.wins}W / ${stats.losses}L · ${stats.openTrades} open`,
    },
    {
      label: "Avg win / loss",
      value:
        stats.avgWin || stats.avgLoss
          ? `${fmtMoney(stats.avgWin)} / ${fmtMoney(stats.avgLoss)}`
          : "—",
    },
    {
      label: "R multiple",
      value: stats.rMultiple ? `${stats.rMultiple.toFixed(2)}R` : "—",
      hint: "Avg win ÷ avg loss · ≥1.5 is healthy",
    },
    {
      label: "Expectancy",
      value: stats.closedTrades ? fmtMoney(stats.expectancy) : "—",
      hint: "Per-trade EV based on your history",
      positive: stats.expectancy >= 0,
    },
  ];
  return (
    <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-500">
            {it.label}
          </div>
          <div
            className={`mt-1 text-xl font-semibold ${
              it.positive === true
                ? "text-green-700"
                : it.positive === false
                  ? "text-red-700"
                  : ""
            }`}
          >
            {it.value}
          </div>
          {it.hint && (
            <div className="text-xs text-ink-500 mt-1">{it.hint}</div>
          )}
        </div>
      ))}
    </section>
  );
}

function NewTradeForm({
  state,
  setState,
  locked,
}: {
  state: JournalState;
  setState: (s: JournalState) => void;
  locked: boolean;
}) {
  const [market, setMarket] = useState("");
  const [side, setSide] = useState("");
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const [notes, setNotes] = useState("");

  const stakeNum = Number(stake) || 0;
  const oddsNum = Number(odds) || 0;
  const toWin =
    oddsNum > 0 && oddsNum < 100
      ? stakeNum * ((100 - oddsNum) / oddsNum)
      : 0;

  const pctOfBankroll =
    state.settings.startingBankroll > 0
      ? (stakeNum / state.settings.startingBankroll) * 100
      : 0;
  const oversize = pctOfBankroll > 5;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    if (!market || stakeNum <= 0) return;
    const trade: Trade = {
      id: newId(),
      market,
      side,
      stake: stakeNum,
      toWin: toWin || 0,
      status: "open",
      openedAt: Date.now(),
      closedAt: null,
      notes,
    };
    setState({ ...state, trades: [trade, ...state.trades] });
    setMarket("");
    setSide("");
    setStake("");
    setOdds("");
    setNotes("");
  };

  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-4">Log a trade</h2>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label className="label">Market</label>
          <input
            className="input"
            placeholder="e.g. Mumbai Indians vs Lucknow"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Side</label>
          <input
            className="input"
            placeholder="e.g. Lucknow YES"
            value={side}
            onChange={(e) => setSide(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Stake ($)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            disabled={locked}
          />
          {oversize && (
            <div className="text-xs text-amber-700 mt-1">
              That&rsquo;s {pctOfBankroll.toFixed(1)}% of your bankroll. Pros
              risk 1–2% per trade.
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Entry odds (%)</label>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">To win ($)</label>
          <div className="input bg-ink-50">
            {toWin ? fmtMoney(toWin) : "—"}
          </div>
        </div>
        <div className="sm:col-span-6">
          <label className="label">Reason (required for discipline)</label>
          <input
            className="input"
            placeholder="Why this trade? (no reason = no trade)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="sm:col-span-6">
          <button
            type="submit"
            className="btn-primary"
            disabled={locked || !market || stakeNum <= 0 || !notes}
          >
            {locked ? "Locked — daily limit hit" : "Log trade"}
          </button>
        </div>
      </form>
    </section>
  );
}

function TradeList({
  state,
  setState,
}: {
  state: JournalState;
  setState: (s: JournalState) => void;
}) {
  const update = (id: string, patch: Partial<Trade>) =>
    setState({
      ...state,
      trades: state.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const remove = (id: string) =>
    setState({ ...state, trades: state.trades.filter((t) => t.id !== id) });

  const setStatus = (id: string, status: TradeStatus) =>
    update(id, {
      status,
      closedAt: status === "open" ? null : Date.now(),
    });

  if (state.trades.length === 0) {
    return (
      <section className="card p-5 text-sm text-ink-500">
        No trades logged yet. Every trade — wins, losses, scratched — gets
        logged here. Reviewing the list weekly is where the real edge comes
        from.
      </section>
    );
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-4">Trade history</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-500">
            <tr className="text-left border-b border-ink-100">
              <th className="py-2 pr-3">Market / Side</th>
              <th className="py-2 pr-3 text-right">Stake</th>
              <th className="py-2 pr-3 text-right">To win</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right">PnL</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {state.trades.map((t) => {
              const pnl = tradePnL(t);
              return (
                <tr key={t.id} className="border-b border-ink-100 last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{t.market}</div>
                    <div className="text-xs text-ink-500">{t.side}</div>
                    {t.notes && (
                      <div className="text-xs text-ink-500 italic mt-1">
                        {t.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{fmtMoney(t.stake)}</td>
                  <td className="py-2 pr-3 text-right">{fmtMoney(t.toWin)}</td>
                  <td className="py-2 pr-3">
                    <select
                      className="input py-1 text-xs"
                      value={t.status}
                      onChange={(e) =>
                        setStatus(t.id, e.target.value as TradeStatus)
                      }
                    >
                      <option value="open">Open</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                      <option value="refund">Refund</option>
                    </select>
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium ${
                      pnl > 0
                        ? "text-green-700"
                        : pnl < 0
                          ? "text-red-700"
                          : "text-ink-500"
                    }`}
                  >
                    {t.status === "open" ? "—" : fmtMoney(pnl)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="text-xs text-ink-500 hover:text-red-700"
                      onClick={() => {
                        if (confirm("Delete this trade?")) remove(t.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DangerZone({
  state,
  setState,
}: {
  state: JournalState;
  setState: (s: JournalState) => void;
}) {
  const download = () => {
    const blob = new Blob([exportJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polymarket-journal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => {
    if (
      confirm(
        "Wipe all journal data? This cannot be undone. Export first if you want a backup.",
      )
    ) {
      setState(DEFAULT_STATE);
    }
  };
  return (
    <section className="flex items-center justify-between gap-3 text-sm">
      <button className="btn-ghost" onClick={download}>
        Export JSON
      </button>
      <button
        className="text-red-700 hover:underline text-xs"
        onClick={reset}
      >
        Reset journal
      </button>
    </section>
  );
}
