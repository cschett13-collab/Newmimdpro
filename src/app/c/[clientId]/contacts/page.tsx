import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { HighLevel, HighLevelError } from "@/lib/highlevel";
import { PageHeader } from "@/components/PageHeader";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { fmtDate, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { q?: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  const hl = new HighLevel(client);

  let error: string | null = null;
  let contacts: Awaited<ReturnType<typeof hl.searchContacts>>["contacts"] = [];
  let total = 0;

  try {
    const res = await hl.searchContacts({
      limit: 100,
      query: searchParams.q,
    });
    contacts = res.contacts ?? [];
    total = res.total ?? contacts.length;
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
        title="Contacts"
        subtitle={`${fmtNumber(total)} total in HighLevel`}
        actions={
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Search by name, email, phone…"
              className="input w-72"
            />
            <button className="btn-primary">Search</button>
          </form>
        }
      />
      <div className="p-6 lg:p-8 space-y-4">
        {error && <ApiErrorBanner title="Couldn't load contacts" detail={error} />}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5">Added</th>
                <th className="text-left px-4 py-2.5">Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="border-t border-ink-100">
                    <td className="px-4 py-2.5 font-medium">
                      {c.contactName ??
                        `${c.firstNameLowerCase ?? ""} ${c.lastNameLowerCase ?? ""}`.trim() ??
                        "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {fmtDate(c.dateAdded)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[11px] rounded-full bg-ink-100 text-ink-700 px-2 py-0.5"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
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
