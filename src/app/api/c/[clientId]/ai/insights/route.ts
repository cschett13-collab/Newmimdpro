import { NextRequest } from "next/server";
import { getClient } from "@/lib/clients";
import { getSession } from "@/lib/session";
import { CLAUDE_MODEL, getClaude, isClaudeConfigured } from "@/lib/claude";
import { buildClientSnapshot, snapshotForPrompt } from "@/lib/aiContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM = `You are an analyst embedded in the Fox Valley Client Engine portal. The user is portal staff reviewing one HighLevel sub-account's live data. Each request gives you a JSON snapshot of that account.

Write a tight, plain-English briefing aimed at someone who manages this account. Structure it as three short markdown sections with these exact headers:

## What's working
## What needs attention
## Suggested next actions

Rules:
- 2–4 bullets per section, one sentence each.
- Reference specific numbers, deal names, contacts, or stages from the snapshot — never invent any.
- "Suggested next actions" must be concrete things the account manager can do today (follow up with X, move Y to the next stage, etc.).
- If a section has nothing material in the data, write a single bullet saying so rather than padding.
- No preamble, no closing summary, no emoji.`;

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const client = getClient(params.clientId);
  if (!client) return new Response("Client not found", { status: 404 });

  if (!isClaudeConfigured()) {
    return new Response(
      "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local.",
      { status: 503 },
    );
  }

  const snapshot = await buildClientSnapshot(client);
  const claude = getClaude();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = claude.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          system: [
            {
              type: "text",
              text: SYSTEM,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: `Snapshot for ${client.name} (generated ${snapshot.generatedAt}):\n\n${snapshotForPrompt(
                snapshot,
              )}`,
            },
          ],
        });

        messageStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await messageStream.finalMessage();
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n[error] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
