// Bankroll-protection trade journal — types, storage, stats.
// All data lives in browser localStorage. Nothing is sent to any server.

export type TradeStatus = "open" | "won" | "lost" | "refund";

export type Trade = {
  id: string;
  market: string;
  side: string;
  stake: number;
  toWin: number;
  status: TradeStatus;
  openedAt: number;
  closedAt: number | null;
  notes: string;
};

export type JournalSettings = {
  startingBankroll: number;
  dailyLossLimitPct: number;
  enforceLock: boolean;
};

export type JournalState = {
  settings: JournalSettings;
  trades: Trade[];
};

export const STORAGE_KEY = "fvce_pm_journal_v1";

export const DEFAULT_STATE: JournalState = {
  settings: {
    startingBankroll: 0,
    dailyLossLimitPct: 5,
    enforceLock: true,
  },
  trades: [],
};

export function loadState(): JournalState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<JournalState>;
    return {
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings ?? {}) },
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: JournalState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function tradePnL(t: Trade): number {
  if (t.status === "won") return t.toWin;
  if (t.status === "lost") return -t.stake;
  return 0;
}

export function isToday(ts: number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export type Stats = {
  bankrollNow: number;
  totalPnL: number;
  todayPnL: number;
  todayLossLimit: number;
  todayLossUsedPct: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  rMultiple: number;
  lockTriggered: boolean;
};

export function computeStats(state: JournalState): Stats {
  const closed = state.trades.filter(
    (t) => t.status === "won" || t.status === "lost",
  );
  const wins = closed.filter((t) => t.status === "won");
  const losses = closed.filter((t) => t.status === "lost");

  const totalPnL = state.trades.reduce((s, t) => s + tradePnL(t), 0);
  const todayPnL = state.trades
    .filter((t) => t.closedAt && isToday(t.closedAt))
    .reduce((s, t) => s + tradePnL(t), 0);

  const todayLossLimit =
    state.settings.startingBankroll * (state.settings.dailyLossLimitPct / 100);
  const todayLossUsedPct =
    todayLossLimit > 0 && todayPnL < 0
      ? Math.min(100, (Math.abs(todayPnL) / todayLossLimit) * 100)
      : 0;

  const totalWin = wins.reduce((s, t) => s + t.toWin, 0);
  const totalLoss = losses.reduce((s, t) => s + t.stake, 0);
  const avgWin = wins.length ? totalWin / wins.length : 0;
  const avgLoss = losses.length ? totalLoss / losses.length : 0;
  const winRate = closed.length ? wins.length / closed.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const rMultiple = avgLoss > 0 ? avgWin / avgLoss : 0;

  const lockTriggered =
    state.settings.enforceLock &&
    todayLossLimit > 0 &&
    todayPnL <= -todayLossLimit;

  return {
    bankrollNow: state.settings.startingBankroll + totalPnL,
    totalPnL,
    todayPnL,
    todayLossLimit,
    todayLossUsedPct,
    openTrades: state.trades.length - closed.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    rMultiple,
    lockTriggered,
  };
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function exportJson(state: JournalState): string {
  return JSON.stringify(state, null, 2);
}
