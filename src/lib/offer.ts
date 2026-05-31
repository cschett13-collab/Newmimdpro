// Offer configuration for the public /start sales page.
// Everything here can be overridden by env vars so you can change pricing,
// copy, and Stripe links without touching code. Defaults match the
// "HighLevel Setup In 48 Hours" productized service.

const env = (k: string, fallback = "") => process.env[k] ?? fallback;

export type Tier = {
  id: "starter" | "pro" | "managed";
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  bullets: string[];
  cta: string;
  checkoutUrl: string;
  highlight?: boolean;
};

export const offer = {
  brand: env("OFFER_BRAND", "Fox Valley Client Engine"),
  headline: env(
    "OFFER_HEADLINE",
    "Your HighLevel account, fully built and live in 48 hours.",
  ),
  subhead: env(
    "OFFER_SUBHEAD",
    "We install pipelines, automations, calendars, forms, and review requests so leads stop falling through the cracks. Done-for-you. Flat fee. No retainers required.",
  ),
  bookingUrl: env("OFFER_BOOKING_URL", ""),
  contactEmail: env("OFFER_CONTACT_EMAIL", "hello@example.com"),
  proof: [
    "Built specifically for local service businesses",
    "Setup completed in 48 hours or your money back",
    "No long-term contracts — pay once, own it",
  ],
  features: [
    {
      title: "Sales pipeline that closes itself",
      body: "Pre-built stages, automations to move leads forward, and Slack/SMS alerts when a hot lead hits the top of the funnel.",
    },
    {
      title: "Calendar + booking in one place",
      body: "Your team's calendars synced with HighLevel, branded booking pages, reminder texts, and no-show recovery sequences.",
    },
    {
      title: "Reviews on autopilot",
      body: "Every won customer gets an automated Google review request. We've seen clients add 10+ stars in the first month.",
    },
    {
      title: "All your conversations, one inbox",
      body: "SMS, email, FB messages, IG DMs, and webchat all unified — your team replies from one screen.",
    },
  ],
};

export const tiers: Tier[] = [
  {
    id: "starter",
    name: "Starter Setup",
    price: "$297",
    cadence: "one-time",
    tagline: "Just enough to stop losing leads.",
    bullets: [
      "1 sales pipeline (up to 6 stages)",
      "1 calendar + branded booking page",
      "3 lead-follow-up automations",
      "Webchat widget on your site",
      "Delivered in 48 hours",
    ],
    cta: "Get Starter — $297",
    checkoutUrl: env("STRIPE_CHECKOUT_STARTER", ""),
  },
  {
    id: "pro",
    name: "Pro Setup",
    price: "$797",
    cadence: "one-time",
    tagline: "The full system. Most popular.",
    bullets: [
      "Everything in Starter",
      "Up to 3 pipelines (sales, ops, win-back)",
      "Full automation snapshot installed",
      "Review-request system + missed-call text-back",
      "Unified inbox setup (SMS / email / FB / IG)",
      "60-min onboarding call",
    ],
    cta: "Get Pro — $797",
    checkoutUrl: env("STRIPE_CHECKOUT_PRO", ""),
    highlight: true,
  },
  {
    id: "managed",
    name: "Done-For-You Monthly",
    price: "$497",
    cadence: "/mo",
    tagline: "We run it. You answer the leads.",
    bullets: [
      "Everything in Pro",
      "We manage your automations + pipelines",
      "Monthly performance report",
      "New campaigns built on request",
      "Cancel anytime",
    ],
    cta: "Start Managed — $497/mo",
    checkoutUrl: env("STRIPE_CHECKOUT_MANAGED", ""),
  },
];
