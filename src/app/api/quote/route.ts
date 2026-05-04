import { NextRequest, NextResponse } from "next/server";
import { getPolymarketQuote, getStockQuote } from "@/lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  if (type === "stock") {
    const symbol = searchParams.get("symbol");
    if (!symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 });
    }
    const q = await getStockQuote(symbol);
    if (!q) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(q, {
      headers: { "cache-control": "public, max-age=15" },
    });
  }
  if (type === "polymarket") {
    const slug = searchParams.get("slug");
    const outcome = searchParams.get("outcome") || "Yes";
    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }
    const q = await getPolymarketQuote(slug, outcome);
    if (!q) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(q, {
      headers: { "cache-control": "public, max-age=15" },
    });
  }
  return NextResponse.json(
    { error: "type must be 'stock' or 'polymarket'" },
    { status: 400 },
  );
}
