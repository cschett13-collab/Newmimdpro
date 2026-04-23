import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { getClient } from "@/lib/clients";
import { getDrafts } from "@/lib/ops";
import { PageHeader } from "@/components/PageHeader";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { fmtDateTime, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DraftsPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { status?: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();

  const { drafts, source, error } = await getDrafts();

  const filter = searchParams.status ?? "ready";
  const filtered =
    filter === "all" ? drafts : drafts.filter((d) => d.status === filter);

  const counts = {
    ready: drafts.filter((d) => d.status === "ready").length,
    sent: drafts.filter((d) => d.status === "sent").length,
    skipped: drafts.filter((d) => d.status === "skipped").length,
    all: drafts.length,
  };

  return (
    <>
      <PageHeader
        title="Outbound drafts"
        subtitle={`${fmtNumber(counts.ready)} ready to send · sourced from ${source}`}
      />
      <div className="p-6 lg:p-8 space-y-4">
        {error && (
          <ApiErrorBanner title="Couldn't load drafts" detail={error} />
        )}

        <nav className="flex gap-2 text-sm">
          <FilterTab
            clientId={client.id}
            value="ready"
            active={filter === "ready"}
            label={`Ready (${counts.ready})`}
          />
          <FilterTab
            clientId={client.id}
            value="sent"
            active={filter === "sent"}
            label={`Sent (${counts.sent})`}
          />
          <FilterTab
            clientId={client.id}
            value="skipped"
            active={filter === "skipped"}
            label={`Skipped (${counts.skipped})`}
          />
          <FilterTab
            clientId={client.id}
            value="all"
            active={filter === "all"}
            label={`All (${counts.all})`}
          />
        </nav>

        {filtered.length === 0 ? (
          <div className="card p-10 text-center text-ink-500">
            <Mail className="h-6 w-6 mx-auto text-ink-300" />
            <div className="mt-2 text-sm">
              {drafts.length === 0
                ? `No drafts yet. Drop a JSON array at ${source} to populate this view.`
                : `No drafts with status "${filter}".`}
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((d) => (
              <li key={d.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-ink-400">
                      {d.company ?? d.lead ?? "Prospect"}
                    </div>
                    <div className="text-sm font-semibold truncate">
                      {d.subject}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      To <span className="font-mono">{d.to}</span>
                      {d.from && (
                        <>
                          {" · from "}
                          <span className="font-mono">{d.from}</span>
                        </>
                      )}
                      {d.createdAt && (
                        <>
                          {" · drafted "}
                          {fmtDateTime(d.createdAt)}
                        </>
                      )}
                    </div>
                  </div>
                  <StatusPill status={d.status} />
                </div>
                <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-ink-700 font-sans">
                  {d.body}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function FilterTab({
  clientId,
  value,
  active,
  label,
}: {
  clientId: string;
  value: string;
  active: boolean;
  label: string;
}) {
  return (
    <a
      href={`/c/${clientId}/drafts?status=${value}`}
      className={`px-3 py-1.5 rounded-full border ${
        active
          ? "bg-brand-600 text-white border-brand-600"
          : "bg-white text-ink-700 border-ink-200 hover:border-brand-300"
      }`}
    >
      {label}
    </a>
  );
}

function StatusPill({ status }: { status: "ready" | "sent" | "skipped" }) {
  const styles =
    status === "ready"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "sent"
        ? "bg-ink-100 text-ink-600 border-ink-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span
      className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles}`}
    >
      {status}
    </span>
  );
}
