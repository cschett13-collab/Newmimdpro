"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PLAN_STATE,
  isStaged,
  isUnlocked,
  loadPlans,
  newPlanId,
  planLabel,
  plansToAlerts,
  savePlans,
  STAGE_TIMER_MS,
  timeRemaining,
  todayDateStr,
  type PlanRow,
  type PlanState,
  type PlanType,
} from "@/lib/plan";
import {
  loadState as loadJournal,
  newId as newJournalId,
  saveState as saveJournal,
  type Trade as JournalTrade,
} from "@/lib/journal";
import { fmtMoney } from "@/lib/format";

export function PlanApp() {
  const [state, setState] = useState<PlanState>(DEFAULT_PLAN_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    setState(loadPlans());
    setHydrated(true);
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (hydrated) savePlans(state);
  }, [state, hydrated]);

  const today = todayDateStr();
  const todays = useMemo(
    () => state.plans.filter((p) => p.date === today),
    [state.plans, today],
  );
  const past = useMemo(
    () => state.plans.filter((p) => p.date !== today).slice(0, 30),
    [state.plans, today],
  );

  if (!hydrated) return <div className="text-sm text-ink-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <NewPlanForm
        onAdd={(p) => setState({ ...state, plans: [p, ...state.plans] })}
      />
      <PlanList
        title="Today's plan"
        plans={todays}
        empty="No plan yet for today. Write your setups before market open. The form is your friction."
        onUpdate={(updater) =>
          setState({ ...state, plans: state.plans.map(updater) })
        }
        onDelete={(id) =>
          setState({ ...state, plans: state.plans.filter((p) => p.id !== id) })
        }
      />
      <AlertExport plans={todays} />
      {past.length > 0 && (
        <PlanList
          title="Past plans (read-only)"
          plans={past}
          empty=""
          readonly
          onUpdate={() => {}}
          onDelete={() => {}}
        />
      )}
    </div>
  );
}

function NewPlanForm({ onAdd }: { onAdd: (p: PlanRow) => void }) {
  const [type, setType] = useState<PlanType>("stock");
  const [symbol, setSymbol] = useState("");
  const [outcome, setOutcome] = useState("Yes");
  const [thesis, setThesis] = useState("");
  const [trigger, setTrigger] = useState<"above" | "below">("above");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [maxStake, setMaxStake] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const tp = Number(triggerPrice);
    const st = Number(stop);
    const tg = Number(target);
    const ms = Number(maxStake);
    if (!symbol || !thesis || !tp || !ms) return;
    const plan: PlanRow = {
      id: newPlanId(),
      date: todayDateStr(),
      type,
      symbol: symbol.trim(),
      outcome: type === "polymarket" ? outcome.trim() || "Yes" : "",
      thesis: thesis.trim(),
      trigger,
      triggerPrice: tp,
      stop: st,
      target: tg,
      maxStake: ms,
      status: "pending",
      stagedAt: null,
      createdAt: Date.now(),
    };
    onAdd(plan);
    setSymbol("");
    setThesis("");
    setTriggerPrice("");
    setStop("");
    setTarget("");
    setMaxStake("");
  };

  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-1">Add a setup</h2>
      <p className="text-xs text-ink-500 mb-4">
        Each setup is a pre-committed plan: thesis, trigger price, stop,
        target, max size. No setups today = no trades today.
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="label">Type</label>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as PlanType)}
          >
            <option value="stock">Stock / Crypto ticker</option>
            <option value="polymarket">Polymarket slug</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            {type === "polymarket" ? "Market slug" : "Ticker"}
          </label>
          <input
            className="input"
            placeholder={type === "polymarket" ? "manchester-city-..." : "MU"}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </div>
        {type === "polymarket" && (
          <div className="sm:col-span-2">
            <label className="label">Outcome</label>
            <input
              className="input"
              placeholder="Yes or No"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
        )}
        <div className="sm:col-span-6">
          <label className="label">Thesis (required)</label>
          <input
            className="input"
            placeholder="Why this trade? In one sentence."
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Trigger</label>
          <div className="flex gap-2">
            <select
              className="input"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as "above" | "below")}
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder={type === "polymarket" ? "0.55" : "85.00"}
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="sm:col-span-1">
          <label className="label">Stop</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </div>
        <div className="sm:col-span-1">
          <label className="label">Target</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Max stake ($)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={maxStake}
            onChange={(e) => setMaxStake(e.target.value)}
          />
        </div>
        <div className="sm:col-span-6">
          <button type="submit" className="btn-primary">
            Add to today&rsquo;s plan
          </button>
        </div>
      </form>
    </section>
  );
}

