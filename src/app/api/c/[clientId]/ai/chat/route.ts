import { NextRequest } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/clients";
import { getSession } from "@/lib/session";
import { CLAUDE_MODEL, getClaude, isClaudeConfigured } from "@/lib/claude";
import { buildClientSnapshot, snapshotForPrompt } from "@/lib/aiContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

const SYSTEM = `You are an assistant embedded in the Fox Valley Client Engine portal. The user is portal staff asking questions about one HighLevel sub-account.

Every conversation begins with a JSON snapshot of the account's contacts, pipeline, opportunities, conversations, and appointments. Answer using only the data in that snapshot — never invent contacts, deals, numbers, or events.

If the snapshot doesn't contain what's needed to answer, say so plainly and suggest where in the portal the user can find it (Contacts / Pipeline / Conversations / Appointments / Dashboard).

Keep answers short and concrete. Use markdown lists or short paragraphs. No hedging, no preamble.`;

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

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return new Response(
      e instanceof Error ? e.message : "Invalid request body",
      { status: 400 },
    );
  }

  const snapshot = await buildClientSnapshot(client);
  const claude = getClaude();

  // The snapshot prefix is stable for the whole conversation, so cache it.
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Snapshot for ${client.name} (generated ${snapshot.generatedAt}):\n\n${snapshotForPrompt(
            snapshot,
          )}`,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    {
      role: "assistant",
      content:
        "Got it. I have the current snapshot for " +
        client.name +
        ". Ask me anything about this account.",
    },
    ...body.messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = claude.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          system: SYSTEM,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: messages as any,
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
