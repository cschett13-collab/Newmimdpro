import { NextRequest, NextResponse } from "next/server";
import { getClients, type Client } from "@/lib/clients";
import { HighLevel, HighLevelError, type ContactSummary } from "@/lib/highlevel";
import { authorize } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tag applied to contacts after the bot has responded so the same person
// doesn't get re-texted on subsequent runs.
const RESPONDED_TAG = "fvce-bot-responded";

// Default copy. Override per-deploy via BOT_LEAD_RESPONDER_TEMPLATE.
const DEFAULT_TEMPLATE =
  "Hi {{firstName}}, this is Fox Valley Client Engine — thanks for reaching out! " +
  "I just got your info and someone will follow up shortly. Reply STOP to opt out.";

type ReportEntry = {
  clientId: string;
  contactId?: string;
  phone?: string;
  sent?: boolean;
  dryRun?: boolean;
  skipped?: string;
  error?: string;
  status?: number;
  msg?: string;
};

export async function GET(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const lookbackMin = Number(
    process.env.BOT_LEAD_RESPONDER_LOOKBACK_MIN ?? "10",
  );
  const template =
    process.env.BOT_LEAD_RESPONDER_TEMPLATE?.trim() || DEFAULT_TEMPLATE;
  const cutoffMs = Date.now() - lookbackMin * 60_000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const report: ReportEntry[] = [];

  for (const client of getClients()) {
    await runForClient({ client, cutoffMs, template, dryRun, report });
  }

  return NextResponse.json({
    ok: true,
    cutoff: cutoffIso,
    lookbackMin,
    dryRun,
    sent: report.filter((r) => r.sent).length,
    skipped: report.filter((r) => r.skipped).length,
    errors: report.filter((r) => r.error).length,
    report,
  });
}

async function runForClient(args: {
  client: Client;
  cutoffMs: number;
  template: string;
  dryRun: boolean;
  report: ReportEntry[];
}) {
  const { client, cutoffMs, template, dryRun, report } = args;
  const hl = new HighLevel(client);

  let contacts: ContactSummary[];
  try {
    const res = await hl.recentContacts(50);
    contacts = res.contacts ?? [];
  } catch (err) {
    const e = err as HighLevelError;
    report.push({
      clientId: client.id,
      error: e.message ?? String(err),
      status: e.status,
    });
    return;
  }

  for (const c of contacts) {
    const dateAdded = c.dateAdded ? Date.parse(c.dateAdded) : NaN;
    if (!Number.isFinite(dateAdded) || dateAdded < cutoffMs) continue;
    if ((c.tags ?? []).includes(RESPONDED_TAG)) {
      report.push({
        clientId: client.id,
        contactId: c.id,
        skipped: "already_responded",
      });
      continue;
    }
    if (!c.phone) {
      report.push({
        clientId: client.id,
        contactId: c.id,
        skipped: "no_phone",
      });
      continue;
    }

    const firstName =
      c.firstNameLowerCase
        ? c.firstNameLowerCase.charAt(0).toUpperCase() +
          c.firstNameLowerCase.slice(1)
        : (c.contactName?.split(" ")[0] ?? "there");
    const msg = template.replaceAll("{{firstName}}", firstName);

    if (dryRun) {
      report.push({
        clientId: client.id,
        contactId: c.id,
        phone: c.phone,
        dryRun: true,
        msg,
      });
      continue;
    }

    try {
      await hl.sendSms(c.id, msg);
      // Tag immediately so a retry can't double-text. Failures here log but
      // don't unwind the send (the SMS already left).
      try {
        await hl.addContactTags(c.id, [RESPONDED_TAG]);
      } catch (tagErr) {
        const e = tagErr as HighLevelError;
        report.push({
          clientId: client.id,
          contactId: c.id,
          sent: true,
          error: `tagged-failed: ${e.message ?? String(tagErr)}`,
          status: e.status,
        });
        continue;
      }
      report.push({
        clientId: client.id,
        contactId: c.id,
        phone: c.phone,
        sent: true,
        msg,
      });
    } catch (err) {
      const e = err as HighLevelError;
      report.push({
        clientId: client.id,
        contactId: c.id,
        error: e.message ?? String(err),
        status: e.status,
      });
    }
  }
}
