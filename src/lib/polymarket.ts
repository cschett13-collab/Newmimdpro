// Polymarket leaderboard API client.
//
// Polymarket exposes public leaderboard endpoints at lb-api.polymarket.com
// that return top traders by realized profit and total volume over a given
// time window. The response shape is best-effort — fields are decoded
// loosely so a minor API change doesn't blank the page.

export type LeaderboardWindow = "day" | "week" | "month" | "all";

export type LeaderboardKind = "profit" | "volume";

export type LeaderboardEntry = {
  rank: number;
  proxyWallet: string;
  name: string | null;
  pseudonym: string | null;
  profileImage: string | null;
  amount: number;
};

const BASE = "https://lb-api.polymarket.com";

export async function getLeaderboard(
  kind: LeaderboardKind,
  window: LeaderboardWindow,
  limit = 25,
): Promise<{ entries: LeaderboardEntry[]; error?: string }> {
  const url = `${BASE}/${kind}?interval=${window}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return {
        entries: [],
        error: `Polymarket returned ${res.status} ${res.statusText}`,
      };
    }
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      return { entries: [], error: "Unexpected response shape" };
    }
    const entries = json.slice(0, limit).map((raw, i) => normalize(raw, i));
    return { entries };
  } catch (err) {
    return {
      entries: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

function normalize(raw: unknown, idx: number): LeaderboardEntry {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : null;
  return {
    rank: idx + 1,
    proxyWallet: String(r.proxyWallet ?? r.wallet ?? r.address ?? ""),
    name: str(r.name) ?? str(r.displayUsername),
    pseudonym: str(r.pseudonym) ?? str(r.username),
    profileImage: str(r.profileImage) ?? str(r.image),
    amount: num(r.amount ?? r.profit ?? r.volume ?? r.value),
  };
}

export type Trade = {
  proxyWallet: string;
  trader: string;
  side: "BUY" | "SELL";
  outcome: string;
  price: number;
  size: number;
  notional: number;
  timestamp: number;
  marketTitle: string;
  marketSlug: string;
  eventSlug: string;
  icon: string | null;
  conditionId: string;
};

const DATA_BASE = "https://data-api.polymarket.com";

export async function getTrades(
  wallet: string,
  limit = 25,
): Promise<{ trades: Trade[]; error?: string }> {
  const url = `${DATA_BASE}/trades?user=${wallet}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return {
        trades: [],
        error: `Polymarket trades returned ${res.status}`,
      };
    }
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return { trades: [], error: "bad shape" };
    return { trades: json.map(normalizeTrade) };
  } catch (err) {
    return {
      trades: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

function normalizeTrade(raw: unknown): Trade {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : null;
  const side = String(r.side ?? "").toUpperCase() === "SELL" ? "SELL" : "BUY";
  const price = num(r.price);
  const size = num(r.size);
  return {
    proxyWallet: String(r.proxyWallet ?? ""),
    trader: String(r.name ?? r.pseudonym ?? "—"),
    side,
    outcome: String(r.outcome ?? ""),
    price,
    size,
    notional: price * size,
    timestamp: num(r.timestamp) * 1000,
    marketTitle: String(r.title ?? "Unknown market"),
    marketSlug: String(r.slug ?? ""),
    eventSlug: String(r.eventSlug ?? ""),
    icon: str(r.icon),
    conditionId: String(r.conditionId ?? ""),
  };
}

export type MarketActivity = {
  marketTitle: string;
  marketSlug: string;
  eventSlug: string;
  icon: string | null;
  conditionId: string;
  traders: Set<string>;
  totalNotional: number;
  buyNotional: number;
  sellNotional: number;
  outcomeNotional: Map<string, number>;
  trades: Trade[];
  lastActivity: number;
};

export function aggregateByMarket(allTrades: Trade[]): MarketActivity[] {
  const byMarket = new Map<string, MarketActivity>();
  for (const t of allTrades) {
    const key = t.conditionId || t.marketSlug;
    if (!key) continue;
    let m = byMarket.get(key);
    if (!m) {
      m = {
        marketTitle: t.marketTitle,
        marketSlug: t.marketSlug,
        eventSlug: t.eventSlug,
        icon: t.icon,
        conditionId: t.conditionId,
        traders: new Set(),
        totalNotional: 0,
        buyNotional: 0,
        sellNotional: 0,
        outcomeNotional: new Map(),
        trades: [],
        lastActivity: 0,
      };
      byMarket.set(key, m);
    }
    m.traders.add(t.trader);
    m.totalNotional += t.notional;
    if (t.side === "BUY") m.buyNotional += t.notional;
    else m.sellNotional += t.notional;
    m.outcomeNotional.set(
      t.outcome,
      (m.outcomeNotional.get(t.outcome) ?? 0) + t.notional,
    );
    m.trades.push(t);
    if (t.timestamp > m.lastActivity) m.lastActivity = t.timestamp;
  }
  return Array.from(byMarket.values()).sort(
    (a, b) =>
      b.traders.size - a.traders.size || b.totalNotional - a.totalNotional,
  );
}

export function shortWallet(addr: string): string {
  if (!addr) return "—";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function displayName(e: LeaderboardEntry): string {
  return e.name || e.pseudonym || shortWallet(e.proxyWallet);
}
