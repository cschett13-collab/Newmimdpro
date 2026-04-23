import { AlertTriangle } from "lucide-react";

export function ApiErrorBanner({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="card p-5 border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-900">{title}</div>
          {detail && (
            <div className="text-sm text-amber-800 mt-1 whitespace-pre-wrap">
              {detail}
            </div>
          )}
          <div className="text-xs text-amber-800 mt-2">
            Check that the client&apos;s Private Integration Token is valid and
            has the required scopes (contacts, opportunities, conversations,
            calendars).
          </div>
        </div>
      </div>
    </div>
  );
}
