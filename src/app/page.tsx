import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  WrenchIcon,
  PaintRollerIcon,
  FaucetIcon,
  PlugIcon,
  HammerIcon,
  HouseIcon,
  DeckIcon,
  TilesIcon,
  CheckIcon,
  ShieldIcon,
  ClockIcon,
  StarIcon,
  PhoneIcon,
  MailIcon,
  PinIcon,
} from "@/components/icons";

const SERVICES = [
  {
    icon: WrenchIcon,
    title: "General Repairs",
    desc: "Squeaky doors, broken locks, drywall patches, leaky faucets — the punch list, handled.",
  },
  {
    icon: PaintRollerIcon,
    title: "Interior & Exterior Painting",
    desc: "Clean prep, even coats, sharp lines. Single rooms or whole houses.",
  },
  {
    icon: FaucetIcon,
    title: "Plumbing Fixes",
    desc: "Faucets, garbage disposals, toilets, supply lines, water heaters.",
  },
  {
    icon: PlugIcon,
    title: "Light Electrical",
    desc: "Outlets, switches, ceiling fans, light fixtures, smart-home installs.",
  },
  {
    icon: TilesIcon,
    title: "Tile, Floors & Trim",
    desc: "Backsplashes, bathroom tile, LVP, baseboard, crown moulding.",
  },
  {
    icon: HouseIcon,
    title: "Bathroom & Kitchen Remodels",
    desc: "Vanities, cabinets, countertops, full refreshes that don't blow the budget.",
  },
  {
    icon: DeckIcon,
    title: "Decks, Fences & Outdoor",
    desc: "Build, repair, stain, seal — pressure washing and gutter cleaning too.",
  },
  {
    icon: HammerIcon,
    title: "Furniture & TV Mounting",
    desc: "Flat-pack assembly, shelving, anchors done right, TVs hung cleanly.",
  },
];

const REASONS = [
  {
    icon: ShieldIcon,
    title: "Licensed & Insured",
    desc: "Fully licensed, bonded, and insured. You're covered, end of story.",
  },
  {
    icon: ClockIcon,
    title: "On-Time, Every Time",
    desc: "We show up when we say we will. If we're running late, you'll know first.",
  },
  {
    icon: CheckIcon,
    title: "Up-Front Pricing",
    desc: "No surprises. You get a written estimate before any work starts.",
  },
  {
    icon: StarIcon,
    title: "5-Star Workmanship",
    desc: "Built on referrals. Most of our jobs come from happy neighbors.",
  },
];

