import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { relative } from "@/lib/format";
import { sentinelSeverity, type SentinelStatus } from "@/lib/ops";

const TONE = {
  ok: {
    wrap: "border-green-200 bg-green-50",
    icon: "text-green-600",
    label: "text-green-800",
    Icon: ShieldCheck,
    headline: "Sentinel healthy",
  },
  warn: {
    wrap: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    label: "text-amber-800",
    Icon: ShieldAlert,
    headline: "Sentinel stale",
  },
  error: {
    wrap: "border-red-200 bg-red-50",
    icon: "text-red-600",
    label: "text-red-800",
    Icon: ShieldAlert,
    headline: "Sentinel needs attention",
  },
  unknown: {
    wrap: "border-ink-200 bg-white",
    icon: "text-ink-400",
    label: "text-ink-700",
    Icon: ShieldQuestion,
    headline: "Sentinel status unknown",
  },
} as const;

export function SentinelStatusCard({
  status,
  error,
}: {
  status: SentinelStatus | null;
  error: string | null;
}) {
  const severity = sentinelSeverity(status);
  const tone = TONE[severity];
  const Icon = tone.Icon;

  const lastScan = status?.lastScanAt
    ? `Last scan ${relative(status.lastScanAt)}`
    : "No scans recorded yet";

  const detail =
    error ??
    status?.message ??
    (severity === "ok"
      ? "Malware scan within the last 24h."
      : severity === "warn"
        ? "Scan is older than a day — kick off a fresh one."
        : severity === "error"
          ? "No recent scan. Fix Windows Defender / restart Sentinel."
          : "Drop a sentinel-status.json into data/ to enable this widget.");

  return (
    <div className={`card p-5 border ${tone.wrap}`}>
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-lg bg-white border border-ink-100 flex items-center justify-center ${tone.icon}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${tone.label}`}>
            {tone.headline}
          </div>
          <div className="text-xs text-ink-600 mt-0.5">{lastScan}</div>
          <div className="text-xs text-ink-500 mt-2">{detail}</div>
        </div>
      </div>
    </div>
  );
}
