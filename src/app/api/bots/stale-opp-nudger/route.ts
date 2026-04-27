import { NextRequest, NextResponse } from "next/server";
import { getClients, type Client } from "@/lib/clients";
import { HighLevel, HighLevelError, type Opportunity } from "@/lib/highlevel";
import { authorize } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NUDGED_TAG = "fvce-bot-nudged-7d";

const DEFAULT_TEMPLATE =
  "Hi {{firstName}}, just checking in on {{opportunityName}}. " +
  "Are you still looking to move forward this month? Happy to answer any questions.";

type ReportEntry = {
  clientId: string;
  opportunityId?: string;
  contactId?: string;
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
  const staleDays = Number(process.env.BOT_STALE_OPP_DAYS ?? "7");
  const template =
    process.env.BOT_STALE_OPP_TEMPLATE?.trim() || DEFAULT_TEMPLATE;
  const cutoffMs = Date.now() - staleDays * 24 * 60 * 60_000;

  const report: ReportEntry[] = [];

  for (const client of getClients()) {
    await runForClient({ client, cutoffMs, template, dryRun, report });
  }

  return NextResponse.json({
    ok: true,
    staleDays,
    cutoff: new Date(cutoffMs).toISOString(),
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

  let opps: Opportunity[];
  try {
    const res = await hl.searchOpportunities({ status: "open", limit: 100 });
    opps = res.opportunities ?? [];
  } catch (err) {
    const e = err as HighLevelError;
    report.push({ clientId: client.id, error: e.message, status: e.status });
    return;
  }

  for (const opp of opps) {
    const updatedAt = opp.updatedAt ? Date.parse(opp.updatedAt) : NaN;
    if (!Number.isFinite(updatedAt) || updatedAt > cutoffMs) continue;
    if (!opp.contactId) {
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        skipped: "no_contact",
      });
      continue;
    }

    let contact;
    try {
      const res = await hl.getContact(opp.contactId);
      contact = res.contact;
    } catch (err) {
      const e = err as HighLevelError;
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        contactId: opp.contactId,
        error: `getContact: ${e.message}`,
        status: e.status,
      });
      continue;
    }

    if ((contact.tags ?? []).includes(NUDGED_TAG)) {
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        contactId: contact.id,
        skipped: "already_nudged",
      });
      continue;
    }
    if (!contact.phone) {
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        contactId: contact.id,
        skipped: "no_phone",
      });
      continue;
    }

    const firstName =
      contact.firstNameLowerCase
        ? contact.firstNameLowerCase.charAt(0).toUpperCase() +
          contact.firstNameLowerCase.slice(1)
        : (contact.contactName?.split(" ")[0] ?? "there");
    const msg = template
      .replaceAll("{{firstName}}", firstName)
      .replaceAll("{{opportunityName}}", opp.name);

    if (dryRun) {
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        contactId: contact.id,
        dryRun: true,
        msg,
      });
      continue;
    }

    try {
      await hl.sendSms(contact.id, msg);
      try {
        await hl.addContactTags(contact.id, [NUDGED_TAG]);
      } catch (tagErr) {
        const e = tagErr as HighLevelError;
        report.push({
          clientId: client.id,
          opportunityId: opp.id,
          contactId: contact.id,
          sent: true,
          error: `tag-failed: ${e.message}`,
          status: e.status,
        });
        continue;
      }
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        contactId: contact.id,
        sent: true,
        msg,
      });
    } catch (err) {
      const e = err as HighLevelError;
      report.push({
        clientId: client.id,
        opportunityId: opp.id,
        contactId: contact.id,
        error: e.message,
        status: e.status,
      });
    }
  }
}