const REVIEWS = [
  {
    quote:
      "Showed up on time, finished the same day, and cleaned up after. Hung a TV, fixed two doors, and patched drywall my last guy butchered.",
    name: "Megan R.",
    location: "Homeowner",
  },
  {
    quote:
      "We had a list of about a dozen things and they knocked them all out in a Saturday. Fair price, super respectful of our house.",
    name: "Daniel K.",
    location: "Homeowner",
  },
  {
    quote:
      "Used them to redo our guest bathroom. New vanity, tile floor, paint. Looks better than the rest of the house now.",
    name: "Priya S.",
    location: "Homeowner",
  },
];

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <Services />
        <About />
        <WhyUs />
        <Process />
        <Reviews />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="hero-grid absolute inset-0 opacity-60" aria-hidden />
      <div
        aria-hidden
        className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl"
      />
      <div className="container-page relative grid items-center gap-12 py-20 sm:py-28 md:grid-cols-2">
        <div>
          <span className="eyebrow">Locally Owned · Licensed · Insured</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            Your home&apos;s <span className="text-brand-600">to-do list</span>,
            handled — start to finish.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-600">
            One Stop Handy Man LLC tackles repairs, improvements, and remodels
            with the same care we&apos;d give our own homes. One call, one crew,
            one invoice — no middlemen.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#contact" className="btn-primary">
              Get a Free Quote
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <a href="tel:+15555551234" className="btn-secondary">
              <PhoneIcon className="h-4 w-4" />
              Call (555) 555-1234
            </a>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-3 text-sm text-ink-700 sm:grid-cols-3">
            {[
              "Free estimates",
              "Same-week service",
              "Up-front pricing",
              "Clean job sites",
              "Satisfaction guaranteed",
              "No-fee callbacks",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-brand-700">
                  <CheckIcon className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="card relative overflow-hidden p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
                <WrenchIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  This Week&apos;s Availability
                </div>
                <div className="text-lg font-bold text-ink-900">
                  Booking visits Tue – Sat
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                { label: "Bathroom faucet swap", time: "1 – 2 hours", price: "from $149" },
                { label: "TV mount + cable hide", time: "1 hour", price: "from $129" },
                { label: "Interior room paint", time: "1 day", price: "from $399" },
                { label: "Deck stain & seal", time: "1 – 2 days", price: "quoted on site" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-ink-900">
                      {row.label}
                    </div>
                    <div className="text-xs text-ink-500">{row.time}</div>
                  </div>
                  <div className="text-sm font-bold text-brand-700">
                    {row.price}
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#contact"
              className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800"
            >
              See full price list <span aria-hidden>→</span>
            </a>
          </div>

          <div
            aria-hidden
            className="absolute -bottom-6 -left-6 hidden rotate-[-4deg] rounded-2xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-cta sm:block"
          >
            ⭐ 4.9 / 5 from 200+ jobs
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    "Free Estimates",
    "Veteran Owned",
    "Background-Checked Crews",
    "1-Year Workmanship Warranty",
    "Same-Week Service",
  ];
  return (
    <section className="border-y border-ink-100 bg-ink-50">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-xs font-semibold uppercase tracking-widest text-ink-500">
        {items.map((it) => (
          <span key={it} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
            {it}
          </span>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="section">
      <div className="container-page">
        <div className="max-w-2xl">
          <span className="eyebrow">What We Do</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            One crew. Every job on your list.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            If it lives in or around your home, we probably fix it, install it,
            or build it. Don&apos;t see your project below? Just ask.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <article
              key={s.title}
              className="card group p-6 transition hover:-translate-y-0.5 hover:border-brand-200"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {s.desc}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold text-brand-800">
              Don&apos;t see what you need?
            </div>
            <div className="text-sm text-ink-700">
              We&apos;ve probably done it. Send us a photo and a quick description.
            </div>
          </div>
          <a href="#contact" className="btn-primary">
            Ask About Your Project
          </a>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="section bg-ink-50">
      <div className="container-page grid gap-12 md:grid-cols-2 md:items-center">
        <div className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 shadow-card">
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-overlay opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at top left, rgba(255,255,255,0.5), transparent 60%), radial-gradient(ellipse at bottom right, rgba(0,0,0,0.4), transparent 50%)",
              }}
            />
            <div className="absolute inset-0 grid place-items-center text-white">
              <div className="text-center">
                <HouseIcon className="mx-auto h-20 w-20 opacity-90" />
                <div className="mt-4 text-sm font-bold uppercase tracking-[0.3em] opacity-80">
                  Built on
                </div>
                <div className="text-3xl font-extrabold">
                  Trust & craftsmanship
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 -right-6 hidden w-44 rotate-3 rounded-2xl bg-white p-4 shadow-card md:block">
            <div className="text-3xl font-extrabold text-ink-900">12+</div>
            <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              Years in the trades
            </div>
          </div>
        </div>

        <div>
          <span className="eyebrow">About Us</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            A handyman crew that actually picks up the phone.
          </h2>
          <p className="mt-5 text-lg text-ink-600">
            One Stop Handy Man LLC is a locally owned, family-run shop. We
            started because we got tired of homeowners getting ghosted, lowballed,
            and oversold by big-name contractors. Every job — big or small —
            gets the same standard: show up, do it right, leave it cleaner than
            we found it.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-6">
            {[
              { stat: "200+", label: "Happy homes served" },
              { stat: "12+", label: "Years experience" },
              { stat: "4.9★", label: "Average review" },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-3xl font-extrabold text-brand-700">
                  {s.stat}
                </dt>
                <dd className="mt-1 text-xs font-semibold uppercase tracking-widest text-ink-500">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" className="btn-primary">
              Schedule a Visit
            </a>
            <a href="#reviews" className="btn-secondary">
              Read Reviews
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section id="why" className="section">
      <div className="container-page">
        <div className="max-w-2xl">
          <span className="eyebrow">Why Homeowners Choose Us</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Old-school work ethic. Modern follow-through.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((r) => (
            <div key={r.title} className="card p-6">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-brand-300">
                <r.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    {
      step: "01",
      title: "Tell us what's up",
      desc: "Call, text, or fill out the form with photos. We respond within one business day — usually same day.",
    },
    {
      step: "02",
      title: "Get a clear quote",
      desc: "Up-front pricing in writing. No vague hourly hand-waving, no surprise add-ons.",
    },
    {
      step: "03",
      title: "We get to work",
      desc: "Background-checked crew, drop cloths down, jobsite kept tidy from arrival to final walk-through.",
    },
    {
      step: "04",
      title: "Done right, guaranteed",
      desc: "Workmanship warranty on every job. Something not perfect? We come back and make it right.",
    },
  ];

  return (
    <section className="section bg-ink-950 text-white">
      <div className="container-page">
        <div className="max-w-2xl">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-brand-400">
            How It Works
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Booking us is the easy part.
          </h2>
        </div>

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li
              key={s.step}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
            >
              <div className="text-3xl font-black text-brand-400">{s.step}</div>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section id="reviews" className="section">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <span className="eyebrow">Reviews</span>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              What the neighbors are saying.
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex">
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon key={i} className="h-5 w-5 text-brand-500" />
              ))}
            </div>
            <span className="text-sm font-semibold text-ink-700">
              4.9 out of 5 · 200+ jobs
            </span>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure key={r.name} className="card flex h-full flex-col p-7">
              <div className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <StarIcon key={i} className="h-4 w-4 text-brand-500" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-base leading-relaxed text-ink-700">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 border-t border-ink-100 pt-4">
                <div className="text-sm font-bold text-ink-900">{r.name}</div>
                <div className="text-xs text-ink-500">{r.location}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section
      id="contact"
      className="section bg-gradient-to-b from-brand-50 to-white"
    >
      <div className="container-page grid gap-12 md:grid-cols-5">
        <div className="md:col-span-2">
          <span className="eyebrow">Get In Touch</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Free estimate. Real human. Same week.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            Tell us about your project and we&apos;ll get back to you fast —
            usually within a few hours during business days.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
                <PhoneIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  Call or text
                </div>
                <a
                  href="tel:+15555551234"
                  className="text-base font-bold text-ink-900 hover:text-brand-700"
                >
                  (555) 555-1234
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
                <MailIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  Email
                </div>
                <a
                  href="mailto:hello@onestophandymanllc.com"
                  className="text-base font-bold text-ink-900 hover:text-brand-700"
                >
                  hello@onestophandymanllc.com
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
                <PinIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  Service area
                </div>
                <div className="text-base font-bold text-ink-900">
                  Locally owned · Within ~30 mi
                </div>
              </div>
            </li>
          </ul>
        </div>

        <form
          className="card md:col-span-3 grid gap-4 p-7 sm:p-8"
          action="mailto:hello@onestophandymanllc.com"
          method="post"
          encType="text/plain"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                className="input"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="input"
                placeholder="(555) 555-1234"
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="service" className="label">
              What do you need done?
            </label>
            <select
              id="service"
              name="service"
              className="input"
              defaultValue=""
            >
              <option value="" disabled>
                Pick a service…
              </option>
              <option>General repair / punch list</option>
              <option>Painting</option>
              <option>Plumbing fix</option>
              <option>Light electrical</option>
              <option>Tile / flooring / trim</option>
              <option>Bathroom or kitchen remodel</option>
              <option>Deck / fence / outdoor</option>
              <option>Furniture assembly / TV mounting</option>
              <option>Something else</option>
            </select>
          </div>
          <div>
            <label htmlFor="message" className="label">
              Project details
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              className="input"
              placeholder="Tell us a bit about the project, timing, and the address (for service area)."
            />
          </div>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-ink-500">
              We&apos;ll never share your info. Free, no-obligation estimate.
            </p>
            <button type="submit" className="btn-primary">
              Send Request
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
