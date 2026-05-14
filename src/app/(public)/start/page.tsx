import Link from "next/link";
import { Check, Zap, Shield, Clock } from "lucide-react";
import { offer, tiers } from "@/lib/offer";
import LeadForm from "./LeadForm";

export default function StartPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
      {/* Hero */}
      <header className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 mb-6">
          <Zap className="h-3.5 w-3.5" />
          {offer.brand}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
          {offer.headline}
        </h1>
        <p className="mt-5 text-lg text-ink-500 leading-relaxed">
          {offer.subhead}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#pricing" className="btn-primary px-6 py-3 text-base">
            See pricing
          </a>
          <a href="#contact" className="btn-ghost px-6 py-3 text-base">
            Talk to us first
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-500">
          {offer.proof.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-brand-600" />
              {p}
            </li>
          ))}
        </ul>
      </header>

      {/* Features */}
      <section className="mt-20 grid gap-6 sm:grid-cols-2">
        {offer.features.map((f) => (
          <div key={f.title} className="card p-6">
            <h3 className="text-lg font-semibold text-ink-900">{f.title}</h3>
            <p className="mt-2 text-sm text-ink-500 leading-relaxed">
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section id="pricing" className="mt-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-ink-900">
            Pick a package. We start today.
          </h2>
          <p className="mt-3 text-ink-500">
            Pay once, own it. No retainers required. 48-hour delivery on every
            tier.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`card p-6 flex flex-col ${
                t.highlight ? "ring-2 ring-brand-500 shadow-lg" : ""
              }`}
            >
              {t.highlight && (
                <div className="self-start rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white mb-3">
                  Most popular
                </div>
              )}
              <h3 className="text-xl font-semibold text-ink-900">{t.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{t.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-ink-900">
                  {t.price}
                </span>
                <span className="text-sm text-ink-500">{t.cadence}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {t.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-ink-700"
                  >
                    <Check className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <CheckoutButton tier={t} />
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        <div className="card p-5 flex items-start gap-3">
          <Clock className="h-5 w-5 text-brand-600 mt-0.5" />
          <div>
            <div className="font-semibold text-ink-900">48-hour delivery</div>
            <div className="text-sm text-ink-500">
              From kickoff form to live system in two business days.
            </div>
          </div>
        </div>
        <div className="card p-5 flex items-start gap-3">
          <Shield className="h-5 w-5 text-brand-600 mt-0.5" />
          <div>
            <div className="font-semibold text-ink-900">Money-back promise</div>
            <div className="text-sm text-ink-500">
              Don't love it in 7 days? Refund, no questions.
            </div>
          </div>
        </div>
        <div className="card p-5 flex items-start gap-3">
          <Zap className="h-5 w-5 text-brand-600 mt-0.5" />
          <div>
            <div className="font-semibold text-ink-900">You own it</div>
            <div className="text-sm text-ink-500">
              Built in your HighLevel account. Cancel us, keep the system.
            </div>
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="contact" className="mt-20">
        <div className="card p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-ink-900">
            Not sure which package?
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            Tell us about your business and we'll reply within an hour with a
            recommendation.
          </p>
          <LeadForm />
          <p className="mt-4 text-xs text-ink-400">
            Or email us directly:{" "}
            <a
              href={`mailto:${offer.contactEmail}`}
              className="text-brand-600 hover:underline"
            >
              {offer.contactEmail}
            </a>
          </p>
        </div>
      </section>

      <footer className="mt-20 text-center text-xs text-ink-400">
        &copy; {new Date().getFullYear()} {offer.brand}. All rights reserved.
      </footer>
    </main>
  );
}

function CheckoutButton({ tier }: { tier: (typeof tiers)[number] }) {
  if (tier.checkoutUrl) {
    return (
      <a
        href={tier.checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-6 ${
          tier.highlight ? "btn-primary" : "btn-ghost border border-ink-200"
        } w-full justify-center py-3`}
      >
        {tier.cta}
      </a>
    );
  }
  return (
    <Link
      href="#contact"
      className={`mt-6 ${
        tier.highlight ? "btn-primary" : "btn-ghost border border-ink-200"
      } w-full justify-center py-3`}
    >
      {tier.cta}
    </Link>
  );
}
