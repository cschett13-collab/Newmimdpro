import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { HighLevel, HighLevelError } from "@/lib/highlevel";
import { PageHeader } from "@/components/PageHeader";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { fmtNumber, relative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { unread?: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  const hl = new HighLevel(client);
  const unreadOnly = searchParams.unread === "1";

  let error: string | null = null;
  let conversations: Awaited<
    ReturnType<typeof hl.searchConversations>
  >["conversations"] = [];

  try {
    const res = await hl.searchConversations({ limit: 100, unreadOnly });
    conversations = res.conversations ?? [];
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
        title="Conversations"
        subtitle={`${fmtNumber(conversations.length)} threads loaded`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="?"
              className={`btn ${
                !unreadOnly
                  ? "bg-brand-600 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              All
            </a>
            <a
              href="?unread=1"
              className={`btn ${
                unreadOnly
                  ? "bg-brand-600 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              Unread
            </a>
          </div>
        }
      />
      <div className="p-6 lg:p-8 space-y-4">
        {error && (
          <ApiErrorBanner title="Couldn't load conversations" detail={error} />
        )}
        <div className="card divide-y divide-ink-100">
          {conversations.length === 0 ? (
            <div className="p-10 text-center text-ink-500">
              No conversations.
            </div>
          ) : (
            conversations.map((c) => (
              <div key={c.id} className="p-4 flex items-start gap-4">
                <div className="h-9 w-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {(c.fullName ?? c.email ?? c.phone ?? "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium truncate">
                      {c.fullName ?? c.email ?? c.phone ?? "Unknown contact"}
                    </div>
                    <div className="text-xs text-ink-400 whitespace-nowrap">
                      {relative(c.lastMessageDate)}
                    </div>
                  </div>
                  <div className="text-sm text-ink-600 truncate mt-0.5">
                    {c.lastMessageBody ?? "—"}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-400 uppercase tracking-wide">
                    {c.lastMessageType && <span>{c.lastMessageType}</span>}
                    {(c.unreadCount ?? 0) > 0 && (
                      <span className="rounded-full bg-brand-600 text-white px-2 py-0.5">
                        {c.unreadCount} unread
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
