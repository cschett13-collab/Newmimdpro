import Link from "next/link";
import { ArrowLeft, LineChart, LogOut } from "lucide-react";
import { StocksTabs } from "./StocksTabs";

export const dynamic = "force-dynamic";

export default function StocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="btn-ghost text-xs px-2 py-1"
              aria-label="Back to portal"
            >
              <ArrowLeft className="h-4 w-4" />
              Portal
            </Link>
            <div className="h-9 w-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <LineChart className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-400">
                Fox Valley Client Engine
              </div>
              <div className="text-sm font-semibold">Stock Signals</div>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <StocksTabs />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
