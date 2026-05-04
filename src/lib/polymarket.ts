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
  const url = `${BASE}/${kind}?window=${window}&limit=${limit}`;
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

export function shortWallet(addr: string): string {
  if (!addr) return "—";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function displayName(e: LeaderboardEntry): string {
  return e.name || e.pseudonym || shortWallet(e.proxyWallet);
}