function PlanList({
  title,
  plans,
  empty,
  readonly,
  onUpdate,
  onDelete,
}: {
  title: string;
  plans: PlanRow[];
  empty: string;
  readonly?: boolean;
  onUpdate: (updater: (p: PlanRow) => PlanRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-4">{title}</h2>
      {plans.length === 0 ? (
        <p className="text-sm text-ink-500">{empty}</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <PlanRowCard
              key={p.id}
              plan={p}
              readonly={readonly}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanRowCard({
  plan,
  readonly,
  onUpdate,
  onDelete,
}: {
  plan: PlanRow;
  readonly?: boolean;
  onUpdate: (updater: (p: PlanRow) => PlanRow) => void;
  onDelete: (id: string) => void;
}) {
  const ms = timeRemaining(plan.stagedAt);
  const staged = isStaged(plan);
  const unlocked = isUnlocked(plan);

  const stage = () =>
    onUpdate((p) =>
      p.id === plan.id ? { ...p, status: "staged", stagedAt: Date.now() } : p,
    );
  const cancel = () =>
    onUpdate((p) =>
      p.id === plan.id ? { ...p, status: "pending", stagedAt: null } : p,
    );
  const skip = () =>
    onUpdate((p) =>
      p.id === plan.id ? { ...p, status: "skipped", stagedAt: null } : p,
    );

  const confirmToJournal = () => {
    const journal = loadJournal();
    const trade: JournalTrade = {
      id: newJournalId(),
      market: plan.symbol + (plan.outcome ? ` (${plan.outcome})` : ""),
      side: `${plan.trigger} ${plan.triggerPrice}`,
      stake: plan.maxStake,
      toWin: 0,
      status: "open",
      openedAt: Date.now(),
      closedAt: null,
      notes: plan.thesis,
    };
    saveJournal({ ...journal, trades: [trade, ...journal.trades] });
    onUpdate((p) =>
      p.id === plan.id ? { ...p, status: "executed", stagedAt: null } : p,
    );
  };

  const status = plan.status;
  const tone =
    status === "executed"
      ? "border-green-200 bg-green-50"
      : status === "skipped"
        ? "border-ink-200 bg-ink-50 opacity-60"
        : staged
          ? "border-amber-300 bg-amber-50"
          : unlocked
            ? "border-blue-300 bg-blue-50"
            : "border-ink-100";

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{planLabel(plan)}</div>
          <div className="text-xs text-ink-600 mt-0.5">{plan.thesis}</div>
          <div className="text-xs text-ink-500 mt-1">
            Stop {plan.stop || "—"} · Target {plan.target || "—"} · Max{" "}
            {fmtMoney(plan.maxStake)}
          </div>
        </div>
        <span
          className={`text-xs uppercase tracking-wide font-semibold ${
            status === "executed"
              ? "text-green-700"
              : status === "skipped"
                ? "text-ink-500"
                : staged
                  ? "text-amber-800"
                  : unlocked
                    ? "text-blue-700"
                    : "text-ink-500"
          }`}
        >
          {status}
        </span>
      </div>

      {!readonly && status !== "executed" && status !== "skipped" && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {!staged && !unlocked && (
            <>
              <button className="btn-primary text-xs" onClick={stage}>
                Stage trade (10 min lock)
              </button>
              <button className="btn-ghost text-xs" onClick={skip}>
                Skip
              </button>
              <button
                className="text-xs text-red-700 hover:underline ml-auto"
                onClick={() => onDelete(plan.id)}
              >
                Delete
              </button>
            </>
          )}
          {staged && (
            <>
              <div className="text-sm font-mono">
                Wait {formatRemaining(ms)} — review your thesis. Don&rsquo;t open
                Telegram.
              </div>
              <button
                className="text-xs text-amber-800 hover:underline ml-auto"
                onClick={cancel}
              >
                Cancel staging
              </button>
            </>
          )}
          {unlocked && (
            <>
              <button className="btn-primary text-xs" onClick={confirmToJournal}>
                Confirm → log to journal
              </button>
              <button className="btn-ghost text-xs" onClick={cancel}>
                Reset (re-stage)
              </button>
              <button className="btn-ghost text-xs" onClick={skip}>
                Stand down
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function AlertExport({ plans }: { plans: PlanRow[] }) {
  const alerts = plansToAlerts(plans);
  const json = JSON.stringify(alerts, null, 2);
  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alerts.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = () => navigator.clipboard.writeText(json);

  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-1">Telegram alert config</h2>
      <p className="text-xs text-ink-500 mb-3">
        These are the trigger prices the bot will watch. Save{" "}
        <code className="bg-ink-100 px-1 rounded">alerts.json</code> to the
        repo root, set <code className="bg-ink-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code>{" "}
        + <code className="bg-ink-100 px-1 rounded">TELEGRAM_CHAT_ID</code> in{" "}
        <code className="bg-ink-100 px-1 rounded">.env.local</code>, then run{" "}
        <code className="bg-ink-100 px-1 rounded">node scripts/alert-bot.mjs</code>.
      </p>
      {alerts.length === 0 ? (
        <p className="text-sm text-ink-500">No active setups to watch.</p>
      ) : (
        <>
          <pre className="text-xs bg-ink-50 border border-ink-100 rounded-lg p-3 overflow-x-auto">
            {json}
          </pre>
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost text-xs" onClick={download}>
              Download alerts.json
            </button>
            <button className="btn-ghost text-xs" onClick={copy}>
              Copy JSON
            </button>
          </div>
        </>
      )}
    </section>
  );
}
