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
| `CRON_SECRET` | Required for `/api/bots/*`. Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically. |
| `BOT_LEAD_RESPONDER_LOOKBACK_MIN` | Optional. Default `10`. Minutes back to scan for new contacts. |
| `BOT_LEAD_RESPONDER_TEMPLATE` | Optional. SMS copy. Supports `{{firstName}}`. |

## Bots

Always-on automations live under `src/app/api/bots/`. Vercel Cron triggers them
on the schedule defined in `vercel.json`.

### Lead responder (`/api/bots/lead-responder`)

Scans each client's HighLevel sub-account every minute for contacts created in
the last `BOT_LEAD_RESPONDER_LOOKBACK_MIN` minutes, sends an instant SMS, and
tags the contact `fvce-bot-responded` so it never double-texts.

**PIT scopes required (in addition to the read-only ones above):**
- `contacts.write` — to add the dedupe tag
- `conversations.write` and `conversations/message.write` — to send the SMS

**Verify before going live:**

```bash
# Dry-run (lists who would be texted, sends nothing):
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-host>/api/bots/lead-responder?dryRun=1"
```

**Notes:**
- Vercel Cron runs every minute on Pro plans only. Hobby is once daily — bump
  `vercel.json` to `0 * * * *` (hourly) or upgrade.
- The bot is idempotent via the `fvce-bot-responded` tag. Remove the tag in
  HighLevel to re-allow a contact.

## Deploy

Any Node.js host works. Vercel is simplest:

```bash
vercel deploy
```

Set the four env vars in the Vercel project settings. Redeploy. Add the
resulting domain (e.g. `portal.foxvalleyclientengine.com`) as a CNAME.

## Notes

- All HighLevel calls happen **server-side**. PITs never reach the browser.
- The portal is read-only for now — it's a reporting surface, not a HighLevel
  replacement. Extending it to write data (create contacts, send messages, etc.)
  is straightforward: add methods to `src/lib/highlevel.ts` and new routes.
- If HighLevel returns an error for one of the widgets on the dashboard, the
  rest of the page still renders and an amber banner shows the error detail.
