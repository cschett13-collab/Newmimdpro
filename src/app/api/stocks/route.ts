import { NextRequest, NextResponse } from "next/server";
import { analyzeTickers, parseTickers } from "@/lib/stocks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tickers = parseTickers(req.nextUrl.searchParams.get("symbols"));
  if (tickers.length === 0) {
    return NextResponse.json({ results: [] });
  }
  if (tickers.length > 25) {
    return NextResponse.json(
      { error: "Too many symbols (max 25)" },
      { status: 400 },
    );
  }
  const results = await analyzeTickers(tickers);
  return NextResponse.json({ results });
}
