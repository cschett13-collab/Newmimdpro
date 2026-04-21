# Fox Valley Client Engine - Instagram auto-poster

Posts one image or Reel to your Instagram Business account every 5 hours,
and notifies your HighLevel account after each publish.

**Honest disclaimers**
- I cannot create Instagram / Facebook / HighLevel accounts for you. You set
  those up once; this code drives them via their APIs.
- "Viral" is not a feature any API provides. This tool publishes whatever
  media URLs + captions you add to `content/queue.json`. Quality of content =
  your job.
- Posting too frequently can get an account flagged. Every 5h (~5/day) is fine
  for a healthy business account.

---

## One-time setup

### 1. Instagram Business account + Meta app

1. Make sure you have a **Facebook Page** for the business.
2. Create an **Instagram Business** (or Creator) account and link it to that
   Page. (Instagram app -> Settings -> Account type and tools.)
3. Go to https://developers.facebook.com -> **My Apps** -> **Create app** ->
   type **Business**.
4. In the app, add the **Instagram Graph API** product.
5. Open **Graph API Explorer**, select your app, request these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_show_list`
6. Generate a **User Access Token**, then exchange it for a **long-lived Page
   access token**: https://developers.facebook.com/docs/facebook-login/guides/access-tokens#long-lived
7. Find your IG User ID:
   ```
   GET /me/accounts         -> get your {page-id}
   GET /{page-id}?fields=instagram_business_account
   ```
   The `instagram_business_account.id` is your `IG_USER_ID`.

### 2. HighLevel

Pick ONE path:

**Path A - Webhook (easiest).**
- In HighLevel: **Automation -> Workflows -> New Workflow -> Add Trigger ->
  Inbound Webhook**.
- Copy the webhook URL into `.env` as `HIGHLEVEL_WEBHOOK_URL`.
- Build whatever HighLevel flow you want after the trigger (notify you,
  create a contact note, move a pipeline, etc.). Payload shape is in
  `src/highlevel.py`.

**Path B - Private Integration token (full API).**
- **Settings -> Private Integrations -> Create Token.**
- Copy the token + your Location ID into `.env` as `HIGHLEVEL_API_TOKEN` and
  `HIGHLEVEL_LOCATION_ID`.
- Verify the endpoint path in `src/highlevel.py::_send_api_note` against your
  current HighLevel API docs before going live.

### 3. Local install

```bash
git clone <this repo>
cd Newmimdpro
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and fill in the values
```

### 4. Add content to the queue

Edit `content/queue.json`. Each entry needs a **publicly reachable** image or
video URL, the type, and a caption. See `content/README.md` for rules.

---

## Running

**Test a single post** (uses the first unposted queue item):
```bash
python -m src.main once
```

**Run forever, posting every 5 hours:**
```bash
python -m src.main
```

Change the cadence in `.env` via `POST_INTERVAL_HOURS`.

### Keep it running

On your own machine just leave it in a terminal, or use:
- **Linux (systemd):** create a unit calling `python -m src.main`.
- **Any OS:** run under `pm2`, `supervisord`, or a Docker container.

---

## What the code does, file by file

| File | Purpose |
|---|---|
| `src/config.py` | Loads `.env` into a typed `Config`. |
| `src/instagram.py` | Instagram Graph API client: create container, wait for video processing, publish. |
| `src/content_queue.py` | Reads/writes `content/queue.json`; picks next unposted item; marks as posted. |
| `src/highlevel.py` | Sends a JSON payload to your HighLevel webhook OR creates a note via the API after each IG post. |
| `src/main.py` | Entry point. `once` publishes once; no arg = forever loop. |

---

## Things I did NOT build (tell me if you want them)

- Automatic content *generation* (AI image/caption). The code posts what you
  feed it.
- Facebook Page auto-cross-posting. Easy add with the same Graph API token.
- Ads / monetization setup. Those are manual Meta Business Suite steps; no
  API makes it one-click.
- A web UI for managing the queue.
