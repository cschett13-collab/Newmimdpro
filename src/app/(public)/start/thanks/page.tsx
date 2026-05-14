import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { offer } from "@/lib/offer";

export default function ThanksPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <CheckCircle2 className="h-14 w-14 text-brand-600 mx-auto" />
      <h1 className="mt-6 text-3xl font-bold text-ink-900">Got it.</h1>
      <p className="mt-3 text-ink-500">
        We just received your details. Expect a reply from {offer.brand} within
        the hour during business hours, or first thing tomorrow morning.
      </p>
      {offer.bookingUrl && (
        <a
          href={offer.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-8 px-6 py-3 text-base"
        >
          Want to skip the wait? Book a call now
        </a>
      )}
      <div className="mt-10">
        <Link href="/start" className="text-sm text-brand-600 hover:underline">
          ← Back to packages
        </Link>
      </div>
    </main>
  );
}
