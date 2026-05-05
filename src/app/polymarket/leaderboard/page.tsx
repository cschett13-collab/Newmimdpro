import Link from "next/link";
import {
  displayName,
  getLeaderboard,
  shortWallet,
  type LeaderboardEntry,
} from "@/lib/polymarket";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Polymarket Leaderboard — Weekly & Monthly Winners",
  description:
    "Top Polymarket traders by realized profit, weekly and monthly. Highlights traders with a consistent track record across both windows.",
};

const LIMIT = 50;

export default async function LeaderboardPage() {
  const [week, month] = await Promise.all([
    getLeaderboard("profit", "week", LIMIT),
    getLeaderboard("profit", "month", LIMIT),
  ]);

  const weekWinners = week.entries.filter((e) => e.amount > 0);
  const monthWinners = month.entries.filter((e) => e.amount > 0);

  const monthByWallet = new Map(
    monthWinners.map((e) => [e.proxyWallet.toLowerCase(), e]),
  );
  const consistent = weekWinners
    .filter((e) => monthByWallet.has(e.proxyWallet.toLowerCase()))
    .map((e) => ({
      week: e,
      month: monthByWallet.get(e.proxyWallet.toLowerCase())!,
      combined:
        e.amount + (monthByWallet.get(e.proxyWallet.toLowerCase())?.amount ?? 0),
    }))
    .sort((a, b) => b.combined - a.combined)
    .slice(0, 15);

  const apiError = week.error || month.error;

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Polymarket
            </div>
            <h1 className="text-2xl font-semibold mt-1">Top Winners</h1>
            <p className="text-sm text-ink-500 mt-1 max-w-2xl">
              Traders ranked by realized profit. Only positive-PnL accounts
              shown. Refreshes every 60 seconds.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/polymarket/plan" className="btn-ghost">
              Plan
            </Link>
            <Link href="/polymarket/follow" className="btn-ghost">
              What they&rsquo;re betting
            </Link>
            <Link href="/polymarket/journal" className="btn-ghost">
              My journal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {apiError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong className="font-semibold">Polymarket API error:</strong>{" "}
            {apiError}
          </div>
        )}

        <section className="card p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Consistent Winners — Weekly &amp; Monthly
            </h2>
            <span className="text-xs text-ink-500">
              Top of both lists · ranked by combined PnL
            </span>
          </div>
          {consistent.length === 0 ? (
            <p className="text-sm text-ink-500">
              No traders are currently ranked in both the weekly and monthly top{" "}
              {LIMIT}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-500">
                  <tr className="text-left border-b border-ink-100">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Trader</th>
                    <th className="py-2 pr-3">Wallet</th>
                    <th className="py-2 pr-3 text-right">Week PnL</th>
                    <th className="py-2 pr-3 text-right">Month PnL</th>
                    <th className="py-2 text-right">Combined</th>
                  </tr>
                </thead>
                <tbody>
                  {consistent.map((row, i) => (
                    <tr
                      key={row.week.proxyWallet}
                      className="border-b border-ink-100 last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium">{i + 1}</td>
                      <td className="py-2 pr-3">
                        <TraderCell entry={row.week} />
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-ink-500">
                        {shortWallet(row.week.proxyWallet)}
                      </td>
                      <td className="py-2 pr-3 text-right text-green-700 font-medium">
                        {fmtMoney(row.week.amount)}
                      </td>
                      <td className="py-2 pr-3 text-right text-green-700 font-medium">
                        {fmtMoney(row.month.amount)}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {fmtMoney(row.combined)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <LeaderboardCard
            title="This Week's Winners"
            subtitle="Top traders by 7-day profit"
            entries={weekWinners}
          />
          <LeaderboardCard
            title="This Month's Winners"
            subtitle="Top traders by 30-day profit"
            entries={monthWinners}
          />
        </div>

        <p className="text-xs text-ink-500">
          Source: lb-api.polymarket.com · Track records reflect realized PnL on
          Polymarket only and are not predictive. Tailing top traders is not a
          strategy — by the time positions are visible, the odds have already
          moved.
        </p>
      </div>
    </main>
  );
}

function LeaderboardCard({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: LeaderboardEntry[];
}) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-500">No data.</p>
      ) : (
        <ol className="divide-y divide-ink-100">
          {entries.slice(0, 25).map((e) => (
            <li
              key={e.proxyWallet}
              className="py-2.5 flex items-center gap-3"
            >
              <span className="w-6 text-right text-sm font-medium text-ink-500">
                {e.rank}
              </span>
              <div className="flex-1 min-w-0">
                <TraderCell entry={e} />
                <div className="font-mono text-xs text-ink-500 truncate">
                  {shortWallet(e.proxyWallet)}
                </div>
              </div>
              <span className="text-sm font-semibold text-green-700">
                {fmtMoney(e.amount)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TraderCell({ entry }: { entry: LeaderboardEntry }) {
  const name = displayName(entry);
  return (
    <div className="flex items-center gap-2 min-w-0">
      {entry.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.profileImage}
          alt=""
          className="h-6 w-6 rounded-full bg-ink-100 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="h-6 w-6 rounded-full bg-ink-100" />
      )}
      <span className="truncate font-medium">{name}</span>
    </div>
  );
}
