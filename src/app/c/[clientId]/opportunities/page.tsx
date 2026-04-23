import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { HighLevel, HighLevelError } from "@/lib/highlevel";
import { PageHeader } from "@/components/PageHeader";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { fmtMoney, fmtNumber, relative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { status?: "open" | "won" | "lost" | "abandoned" };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  const hl = new HighLevel(client);
  const status = searchParams.status ?? "open";

  let error: string | null = null;
  let opps: Awaited<
    ReturnType<typeof hl.searchOpportunities>
  >["opportunities"] = [];
  let pipelinesByStage = new Map<
    string,
    { pipeline: string; stage: string }
  >();

  try {
    const [oppsRes, pipelinesRes] = await Promise.all([
      hl.searchOpportunities({ status, limit: 200 }),
      hl.pipelines(),
    ]);
    opps = oppsRes.opportunities ?? [];
    for (const p of pipelinesRes.pipelines ?? []) {
      for (const s of p.stages ?? []) {
        pipelinesByStage.set(s.id, { pipeline: p.name, stage: s.name });
      }
    }
  } catch (e) {
    error =
      e instanceof HighLevelError
        ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`
        : e instanceof Error
          ? e.message
          : "Unknown error";
  }

  const total = opps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={`${fmtNumber(opps.length)} ${status} · ${fmtMoney(total)}`}
        actions={
          <div className="flex items-center gap-2">
            {(["open", "won", "lost", "abandoned"] as const).map((s) => (
              <a
                key={s}
                href={`?status=${s}`}
                className={`btn ${
                  s === status
                    ? "bg-brand-600 text-white"
                    : "text-ink-700 hover:bg-ink-100"
                }`}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </a>
            ))}
          </div>
        }
      />
      <div className="p-6 lg:p-8 space-y-4">
        {error && (
          <ApiErrorBanner title="Couldn't load opportunities" detail={error} />
        )}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Pipeline</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="text-right px-4 py-2.5">Value</th>
                <th className="text-left px-4 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                    No opportunities.
                  </td>
                </tr>
              ) : (
                opps.map((o) => {
                  const ps = pipelinesByStage.get(o.pipelineStageId);
                  return (
                    <tr key={o.id} className="border-t border-ink-100">
                      <td className="px-4 py-2.5 font-medium">{o.name}</td>
                      <td className="px-4 py-2.5 text-ink-600">
                        {ps?.pipeline ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-ink-600">
                        {ps?.stage ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {fmtMoney(o.monetaryValue ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-ink-500">
                        {relative(o.updatedAt ?? o.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
