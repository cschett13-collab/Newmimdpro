import { DayTraderClient } from "./DayTraderClient";

export const dynamic = "force-dynamic";

export default function DayPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Day-trader cockpit</h1>
        <p className="text-sm text-ink-500 mt-1">
          5-minute bars, VWAP, opening-range breakouts, relative volume — and a
          position sizer that respects your account size and risk per trade.
        </p>
      </div>
      <DayTraderClient />
    </>
  );
}
