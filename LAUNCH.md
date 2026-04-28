# LAUNCH — Get this making money today

This branch adds a public sales funnel at **`/start`** that sells a productized
HighLevel setup service. You don't need to write any code to use it — just fill
in three env vars and ship.

## What's live

- `/start` — public sales page (3 pricing tiers + lead form)
- `/start/thanks` — confirmation page after a lead submits
- `/api/lead` — accepts the form, logs the lead, and forwards to a webhook

These routes are public. Everything else in the portal still requires login.

## 60-minute launch checklist

### 1. Create three Stripe Payment Links (15 min)

1. Go to https://dashboard.stripe.com/payment-links → **+ New**
2. Create one product per tier:
   - **Starter Setup** — one-time, $297
   - **Pro Setup** — one-time, $797
   - **Done-For-You Monthly** — recurring, $497/mo
3. After each one, copy the URL (looks like `https://buy.stripe.com/...`).
4. Paste into env vars:
   ```
   STRIPE_CHECKOUT_STARTER=https://buy.stripe.com/...
   STRIPE_CHECKOUT_PRO=https://buy.stripe.com/...
   STRIPE_CHECKOUT_MANAGED=https://buy.stripe.com/...
   ```
   If you skip this, the buttons just scroll to the contact form.

### 2. Wire up lead notifications (5 min)

Pick the easiest one for you:

- **Discord** (recommended for instant phone push notifications):
  - Server settings → Integrations → Webhooks → New Webhook → copy URL.
  - `LEAD_WEBHOOK_URL=https://discord.com/api/webhooks/...`
- **Zapier** (if you want leads emailed / sent to Google Sheets / SMS):
  - Create a Zap → trigger "Webhooks by Zapier → Catch Hook" → copy URL.
  - Action: "Email by Zapier" → send to your inbox.
  - `LEAD_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/...`
- **Slack**: Apps → Incoming Webhooks → install → copy URL.

If you skip this, leads still get logged to your server (visible in
`vercel logs` or your terminal).

### 3. Set your contact email + brand (1 min)

```
OFFER_BRAND=Your Business Name
OFFER_CONTACT_EMAIL=you@yourdomain.com
```

Optional: change the headline / subhead too — see `.env.example`.

### 4. Deploy (10 min)

```bash
vercel deploy --prod
```

Set the env vars in Vercel project settings → Redeploy. Done.

Your sales page is live at `https://<your-vercel-domain>/start`.

### 5. Get the first sale (everything else)

The hard part isn't the page — it's traffic. Pick ONE today:

- **Cold DM 20 local businesses on Instagram/FB.** Script:
  > "Hey — saw {business name}. I build HighLevel systems for local
  > {plumbers/dentists/whatever} and just opened 2 spots this week at $297
  > done-in-48-hours. Want me to send the link?"
- **Post in 3 local Facebook groups** with a quick before/after demo video
  and a link to `/start`.
- **Email past clients** with the new productized offer.

You don't need 100 leads. You need 1.

## Customizing the offer

All copy and pricing lives in `src/lib/offer.ts`. Headline, subhead, brand
name, and contact email can be overridden via env vars (see `.env.example`)
without editing code. Pricing tiers, features, and bullets live in that file
if you want to tweak them.

## Going further (later)

- Add a Calendly / SavvyCal link in `OFFER_BOOKING_URL` so the thank-you page
  offers an instant booking.
- Switch from Payment Links to full Stripe Checkout if you need custom intake
  per tier.
- Add an SEO-friendly testimonials section once you have the first 2-3 wins.
