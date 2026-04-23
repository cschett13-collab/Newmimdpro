import Link from "next/link";
import { redirect } from "next/navigation";
import { getClients } from "@/lib/clients";
import { Building2, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const clients = getClients();
  if (clients.length === 1) redirect(`/c/${clients[0].id}`);

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Fox Valley Client Engine
            </div>
            <h1 className="text-xl font-semibold">Client Portal</h1>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-lg font-semibold mb-4">Select a client</h2>
        {clients.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.id}`}
                  className="card p-4 flex items-center gap-3 hover:border-brand-300 transition"
                >
                  <div
                    className="h-10 w-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-semibold"
                    style={
                      c.primaryColor
                        ? { background: `${c.primaryColor}22`, color: c.primaryColor }
                        : undefined
                    }
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-ink-500 truncate">
                      Location {c.locationId}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
        <Plus className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold">No clients configured yet</h3>
      <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
        Add clients by setting the <code className="text-ink-800">PORTAL_CLIENTS</code>{" "}
        environment variable. Each entry is one HighLevel sub-account with a
        Private Integration Token. See the README for details.
      </p>
    </div>
  );
}
