import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await createSession(email);
  return NextResponse.json({ ok: true });
}
