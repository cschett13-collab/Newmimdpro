import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  name: z.string().min(1).max(120),
  business: z.string().min(1).max(160),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  website_url: z.string().max(200).optional().default(""), // honeypot
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid fields" },
      { status: 400 },
    );
  }

  // Bot honeypot — silently accept
  if (parsed.data.website_url) {
    return NextResponse.json({ ok: true });
  }

  const lead = {
    name: parsed.data.name.trim(),
    business: parsed.data.business.trim(),
    email: parsed.data.email.trim(),
    phone: parsed.data.phone.trim(),
    notes: parsed.data.notes.trim(),
    receivedAt: new Date().toISOString(),
    source: req.headers.get("referer") ?? "/start",
  };

  // Always log so it shows up in Vercel logs / terminal
  console.log("[lead]", JSON.stringify(lead));

  // Forward to webhook (Zapier, Make, Discord, Slack, etc.) if configured
  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Generic JSON payload — works for Zapier/Make.
          ...lead,
          // Discord-friendly fallback so a Discord webhook still renders nicely
          content: `**New lead** — ${lead.business}\n${lead.name} · ${lead.email}${lead.phone ? ` · ${lead.phone}` : ""}\n${lead.notes || "(no notes)"}`,
        }),
      });
    } catch (err) {
      console.error("[lead] webhook failed", err);
      // Don't fail the user-facing request just because the webhook flaked.
    }
  }

  return NextResponse.json({ ok: true });
}
