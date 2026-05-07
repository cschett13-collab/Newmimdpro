"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/stocks", label: "Swing — buy the dip" },
  { href: "/stocks/day", label: "Day trader" },
];

export function StocksTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 -mb-px">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-2 text-sm border-b-2 transition ${
              active
                ? "border-brand-600 text-brand-700 font-medium"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
