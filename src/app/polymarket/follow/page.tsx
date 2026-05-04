import Link from "next/link";
import {
  aggregateByMarket,
  displayName,
  getLeaderboard,
  getTrades,
  shortWallet,
  type LeaderboardEntry,
  type MarketActivity,
  type Trade,
} from "@/lib/polymarket";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 120;

export const metadata = {
  title: "What top Polymarket traders are betting on",
  description:
    "Recent activity from the top weekly profit makers on Polymarket. Aggregated by market to show consensus picks among top traders.",
};

const TRADERS_TO_FOLLOW = 10;
const TRADES_PER_TRADER = 25;

export default async function FollowPage() {
  const lb = await getLeaderboard("profit", "week", TRADERS_TO_FOLLOW);
  const topTraders = lb.entries.filter((e) => e.amount > 0);

  const tradeResults = await Promise.all(
    topTraders.map((t) => getTrades(t.proxyWallet, TRADES_PER_TRADER)),
  );

  const allTrades: Trade[] = tradeResults.flatMap((r) => r.trades);
  const markets = aggregateByMarket(allTrades).slice(0, 20);

  const fetchErrors = tradeResults.filter((r) => r.error).length;

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Polymarket
            </div>
            <h1 className="text-2xl font-semibold mt-1">
              What top traders are betting on
            </h1>
            <p className="text-sm text-ink-500 mt-1 max-w-2xl">
              Recent trades from the top {TRADERS_TO_FOLLOW} weekly profit
              makers, aggregated by market. Markets with the most distinct top
              traders bubble to the top.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/polymarket/leaderboard" className="btn-ghost">
              Leaderboard
            </Link>
            <Link href="/polymarket/journal" className="btn-ghost">
              My journal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong className="font-semibold">
            Read this before you copy a trade:
          </strong>{" "}
          By the time these trades show up here, the market has already moved.
          You&rsquo;re seeing what whales bought at $0.40; the price is now
          $0.55. Treat this as a research starting point, not a tip sheet.
          Whales also lose — leaderboards are survivor-biased.
        </div>

        {(lb.error || fetchErrors > 0) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {lb.error && <div>Leaderboard: {lb.error}</div>}
            {fetchErrors > 0 && (
              <div>
                {fetchErrors} of {topTraders.length} trader feeds failed to
                load.
              </div>
            )}
          </div>
        )}

        <section className="card p-5">
          <h2 className="font-semibold mb-1">Most-followed markets</h2>
          <p className="text-xs text-ink-500 mb-4">
            Markets that the most distinct top traders have touched recently.
          </p>
          {markets.length === 0 ? (
            <p className="text-sm text-ink-500">
              No recent trade activity from the top traders.
            </p>
          ) : (
            <div className="space-y-3">
              {markets.map((m) => (
                <MarketRow key={m.conditionId || m.marketSlug} market={m} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-semibold mb-4">Per-trader recent activity</h2>
          <div className="space-y-4">
            {topTraders.map((trader, i) => (
              <TraderFeed
                key={trader.proxyWallet}
                trader={trader}
                trades={tradeResults[i]?.trades ?? []}
                error={tradeResults[i]?.error}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MarketRow({ market }: { market: MarketActivity }) {
  const topOutcome = Array.from(market.outcomeNotional.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const polymarketUrl = market.eventSlug
    ? `https://polymarket.com/event/${market.eventSlug}`
    : null;
  return (
    <div className="rounded-lg border border-ink-100 p-3 flex items-start gap-3">
      {market.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={market.icon}
          alt=""
          className="h-10 w-10 rounded-lg object-cover bg-ink-100"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="h-10 w-10 rounded-lg bg-ink-100" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium">
          {polymarketUrl ? (
            <a
              href={polymarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {market.marketTitle}
            </a>
          ) : (
            market.marketTitle
          )}
        </div>
        <div className="text-xs text-ink-500 mt-1">
          {market.traders.size} top trader{market.traders.size === 1 ? "" : "s"}{" "}
          · {fmtMoney(market.totalNotional)} notional
          {topOutcome && (
            <>
              {" "}
              · most flow on{" "}
              <span className="font-medium text-ink-700">{topOutcome[0]}</span>{" "}
              ({fmtMoney(topOutcome[1])})
            </>
          )}
        </div>
        <div className="text-xs text-ink-500 mt-1">
          Buys {fmtMoney(market.buyNotional)} · Sells{" "}
          {fmtMoney(market.sellNotional)} · Last activity{" "}
          {timeAgo(market.lastActivity)}
        </div>
      </div>
    </div>
  );
}

function TraderFeed({
  trader,
  trades,
  error,
}: {
  trader: LeaderboardEntry;
  trades: Trade[];
  error?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {trader.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trader.profileImage}
              alt=""
              className="h-8 w-8 rounded-full object-cover bg-ink-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-ink-100" />
          )}
          <div>
            <div className="font-medium">{displayName(trader)}</div>
            <div className="text-xs text-ink-500 font-mono">
              {shortWallet(trader.proxyWallet)} ·{" "}
              {fmtMoney(trader.amount)} weekly profit
            </div>
          </div>
        </div>
      </div>
      {error && (
        <div className="text-xs text-red-700">Could not load trades: {error}</div>
      )}
      {!error && trades.length === 0 && (
        <div className="text-xs text-ink-500">No recent trades.</div>
      )}
      {trades.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ink-500">
              <tr className="text-left border-b border-ink-100">
                <th className="py-1.5 pr-3">Market</th>
                <th className="py-1.5 pr-3">Side</th>
                <th className="py-1.5 pr-3 text-right">Price</th>
                <th className="py-1.5 pr-3 text-right">Size</th>
                <th className="py-1.5 pr-3 text-right">Notional</th>
                <th className="py-1.5">When</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 10).map((t, i) => (
                <tr
                  key={`${t.timestamp}-${i}`}
                  className="border-b border-ink-100 last:border-0"
                >
                  <td className="py-1.5 pr-3">
                    <div className="font-medium truncate max-w-xs">
                      {t.marketTitle}
                    </div>
                    <div className="text-ink-500">{t.outcome}</div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={
                        t.side === "BUY"
                          ? "text-green-700 font-medium"
                          : "text-red-700 font-medium"
                      }
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {(t.price * 100).toFixed(1)}¢
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {t.size.toFixed(0)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium">
                    {fmtMoney(t.notional)}
                  </td>
                  <td className="py-1.5 text-ink-500">
                    {timeAgo(t.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
