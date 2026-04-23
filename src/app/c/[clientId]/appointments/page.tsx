import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { HighLevel, HighLevelError } from "@/lib/highlevel";
import { PageHeader } from "@/components/PageHeader";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { fmtDateTime, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  params,
}: {
  params: { clientId: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  const hl = new HighLevel(client);

  const now = Date.now();
  const horizon = now + 60 * 24 * 60 * 60 * 1000;

  let error: string | null = null;
  let events: Array<{
    id: string;
    title?: string;
    startTime: string;
    endTime: string;
    appointmentStatus?: string;
    calendarName?: string;
  }> = [];

  try {
    const { calendars } = await hl.calendars();
    const active = (calendars ?? []).filter((c) => c.isActive !== false);
    const results = await Promise.all(
      active.map(async (cal) => {
        try {
          const { events: e } = await hl.calendarEvents({
            calendarId: cal.id,
            startTime: now,
            endTime: horizon,
          });
          return (e ?? []).map((ev) => ({
            ...ev,
            calendarName: cal.name,
          }));
        } catch {
          return [];
        }
      }),
    );
    events = results
      .flat()
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  } catch (e) {
    error =
      e instanceof HighLevelError
        ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`
        : e instanceof Error
          ? e.message
          : "Unknown error";
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${fmtNumber(events.length)} scheduled in the next 60 days`}
      />
      <div className="p-6 lg:p-8 space-y-4">
        {error && (
          <ApiErrorBanner title="Couldn't load appointments" detail={error} />
        )}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Title</th>
                <th className="text-left px-4 py-2.5">Calendar</th>
                <th className="text-left px-4 py-2.5">Start</th>
                <th className="text-left px-4 py-2.5">End</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                    Nothing scheduled.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-ink-100">
                    <td className="px-4 py-2.5 font-medium">
                      {e.title ?? "Appointment"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {e.calendarName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {fmtDateTime(e.startTime)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {fmtDateTime(e.endTime)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600 uppercase text-xs tracking-wide">
                      {e.appointmentStatus ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
