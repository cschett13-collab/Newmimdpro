import { StocksClient } from "./StocksClient";

export const dynamic = "force-dynamic";

export default function StocksPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Buy-the-dip screener</h1>
        <p className="text-sm text-ink-500 mt-1">
          Live quotes from public market data, scored against RSI, moving
          averages, and distance from 52-week high. Watchlist saves to this
          browser.
        </p>
      </div>
      <StocksClient />
    </>
  );
}
