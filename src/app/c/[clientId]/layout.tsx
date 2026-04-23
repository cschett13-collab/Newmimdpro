import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient, getClients } from "@/lib/clients";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarDays,
  MessagesSquare,
  Mail,
  ChevronDown,
  LogOut,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clientId: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  const clients = getClients();

  const navItems = [
    { href: `/c/${client.id}`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/c/${client.id}/contacts`, label: "Contacts", icon: Users },
    { href: `/c/${client.id}/opportunities`, label: "Pipeline", icon: Briefcase },
    { href: `/c/${client.id}/appointments`, label: "Appointments", icon: CalendarDays },
    { href: `/c/${client.id}/conversations`, label: "Conversations", icon: MessagesSquare },
    { href: `/c/${client.id}/drafts`, label: "Drafts", icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-ink-50 grid grid-cols-[240px_1fr]">
      <aside className="border-r border-ink-100 bg-white flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <div className="text-[10px] uppercase tracking-widest text-ink-400">
            Fox Valley Client Engine
          </div>
          <div className="text-sm font-semibold">Client Portal</div>
        </div>

        <div className="px-3">
          <details className="group">
            <summary className="list-none cursor-pointer px-3 py-2 rounded-lg border border-ink-100 flex items-center justify-between hover:border-brand-300">
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-ink-400">Client</div>
                <div className="font-medium truncate">{client.name}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-ink-400 group-open:rotate-180 transition" />
            </summary>
            <div className="mt-1 border border-ink-100 rounded-lg bg-white overflow-hidden">
              {clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/c/${c.id}`}
                  className={`block px-3 py-2 text-sm hover:bg-ink-50 ${
                    c.id === client.id ? "bg-brand-50 text-brand-700" : ""
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </details>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-100"
            >
              <Icon className="h-4 w-4 text-ink-400" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-3">
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost w-full justify-start">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
