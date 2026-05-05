import Link from "next/link";
import { PlanApp } from "./PlanApp";

export const metadata = {
  title: "Pre-market plan & alert config",
  description:
    "Pre-commit your trades for the day with thesis, trigger, stop, target, and max stake. 10-minute stage timer between intent and execution. Exports Telegram alert config.",
};

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Polymarket
            </div>
            <h1 className="text-2xl font-semibold mt-1">Pre-market plan</h1>
            <p className="text-sm text-ink-500 mt-1 max-w-2xl">
              Write your trades <em>before</em> open, with thesis + trigger +
              stop + target + max size. Stage to start a 10-minute lock; only
              after the timer can you confirm to the journal. The same setups
              export as Telegram alerts so the bot pings you on your levels —
              not on someone else&rsquo;s tip.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/polymarket/leaderboard" className="btn-ghost">
              Leaderboard
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlanApp />
        <p className="text-xs text-ink-500 mt-8">
          All plan data is stored in this browser&rsquo;s localStorage.
          Telegram bot runs on your own machine using credentials in{" "}
          <code className="bg-ink-100 px-1 rounded">.env.local</code>.
        </p>
      </div>
    </main>
  );
}
