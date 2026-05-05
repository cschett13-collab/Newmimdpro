import Link from "next/link";
import { getBalance, getOpenOrders, getPositions, isConfigured } from "@/lib/polymarket-us";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "My Polymarket US positions",
  description: "Read-only view of your live Polymarket US balance, positions, and open orders.",
};

export default async function PositionsPage() {
  const configured = isConfigured();

  let positions: unknown = null;
  let balance: unknown = null;
  let orders: unknown = null;
  let errors: string[] = [];

  if (configured) {
    const [p, b, o] = await Promise.all([getPositions(), getBalance(), getOpenOrders()]);
    if (p.ok) positions = p.data;
    else errors.push(`positions: ${p.status} ${truncate(p.error)}`);
    if (b.ok) balance = b.data;
    else errors.push(`balance: ${b.status} ${truncate(b.error)}`);
    if (o.ok) orders = o.data;
    else errors.push(`orders: ${o.status} ${truncate(o.error)}`);
  }

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">Account</div>
            <h1 className="text-2xl font-semibold mt-1">Polymarket US — read-only</h1>
            <p className="text-sm text-ink-500 mt-1 max-w-2xl">
              Server-side view of your live positions, balance, and open orders.
              Keys live in <code className="bg-ink-100 px-1 rounded">.env.local</code> and
              never reach the browser.
            </p>
          </div>
          <Link href="/polymarket/plan" className="btn-ghost">Plan</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {!configured && (
          <div className="card p-5">
            <h2 className="font-semibold mb-2">Not configured yet</h2>
            <ol className="text-sm text-ink-700 space-y-2 list-decimal pl-5">
              <li>
                Generate API keys at{" "}
                <a
                  href="https://polymarket.us/account/api-keys"
                  className="text-brand-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  polymarket.us/account/api-keys
                </a>
                . <strong>Use a read-only key for first setup.</strong>
              </li>
              <li>
                Edit <code className="bg-ink-100 px-1 rounded">.env.local</code>:
                <pre className="bg-ink-50 border border-ink-100 rounded p-3 mt-2 text-xs overflow-x-auto">
{`POLYMARKET_US_KEY_ID=...
POLYMARKET_US_SECRET_KEY=...`}
                </pre>
              </li>
              <li>Restart <code className="bg-ink-100 px-1 rounded">npm run dev</code>.</li>
              <li>Reload this page.</li>
            </ol>
            <p className="text-xs text-ink-500 mt-4">
              Never paste these keys into chat, Telegram, or any app. They live only
              in your local <code>.env.local</code>.
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="font-semibold mb-1">API errors</div>
            <ul className="list-disc pl-5 space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="font-mono text-xs">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {configured && (
          <>
            <DataCard title="Balance" data={balance} />
            <DataCard title="Positions" data={positions} />
            <DataCard title="Open orders" data={orders} />
          </>
        )}
      </div>
    </main>
  );
}

function DataCard({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {data == null ? (
        <p className="text-sm text-ink-500">No data.</p>
      ) : (
        <pre className="bg-ink-50 border border-ink-100 rounded-lg p-3 text-xs overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}

function truncate(s: string, n = 200): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
