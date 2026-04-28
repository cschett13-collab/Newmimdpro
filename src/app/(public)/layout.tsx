import type { Metadata } from "next";
import { offer } from "@/lib/offer";

export const metadata: Metadata = {
  title: `${offer.brand} — HighLevel Setup In 48 Hours`,
  description: offer.subhead,
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-ink-50">{children}</div>;
}
