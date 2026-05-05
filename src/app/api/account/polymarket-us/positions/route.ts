import { NextResponse } from "next/server";
import { getBalance, getOpenOrders, getPositions, isConfigured } from "@/lib/polymarket-us";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "Set POLYMARKET_US_KEY_ID and POLYMARKET_US_SECRET_KEY in .env.local. Use a read-only key first.",
      },
      { status: 200 },
    );
  }

  const [positions, balance, orders] = await Promise.all([
    getPositions(),
    getBalance(),
    getOpenOrders(),
  ]);

  return NextResponse.json({
    configured: true,
    positions,
    balance,
    orders,
  });
}
