import { NextRequest, NextResponse } from "next/server";
import { getClients } from "@/lib/clients";
import { HighLevel, HighLevelError } from "@/lib/highlevel";
import { authorize } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily snapshot of pipeline state per client. Read-only — no scopes beyond the
 * portal's existing readonly set required. Output is JSON; pipe into a Slack
 * webhook, email, or just curl it from a dashboard.
 *
 *   GET /api/bots/owner-pulse?notify=1   also DMs the owner via SMS if
 *                                        BOT_OWNER_CONTACT_ID is set
 */
export async function GET(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  const notify = req.nextUrl.searchParams.get("notify") === "1";
  const ownerContactId = process.env.BOT_OWNER_CONTACT_ID;
  const summaries: Array<Record<string, unknown>> = [];

  for (const client of getClients()) {
    const hl = new HighLevel(client);
    try {
      const [open, won, unread] = await Promise.all([
        hl.searchOpportunities({ status: "open", limit: 100 }),
        hl.searchOpportunities({ status: "won", limit: 100 }),
        hl.searchConversations({ unreadOnly: true, limit: 100 }),
      ]);
      const openOpps = open.opportunities ?? [];
      const wonOpps = won.opportunities ?? [];
      const since = Date.now() - 7 * 24 * 60 * 60_000;
      const wonThisWeek = wonOpps.filter(
        (o) => Date.parse(o.updatedAt ?? "") > since,
      );
      summaries.push({
        clientId: client.id,
        name: client.name,
        openCount: openOpps.length,
        openValue: sum(openOpps.map((o) => o.monetaryValue ?? 0)),
        wonThisWeekCount: wonThisWeek.length,
        wonThisWeekValue: sum(wonThisWeek.map((o) => o.monetaryValue ?? 0)),
        unreadConversations: unread.conversations?.length ?? 0,
      });
    } catch (err) {
      const e = err as HighLevelError;
      summaries.push({
        clientId: client.id,
        name: client.name,
        error: e.message,
        status: e.status,
      });
    }
  }

  let notification: Record<string, unknown> | null = null;
  if (notify && ownerContactId) {
    const lines = summaries.map((s) =>
      s.error
        ? `${s.name}: ERROR ${s.error}`
        : `${s.name}: ${s.openCount} open ($${fmt(
            (s.openValue as number) ?? 0,
          )}), won 7d ${s.wonThisWeekCount} ($${fmt(
            (s.wonThisWeekValue as number) ?? 0,
          )}), ${s.unreadConversations} unread`,
    );
    const body = `FVCE pulse:\n${lines.join("\n")}`;
    const firstClient = getClients()[0];
    if (firstClient) {
      const hl = new HighLevel(firstClient);
      try {
        await hl.sendSms(ownerContactId, body);
        notification = { ok: true };
      } catch (err) {
        const e = err as HighLevelError;
        notification = { ok: false, error: e.message, status: e.status };
      }
    }
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summaries,
    notification,
  });
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
