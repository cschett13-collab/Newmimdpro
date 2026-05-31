import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/clients";
import { getSession } from "@/lib/session";
import { CLAUDE_MODEL, getClaude, isClaudeConfigured } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  contactName: z.string().min(1).max(200),
  lastMessage: z.string().min(1).max(4000),
  channel: z.string().max(40).optional(),
});

const SYSTEM = `You draft short, professional reply options for staff at Fox Valley Client Engine who are responding to leads and customers in a HighLevel inbox.

Given the contact's name, the channel (sms/email/etc.), and the customer's last message, produce exactly 3 reply drafts that vary in tone:

1. Warm & helpful — friendly, conversational, moves the conversation forward
2. Concise & professional — short, business-like, clear next step
3. Question / clarifying — asks one focused follow-up to keep momentum

Constraints:
- Each draft is 1–3 sentences. SMS drafts under 320 characters.
- Don't invent appointment times, prices, account details, or names beyond the contact's.
- Use placeholders in square brackets ([your name], [date]) where specifics are unknown.
- Return ONLY valid JSON matching this shape, no prose, no markdown fences:
  {"suggestions": [{"label": "Warm", "text": "..."}, {"label": "Concise", "text": "..."}, {"label": "Clarify", "text": "..."}]}`;

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const client = getClient(params.clientId);
  if (!client) return new Response("Client not found", { status: 404 });

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid request body" },
      { status: 400 },
    );
  }

  const claude = getClaude();
  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Business: ${client.name}\nContact: ${body.contactName}\nChannel: ${body.channel ?? "unknown"}\n\nCustomer's last message:\n"""${body.lastMessage}"""`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Best-effort: try to extract a JSON object from the response.
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { suggestions: [] };
    }

    const Out = z.object({
      suggestions: z
        .array(z.object({ label: z.string(), text: z.string() }))
        .max(5),
    });
    const validated = Out.parse(parsed);
    return NextResponse.json(validated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
