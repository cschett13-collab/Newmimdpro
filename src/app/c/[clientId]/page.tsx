import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { HighLevel, HighLevelError } from "@/lib/highlevel";
import type {
  Calendar as CalendarType,
  Conversation,
  Opportunity,
  Pipeline,
} from "@/lib/highlevel";
import { fmtDateTime, fmtMoney, fmtNumber, relative } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import {
  Users,
  Briefcase,
  MessagesSquare,
  CalendarDays,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function safe<T>(p: Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, data: await p };
  } catch (err) {
    if (err instanceof HighLevelError) {
      return { ok: false, error: err.message, status: err.status };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function DashboardPage({
  params,
}: {
  params: { clientId: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  const hl = new HighLevel(client);

  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const past30Days = now - 30 * 24 * 60 * 60 * 1000;

  const [
    contactsRes,
    pipelinesRes,
    openOppsRes,
    wonOppsRes,
    conversationsRes,
    calendarsRes,
  ] = await Promise.all([
    safe(hl.searchContacts({ limit: 1 })),
    safe(hl.pipelines()),
    safe(hl.searchOpportunities({ status: "open", limit: 100 })),
    safe(hl.searchOpportunities({ status: "won", limit: 100 })),
    safe(hl.searchConversations({ limit: 20 })),
    safe(hl.calendars()),
  ]);

  // Upcoming appointments across calendars (next 30 days).
  const calendars: CalendarType[] = calendarsRes.ok
    ? calendarsRes.data.calendars ?? []
    : [];
  const activeCalendars = calendars.filter((c) => c.isActive !== false);
  const appointmentCalls = await Promise.all(
    activeCalendars.slice(0, 6).map((c) =>
      safe(
        hl.calendarEvents({
          calendarId: c.id,
          startTime: now,
          endTime: in30Days,
        }),
      ),
    ),
  );
  const upcomingAppointments = appointmentCalls
    .flatMap((r) => (r.ok ? r.data.events ?? [] : []))
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  const openOpps: Opportunity[] = openOppsRes.ok
    ? openOppsRes.data.opportunities ?? []
    : [];
  const wonOpps: Opportunity[] = wonOppsRes.ok
    ? wonOppsRes.data.opportunities ?? []
    : [];

  const pipelineValue = openOpps.reduce(
    (sum, o) => sum + (o.monetaryValue ?? 0),
    0,
  );
  const wonValue30d = wonOpps
    .filter((o) => {
      const t = new Date(o.updatedAt ?? o.createdAt ?? 0).getTime();
      return t >= past30Days;
    })
    .reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0);

  const conversations: Conversation[] = conversationsRes.ok
    ? conversationsRes.data.conversations ?? []
    : [];
  const unreadCount = conversations.reduce(
    (n, c) => n + (c.unreadCount ?? 0),
    0,
  );

  const totalContacts = contactsRes.ok ? contactsRes.data.total ?? 0 : 0;

  const anyError =
    !contactsRes.ok ||
    !pipelinesRes.ok ||
    !openOppsRes.ok ||
    !wonOppsRes.ok ||
    !conversationsRes.ok ||
    !calendarsRes.ok;

  const firstError = [
    contactsRes,
    pipelinesRes,
    openOppsRes,
    wonOppsRes,
    conversationsRes,
    calendarsRes,
  ].find((r) => !r.ok) as Extract<SafeResult<unknown>, { ok: false }> | undefined;

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle="Live HighLevel reporting · updated just now"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {anyError && firstError && (
          <ApiErrorBanner
            title="Some HighLevel data couldn't be loaded"
            detail={`${firstError.error}${
              firstError.status ? ` (HTTP ${firstError.status})` : ""
            }`}
          />
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Contacts"
            value={fmtNumber(totalContacts)}
            icon={Users}
            hint="All time"
          />
          <StatCard
            label="Open Pipeline"
            value={fmtMoney(pipelineValue)}
            icon={DollarSign}
            hint={`${fmtNumber(openOpps.length)} opportunities`}
          />
          <StatCard
            label="Won (30d)"
            value={fmtMoney(wonValue30d)}
            icon={TrendingUp}
            hint="Revenue closed in the last 30 days"
          />
          <StatCard
            label="Unread Conversations"
            value={fmtNumber(unreadCount)}
            icon={MessagesSquare}
            hint={`${conversations.length} recent threads`}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <PipelineBreakdown
            pipelines={pipelinesRes.ok ? pipelinesRes.data.pipelines : []}
            openOpps={openOpps}
          />
          <UpcomingAppointments events={upcomingAppointments.slice(0, 8)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <RecentConversations conversations={conversations.slice(0, 6)} />
          <RecentOpportunities opps={openOpps.slice(0, 6)} />
        </section>
      </div>
    </>
  );
}

function PipelineBreakdown({
  pipelines,
  openOpps,
}: {
  pipelines: Pipeline[];
  openOpps: Opportunity[];
}) {
  const stageById = new Map<
    string,
    { name: string; pipelineName: string; count: number; value: number }
  >();
  for (const p of pipelines) {
    for (const s of p.stages ?? []) {
      stageById.set(s.id, {
        name: s.name,
        pipelineName: p.name,
        count: 0,
        value: 0,
      });
    }
  }
  for (const o of openOpps) {
    const s = stageById.get(o.pipelineStageId);
    if (!s) continue;
    s.count += 1;
    s.value += o.monetaryValue ?? 0;
  }
  const stages = [...stageById.values()].filter((s) => s.count > 0);
  const maxValue = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-ink-400" />
          Pipeline by stage
        </h2>
        <div className="text-xs text-ink-500">Open opportunities</div>
      </div>
      {stages.length === 0 ? (
        <div className="mt-6 text-sm text-ink-500">
          No open opportunities found.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {stages.map((s, i) => (
            <li key={i}>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-ink-400 ml-2 text-xs">
                    {s.pipelineName}
                  </span>
                </div>
                <div className="text-ink-600">
                  {fmtNumber(s.count)} · {fmtMoney(s.value)}
                </div>
              </div>
              <div className="mt-1 h-2 rounded bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${(s.value / maxValue) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UpcomingAppointments({
  events,
}: {
  events: Array<{
    id: string;
    title?: string;
    startTime: string;
    appointmentStatus?: string;
  }>;
}) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-ink-400" />
        Upcoming appointments
      </h2>
      {events.length === 0 ? (
        <div className="mt-6 text-sm text-ink-500">
          Nothing scheduled in the next 30 days.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {events.map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="text-sm font-medium truncate">
                {e.title ?? "Appointment"}
              </div>
              <div className="text-xs text-ink-500">
                {fmtDateTime(e.startTime)}
                {e.appointmentStatus && (
                  <>
                    {" · "}
                    <span className="uppercase tracking-wide">
                      {e.appointmentStatus}
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentConversations({
  conversations,
}: {
  conversations: Conversation[];
}) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <MessagesSquare className="h-4 w-4 text-ink-400" />
        Recent conversations
      </h2>
      {conversations.length === 0 ? (
        <div className="mt-6 text-sm text-ink-500">
          No recent messages.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {conversations.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.fullName || c.email || c.phone || "Unknown contact"}
                  </div>
                  <div className="text-xs text-ink-500 truncate">
                    {c.lastMessageBody ?? "—"}
                  </div>
                </div>
                <div className="text-[11px] text-ink-400 whitespace-nowrap">
                  {relative(c.lastMessageDate)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentOpportunities({ opps }: { opps: Opportunity[] }) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-ink-400" />
        Active opportunities
      </h2>
      {opps.length === 0 ? (
        <div className="mt-6 text-sm text-ink-500">No active deals.</div>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {opps.map((o) => (
            <li key={o.id} className="py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{o.name}</div>
                <div className="text-xs text-ink-500">
                  Updated {relative(o.updatedAt ?? o.createdAt)}
                </div>
              </div>
              <div className="text-sm font-semibold">
                {fmtMoney(o.monetaryValue ?? 0)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
