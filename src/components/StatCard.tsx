import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </div>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
        {trend && (
          <span
            className={`px-1.5 py-0.5 rounded font-medium ${
              trend.positive
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {trend.value}
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}
