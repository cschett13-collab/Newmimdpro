import { NextRequest, NextResponse } from "next/server";

/**
 * Cron secret check. Returns null if authorized, or a 401/500 response if not.
 *
 * Vercel Cron auto-injects `Authorization: Bearer $CRON_SECRET` when the env
 * var exists. Same header pattern works for any external cron (GitHub Actions,
 * cron-job.org, etc.) — they just need to send the secret.
 */
export function authorize(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
