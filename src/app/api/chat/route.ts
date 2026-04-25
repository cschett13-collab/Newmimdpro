import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { chooseModel, type RequestedMode, type UserApiKeys } from "@/lib/modelRouter";
import { routeAI, type Message } from "@/lib/aiRouter";

const SYSTEM_PROMPT = `You are Zenvy AI, a premium execution assistant.

Help users move faster, think clearer, and turn ideas into real-world results.
Be direct, useful, confident, and outcome-focused.
Prioritize money, speed, leverage, automation, and clarity.
Give finished outputs the user can use immediately.`;

type Body = {
  messages?: Message[];
  userProfile?: Record<string, unknown>;
  requestedMode?: RequestedMode;
  userApiKeys?: UserApiKeys;
};

const ALLOWED_ROLES: Message["role"][] = ["system", "user", "assistant"];

function sanitizeMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) return [];
  const out: Message[] = [];
  for (const m of input) {
    if (
      m &&
      typeof m === "object" &&
      typeof (m as { role?: unknown }).role === "string" &&
      typeof (m as { content?: unknown }).content === "string" &&
      ALLOWED_ROLES.includes((m as Message).role)
    ) {
      out.push({ role: (m as Message).role, content: (m as Message).content });
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const choice = chooseModel({
    email: session.email,
    requestedMode: body.requestedMode,
    userApiKeys: body.userApiKeys,
  });

  const finalMessages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(body.userProfile && Object.keys(body.userProfile).length
      ? [{ role: "system" as const, content: `User profile: ${JSON.stringify(body.userProfile)}` }]
      : []),
    ...messages,
  ];

  try {
    const reply = await routeAI({
      messages: finalMessages,
      provider: choice.provider,
      model: choice.model,
      apiKey: choice.apiKey,
    });
    return NextResponse.json({
      message: reply,
      provider: choice.provider,
      model: choice.model,
    });
  } catch (err) {
    console.error("chat route failed", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 500 });
  }
}
