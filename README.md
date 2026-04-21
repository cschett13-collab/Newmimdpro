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

## Quickstart on your Windows PC

You said you have Claude Code on your PC. From there:

```
git clone https://github.com/cschett13-collab/Newmimdpro.git
cd Newmimdpro
git checkout claude/instagram-business-setup-nieo4
scripts\setup.bat
```

That installs everything and creates a `.env` from the template. Then:

1. Open `.env` in Notepad. Fill in `IG_ACCESS_TOKEN`, `IG_USER_ID`, and either
   `HIGHLEVEL_WEBHOOK_URL` **or** `HIGHLEVEL_API_TOKEN` + `HIGHLEVEL_LOCATION_ID`.
   (Detailed how-to below.)
2. Edit `content\queue.json` and replace the `example.com` URLs with real
   publicly-hosted image/video URLs + your captions.
3. Validate: `scripts\run.bat doctor`
4. Fire one test post: `scripts\run.bat once`
5. Start the loop: `scripts\run.bat`

Or, if you prefer Docker Desktop:

```
docker compose up -d
docker compose logs -f
```

---

## One-time setup (the parts only you can do)

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
   Paste that as `IG_ACCESS_TOKEN` in `.env`.
7. Find your `IG_USER_ID` automatically:
   ```
   scripts\run.bat find-ig
   ```
   It lists every Page + linked Instagram Business account ID. Copy the right
   one into `.env`.

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

### 3. Content

Each entry in `content/queue.json` needs a **publicly reachable** image or
video URL, the type, and a caption. See `content/README.md` for rules and
hosting options.

---

## Command reference

| Command                     | What it does                                     |
|-----------------------------|--------------------------------------------------|
| `scripts\setup.bat`         | Install Python deps, create `.env` from template |
| `scripts\run.bat doctor`    | Validate `.env`, test IG token + HL webhook      |
| `scripts\run.bat find-ig`   | Print every IG_USER_ID your token can see        |
| `scripts\run.bat once`      | Publish the next unposted item, then exit        |
| `scripts\run.bat`           | Start the scheduler (posts every 5 hours)        |
| `docker compose up -d`      | Same, but under Docker - no Python install needed|

Mac / Linux: replace `scripts\run.bat` with `./scripts/run.sh`.

Change the cadence in `.env` via `POST_INTERVAL_HOURS`.

---

## What the code does, file by file

| File | Purpose |
|---|---|
| `src/config.py` | Loads `.env` into a typed `Config`. |
| `src/instagram.py` | Instagram Graph API client: create container, wait for video processing, publish. |
| `src/content_queue.py` | Reads/writes `content/queue.json`; picks next unposted item; marks as posted. |
| `src/highlevel.py` | Sends a JSON payload to your HighLevel webhook OR creates a note via the API after each IG post. |
| `src/main.py` | Entry point. `once` publishes once; no arg = forever loop. |
| `scripts/doctor.py` | Pre-flight validator. |
| `scripts/find_ig_user_id.py` | Helper to discover your IG_USER_ID from a token. |

---

## Things I did NOT build (tell me if you want them)

- Automatic content *generation* (AI image/caption). The code posts what you
  feed it.
- Facebook Page auto-cross-posting. Easy add with the same Graph API token.
- Ads / monetization setup. Those are manual Meta Business Suite steps; no
  API makes it one-click.
- A web UI for managing the queue.
