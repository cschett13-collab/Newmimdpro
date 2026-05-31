import { HighLevel, HighLevelError } from "./highlevel";
import type {
  Calendar as CalendarType,
  Conversation,
  Opportunity,
  Pipeline,
} from "./highlevel";
import type { Client } from "./clients";

export type ClientSnapshot = {
  client: { id: string; name: string };
  generatedAt: string;
  totals: {
    contacts: number;
    openOpps: number;
    wonOpps30d: number;
    pipelineValue: number;
    wonValue30d: number;
    unreadConversations: number;
  };
  pipelines: Array<{
    name: string;
    stages: Array<{ name: string; count: number; value: number }>;
  }>;
  recentConversations: Array<{
    contact: string;
    lastMessage: string;
    lastMessageType?: string;
    lastMessageDate?: string;
    unread: number;
  }>;
  openOpportunities: Array<{
    name: string;
    value: number;
    stage?: string;
    updatedAt?: string;
  }>;
  upcomingAppointments: Array<{
    title: string;
    startTime: string;
    status?: string;
  }>;
  errors: string[];
};

async function safe<T>(p: Promise<T>): Promise<T | { __error: string }> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof HighLevelError) {
      return { __error: `${e.message} (HTTP ${e.status})` };
    }
    return {
      __error: e instanceof Error ? e.message : "Unknown HighLevel error",
    };
  }
}

function isErr(v: unknown): v is { __error: string } {
  return typeof v === "object" && v !== null && "__error" in v;
}

/**
 * Pulls the same data the dashboard reads and condenses it into a compact
 * JSON snapshot the model can reason over. Designed to fit comfortably in a
 * single Claude request and to be deterministic enough for prompt caching.
 */
export async function buildClientSnapshot(
  client: Client,
): Promise<ClientSnapshot> {
  const hl = new HighLevel(client);
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const past30Days = now - 30 * 24 * 60 * 60 * 1000;
  const errors: string[] = [];

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
    safe(hl.searchConversations({ limit: 30 })),
    safe(hl.calendars()),
  ]);

  const totalContacts = isErr(contactsRes)
    ? (errors.push(`contacts: ${contactsRes.__error}`), 0)
    : contactsRes.total ?? 0;

  const pipelines: Pipeline[] = isErr(pipelinesRes)
    ? (errors.push(`pipelines: ${pipelinesRes.__error}`), [])
    : pipelinesRes.pipelines ?? [];

  const openOpps: Opportunity[] = isErr(openOppsRes)
    ? (errors.push(`open opps: ${openOppsRes.__error}`), [])
    : openOppsRes.opportunities ?? [];

  const wonOpps: Opportunity[] = isErr(wonOppsRes)
    ? (errors.push(`won opps: ${wonOppsRes.__error}`), [])
    : wonOppsRes.opportunities ?? [];

  const conversations: Conversation[] = isErr(conversationsRes)
    ? (errors.push(`conversations: ${conversationsRes.__error}`), [])
    : conversationsRes.conversations ?? [];

  const calendars: CalendarType[] = isErr(calendarsRes)
    ? (errors.push(`calendars: ${calendarsRes.__error}`), [])
    : calendarsRes.calendars ?? [];

  const activeCalendars = calendars.filter((c) => c.isActive !== false);
  const apptResults = await Promise.all(
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
  const upcomingAppointments = apptResults
    .flatMap((r) => (isErr(r) ? [] : r.events ?? []))
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )
    .slice(0, 10)
    .map((e) => ({
      title: e.title ?? "Appointment",
      startTime: e.startTime,
      status: e.appointmentStatus,
    }));

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
  const stageById2 = new Map<string, { name: string; count: number; value: number }>();
  for (const v of stageById.values()) {
    if (v.count > 0)
      stageById2.set(v.name + "::" + v.pipelineName, {
        name: v.name,
        count: v.count,
        value: v.value,
      });
  }
  const pipelinesOut = pipelines
    .map((p) => ({
      name: p.name,
      stages: (p.stages ?? [])
        .map((s) => {
          const e = [...stageById.values()].find(
            (x) => x.name === s.name && x.pipelineName === p.name,
          );
          return {
            name: s.name,
            count: e?.count ?? 0,
            value: e?.value ?? 0,
          };
        })
        .filter((s) => s.count > 0),
    }))
    .filter((p) => p.stages.length > 0);

  const pipelineValue = openOpps.reduce(
    (s, o) => s + (o.monetaryValue ?? 0),
    0,
  );
  const wonValue30d = wonOpps
    .filter((o) => {
      const t = new Date(o.updatedAt ?? o.createdAt ?? 0).getTime();
      return t >= past30Days;
    })
    .reduce((s, o) => s + (o.monetaryValue ?? 0), 0);
  const wonOpps30dCount = wonOpps.filter((o) => {
    const t = new Date(o.updatedAt ?? o.createdAt ?? 0).getTime();
    return t >= past30Days;
  }).length;
  const unreadConversations = conversations.reduce(
    (n, c) => n + (c.unreadCount ?? 0),
    0,
  );

  const stageNameById = new Map<string, string>();
  for (const p of pipelines) {
    for (const s of p.stages ?? []) stageNameById.set(s.id, s.name);
  }

  return {
    client: { id: client.id, name: client.name },
    generatedAt: new Date().toISOString(),
    totals: {
      contacts: totalContacts,
      openOpps: openOpps.length,
      wonOpps30d: wonOpps30dCount,
      pipelineValue,
      wonValue30d,
      unreadConversations,
    },
    pipelines: pipelinesOut,
    recentConversations: conversations.slice(0, 15).map((c) => ({
      contact:
        c.fullName ?? c.email ?? c.phone ?? "Unknown contact",
      lastMessage: c.lastMessageBody ?? "",
      lastMessageType: c.lastMessageType,
      lastMessageDate: c.lastMessageDate,
      unread: c.unreadCount ?? 0,
    })),
    openOpportunities: openOpps
      .slice()
      .sort((a, b) => (b.monetaryValue ?? 0) - (a.monetaryValue ?? 0))
      .slice(0, 15)
      .map((o) => ({
        name: o.name,
        value: o.monetaryValue ?? 0,
        stage: stageNameById.get(o.pipelineStageId),
        updatedAt: o.updatedAt ?? o.createdAt,
      })),
    upcomingAppointments,
    errors,
  };
}

export function snapshotForPrompt(s: ClientSnapshot): string {
  return JSON.stringify(s, null, 2);
}
