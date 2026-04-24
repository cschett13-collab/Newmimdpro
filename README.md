# Fox Valley Client Engine — Client Portal

A branded client portal for **Fox Valley Client Engine** (operated by IMD) that
pulls live stats out of each client's HighLevel (GoHighLevel / LeadConnector)
sub-account and displays them as its own self-contained app.

- **Tech stack:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Auth:** cookie-based session (JWT), one admin login for staff
- **Data source:** HighLevel v2 REST API (`services.leadconnectorhq.com`), called
  server-side with a Private Integration Token (PIT) per sub-account
- **Multi-client:** one portal, many HighLevel sub-accounts

## What you get

- Dashboard per client with live metrics:
  - Total contacts
  - Open pipeline value & opportunity count
  - Won revenue (last 30 days)
  - Unread conversations
  - Pipeline-by-stage breakdown
  - Upcoming appointments
  - Recent conversations and active opportunities
- Full-page views for Contacts, Pipeline, Appointments, Conversations
- Client switcher in the sidebar — add as many HighLevel sub-accounts as you want

## Quick start

```bash
npm install
npm run setup          # generates .env.local with a fresh session secret
# edit .env.local — set admin creds + add at least one client (below)
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

## Configure clients

The portal reads its client list from the `PORTAL_CLIENTS` environment variable,
which is a JSON array. For **each** HighLevel sub-account you want to report on:

1. Open that sub-account in HighLevel.
2. **Settings → Private Integrations → Create new integration.**
3. Enable these scopes (minimum):
   - `contacts.readonly`
   - `opportunities.readonly`
   - `conversations.readonly`
   - `calendars.readonly` and `calendars/events.readonly`
   - `locations.readonly`
4. Copy the generated token (starts with `pit-...`).
5. Add an entry to `PORTAL_CLIENTS` in `.env.local`. Example:

```bash
PORTAL_CLIENTS='[
  {
    "id": "acme",
    "name": "Acme Dental",
    "locationId": "abc123locationId",
    "pit": "pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  {
    "id": "northside",
    "name": "Northside Roofing",
    "locationId": "def456locationId",
    "pit": "pit-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  }
]'
```

The `id` is whatever short slug you want (it shows up in the URL: `/c/<id>`).
The `locationId` is the HighLevel sub-account ID (found in Settings → Business Profile,
or in the URL `app.gohighlevel.com/v2/location/<locationId>/...`).

## Environment variables

| Variable | Description |
| --- | --- |
| `PORTAL_SESSION_SECRET` | Long random string used to sign session JWTs. Generate with `openssl rand -hex 32`. |
| `PORTAL_ADMIN_EMAIL` | Login email for Fox Valley Client Engine staff. |
| `PORTAL_ADMIN_PASSWORD` | Login password. Use something long. |
| `PORTAL_CLIENTS` | JSON array of client configs (see above). |

## Deploy

Any Node.js host works. Vercel is simplest:

```bash
vercel deploy
```

Set the four env vars in the Vercel project settings. Redeploy. Add the
resulting domain (e.g. `portal.foxvalleyclientengine.com`) as a CNAME.

## IMD's own lead-gen stack (separate from the portal)

The portal is the *delivery surface* for clients. To get more clients,
there's a separate set of CLI tools under `scripts/marketing/` that run
IMD's own AI lead-gen and ad-generation pipeline (Telegram intake bot,
auto-generated social ads, personalized cold-email writer).

Strategy: see [`docs/MARKETING_PLAYBOOK.md`](./docs/MARKETING_PLAYBOOK.md).

```bash
# Generate Meta + Google + TikTok ad variants for a vertical
ANTHROPIC_API_KEY=... node scripts/marketing/generate-ad.mjs \
  --offer "20 booked appts in 60 days or you don't pay" \
  --vertical "roofing contractor" --city "Appleton, WI" --radius 100

# Run the Telegram intake bot (long-poll; daemonize via systemd/pm2)
ANTHROPIC_API_KEY=... TELEGRAM_BOT_TOKEN=... HL_INBOUND_WEBHOOK_URL=... \
  node scripts/marketing/telegram-bot.mjs

# Personalize a CSV of cold-email prospects
ANTHROPIC_API_KEY=... node scripts/marketing/personalize-cold-email.mjs \
  --in prospects.csv --out prospects-personalized.csv
```

## Notes

- All HighLevel calls happen **server-side**. PITs never reach the browser.
- The portal is read-only for now — it's a reporting surface, not a HighLevel
  replacement. Extending it to write data (create contacts, send messages, etc.)
  is straightforward: add methods to `src/lib/highlevel.ts` and new routes.
- If HighLevel returns an error for one of the widgets on the dashboard, the
  rest of the page still renders and an amber banner shows the error detail.
