import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
  destroySession();
  return NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
    { status: 303 },
  );
}
