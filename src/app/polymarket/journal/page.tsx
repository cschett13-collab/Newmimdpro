import Link from "next/link";
import { JournalApp } from "./JournalApp";

export const metadata = {
  title: "Bankroll Journal — Polymarket",
  description:
    "Personal trade journal with bankroll tracking, daily loss limits, and process metrics. All data stored locally in your browser.",
};

export default function JournalPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Polymarket
            </div>
            <h1 className="text-2xl font-semibold mt-1">Bankroll Journal</h1>
            <p className="text-sm text-ink-500 mt-1 max-w-2xl">
              Track every trade, enforce a daily loss limit, and watch your
              real win rate &amp; expectancy build up over time. The edge isn&rsquo;t
              picking winners — it&rsquo;s knowing your numbers and not
              breaking your rules.
            </p>
          </div>
          <Link href="/polymarket/leaderboard" className="btn-ghost">
            Leaderboard
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <JournalApp />
        <p className="text-xs text-ink-500 mt-8">
          Data is stored only in this browser&rsquo;s localStorage. Clearing
          your browser data will erase the journal — use Export JSON to back it
          up. No data is sent to any server.
        </p>
      </div>
    </main>
  );
}
