import { Cake } from "lucide-react";
import { contactDisplayName, type UpcomingBirthday } from "@/lib/birthdays";

export function BirthdaysCard({
  birthdays,
  windowDays,
  sampleLimited,
}: {
  birthdays: UpcomingBirthday[];
  windowDays: number;
  sampleLimited: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Cake className="h-4 w-4 text-ink-400" />
          Birthdays ({windowDays}d)
        </h2>
        <div className="text-xs text-ink-500">
          {birthdays.length} upcoming
        </div>
      </div>

      {birthdays.length === 0 ? (
        <div className="mt-6 text-sm text-ink-500">
          {sampleLimited
            ? "No birthdays in the sample. Consider narrowing by tag or increasing the fetch limit."
            : "No birthdays in the next week."}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {birthdays.map((b) => (
            <li
              key={b.contact.id}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {contactDisplayName(b.contact)}
                </div>
                <div className="text-xs text-ink-500">
                  {formatWhen(b.daysAway, b.next)}
                  {b.turning != null && b.turning > 0 && (
                    <> · turns {b.turning}</>
                  )}
                </div>
              </div>
              <div className="text-xs text-ink-600 whitespace-nowrap">
                {pad(b.month)}/{pad(b.day)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {sampleLimited && birthdays.length > 0 && (
        <div className="mt-3 text-[11px] text-ink-400">
          Based on the first page of contacts — some birthdays may be missed.
        </div>
      )}
    </div>
  );
}

function formatWhen(daysAway: number, next: Date): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days · ${next.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
