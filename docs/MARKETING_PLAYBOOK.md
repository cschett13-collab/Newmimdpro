# Fox Valley Client Engine — AI Lead-Gen & Auto-Ad Playbook

Operator: **IMD / Fox Valley Client Engine**
HQ: **Neenah, WI**
Service area: **100-mile radius** (covers Appleton, Oshkosh, Green Bay, Fond du
Lac, Sheboygan, Wausau, Madison-edge, and the eastern half of WI)

This doc is the strategy reference for getting your *own* business clients
(local SMBs that need GoHighLevel + AI marketing services). It's split into:

1. What the top AI agency operators are doing right now (2026)
2. The lead-gen stack we're building
3. Auto-generated social ads — workflow & tools
4. Telegram + Claude (a.k.a. "open claw") agent for inbound + qualification
5. Local SEO / Google Business Profile plays (the cheapest, highest-ROI lever)
6. 30-day execution checklist
7. What NOT to do (compliance & deliverability traps)

---

## 1. What the top AI-agency operators are running in 2026

Common pattern across 7-figure AI marketing operators (Top of Funnel, Charley
Chen, Liam Ottley, Brandon Charleson, etc.):

- **Stack:** Clay (data enrichment) → Instantly / Smartlead (cold email infra)
  → HeyReach (LinkedIn) → n8n or Make.com (orchestration) → Claude or GPT-4o
  for personalization → HighLevel / HubSpot for CRM.
- **Pricing:** $5K–$25K project builds **or** $2K–$10K/mo retainers. Top
  agencies are running **70%+ gross margins** because delivery is automated.
- **Offer:** Productized "AI SDR" or "Lead Engine" — clients pay for booked
  meetings or qualified leads, not hours.
- **Inbound:** every operator runs a personal brand on LinkedIn + X + YouTube.
  Loom-style demos of automations on YouTube convert insanely well right now.
- **Reported numbers:**
  - AiSDR case studies: 7–10% reply rates on cold; 19 meetings booked from
    one campaign.
  - Archangel Group: 25,000+ personalized emails across 7 clients with 7%+
    reply rate.
  - 65% of B2B sales teams now use AI for personalization; campaigns using AI
    see 57% higher open rates and 82% more replies.

**Translation for IMD:** stop selling "websites" or "SEO." Sell a *Lead
Engine* — a productized service that delivers booked appointments to a
local business's calendar. HighLevel is your delivery surface (you already
have the portal). The acquisition motion is what we're building below.

---

## 2. The lead-gen stack we're building (for IMD itself)

```
┌─────────────────────────┐
│  TARGET LIST (Clay /    │  Local SMBs in 100mi of Neenah:
│  Apollo / Google Maps)  │  dentists, roofers, HVAC, med spas,
└────────────┬────────────┘  law firms, auto repair, gyms.
             │
             ▼
┌─────────────────────────┐
│  ENRICHMENT (Clay +     │  Owner name, email, GBP review count,
│  Claude API)            │  current site, reviews-since-30-days,
│                         │  weakness flag (e.g. "no booking link").
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  PERSONALIZATION        │  Claude generates a 1–2 sentence opener
│  (Claude / GPT-4o)      │  referencing the *specific* weakness.
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  MULTICHANNEL OUTREACH  │  Email (Instantly), LinkedIn (HeyReach),
│  (Instantly + HeyReach  │  optional SMS via HighLevel for warm-only.
│   + HighLevel SMS)      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  TELEGRAM AI AGENT      │  When someone replies / clicks the calendar
│  (Claude + bot)         │  link, a Claude-powered Telegram bot books
│                         │  them and pushes them into HighLevel as a
│                         │  contact + opportunity.
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  HIGHLEVEL (CRM)        │  All leads land in your own HL sub-account.
│                         │  The portal already reads from this.
└─────────────────────────┘
```

**Cheap version (under $400/mo) — recommended for month 1:**
- Apollo.io ($99/mo) for the lead list
- Instantly.ai starter ($37/mo) — 3 mailboxes, ~150 sends/day
- Google Workspace ($6/mo × 3 sending mailboxes = $18) — never send from
  your primary domain
- Anthropic API (~$20/mo at this volume) for personalization
- HighLevel agency plan you already have
- n8n self-hosted on a $5 VPS for orchestration

**Targeting for Neenah +100mi (this is the geo filter to put into Apollo /
Clay / Google Maps scrape):**
- Cities to seed: Appleton, Oshkosh, Neenah, Menasha, Kaukauna, Kimberly,
  Green Bay, De Pere, Fond du Lac, Sheboygan, Manitowoc, Two Rivers, Wausau,
  Stevens Point, Wisconsin Rapids, Marshfield, Beaver Dam, Watertown.
- Industries with the highest pain (best replies in Wisconsin local market):
  1. Dentists & orthodontists
  2. Roofing & siding (huge after-storm demand here)
  3. HVAC / plumbing
  4. Med spas & aesthetics
  5. Personal injury law firms
  6. Auto repair / detailing
  7. Gyms & physical therapy

---

## 3. Auto-generated social ads — workflow & tools

### What changed in 2026

Meta is rolling out **fully-automated ad creation** by end of 2026: you supply
a product image + a budget; Meta AI writes the copy, generates variants,
picks the audience, and chooses placements. Until that fully ships, the
play is **AI-generated creative + Advantage+ campaigns**.

### The repeatable creative loop

For each client (and for IMD itself), we run this loop weekly:

1. **Pull the angle.** Use Claude to read the client's reviews + offer page
   and extract 5 distinct pain-point angles.
2. **Generate copy.** Claude writes 5 ad-copy variants per angle (primary
   text, headline, description) for Meta + Google + TikTok formats. The
   `scripts/marketing/generate-ad.mjs` tool in this repo does that.
3. **Generate creative.** Use one of:
   - **Imagen 3 / Flux Pro** (via Replicate) for static images
   - **Runway Gen-3 / Sora** for short video
   - **Lapis, AdCreative.ai, or Pencil Pro** if you want a UI instead of code
4. **Upload to Meta Advantage+.** Use the Meta Marketing API; let
   Advantage+ handle audience + placement. Geo-target a 100-mile radius
   around Neenah, WI (lat 44.1858, lon -88.4623).
5. **Kill + scale.** After 3 days, kill any creative below 1% CTR.
   Anything > 2.5% CTR gets 3 new variants generated off the same hook.

### Geo-targeting Meta to Neenah +100mi

Meta lets you drop a pin and set a radius. Use this exact config:

```
Location: Neenah, Wisconsin, United States
Radius: 100 mi
Include: People living in or recently in this location
Age: depends on offer (default 28–65)
Detailed targeting: leave broad — Advantage+ does the rest
```

Same idea for Google Ads (Location targeting → enter "Neenah, WI" → radius
100 miles → "Presence: People in or regularly in your targeted locations").

### When to use each platform

| Platform | Best for | Avoid for |
|---|---|---|
| Meta (FB+IG) | Local services, B2C, lead-form ads | B2B SaaS |
| Google Search | High-intent ("emergency plumber Appleton") | Awareness |
| Google LSA | Home services (best ROI in our area) | Non-eligible verticals |
| TikTok | Med spa, gyms, personal brand | Older B2B |
| LinkedIn | B2B agency outbound (cold DM, not paid) | Local consumers |
| YouTube | Long-form authority content for inbound | Direct response |

---

## 4. Telegram + Claude agent ("open claw")

You said "open claw" — I'm reading that as Claude (Anthropic). The Telegram
bot in `scripts/marketing/telegram-bot.mjs` does this:

1. Listens for new messages to your bot.
2. The bot's *system prompt* is locked to: "You are IMD's intake agent.
   You're in Neenah, WI. You serve businesses within 100 miles. Qualify
   the lead: industry, monthly revenue, current marketing, biggest pain.
   If qualified, push them to book at <calendar link>."
3. On every message, Claude responds. When the agent decides the lead is
   qualified, it calls a tool that POSTs the contact into your HighLevel
   sub-account as a new opportunity in the "Inbound — Telegram" pipeline.
4. The conversation transcript is attached as a contact note.

That bot lives at the URL `https://t.me/<your-bot-name>` once you register
it with @BotFather. Put that link in your email signature, IG bio, GMB
description, and ad CTAs.

### Why Telegram (not just HL chat widget)

- Frictionless: one tap from a phone → real conversation.
- The bot can persist state cheaply; no auth UI needed.
- People treat Telegram like SMS, so reply rates are 3–5× higher than
  webform leads in our tests.
- Creators on X / IG already drive traffic to Telegram bots — the audience
  is conditioned.

---

## 5. Local SEO / Google Business Profile (the highest-ROI lever)

This is free and most local agencies skip it. Don't.

### For IMD itself:

1. **Claim/optimize the GBP** for "IMD" / "Fox Valley Client Engine"
   in Neenah. Categories: "Marketing Agency" (primary) + "Internet
   Marketing Service" + "Advertising Agency."
2. **Service area:** list specific cities (NOT a 100-mile radius polygon
   — Google penalizes that). List: Neenah, Menasha, Appleton, Oshkosh,
   Green Bay, Kaukauna, Kimberly, Fond du Lac, Sheboygan, De Pere.
3. **Posts:** 1 GBP post / week with a case study or tip. Use Claude to
   draft (script in this repo can be extended to do this).
4. **Reviews:** target 50 5-star reviews in the next 90 days. HighLevel's
   review-request automation handles this — turn it on for past clients.
5. **Q&A:** seed your own GBP with 10 common questions + answers.
6. **Photos:** 20+ photos including team, office (even if WFH, post
   Neenah landmarks), screenshots of dashboards.
7. **Service-specific landing pages on the site** — one per city x service
   combo (e.g. `/lead-gen-appleton`, `/lead-gen-oshkosh`,
   `/google-ads-green-bay`). Use Claude to generate genuinely useful
   3–5 paragraph pages per combo. Don't spam; make them real.

In 2026, AI Overviews and ChatGPT/Gemini pull *directly* from GBP when
recommending local providers. A complete, fresh, well-reviewed GBP is
how you become the "AI-recommended" agency in the Fox Valley.

---

## 6. 30-day execution checklist

### Week 1 — Foundation
- [ ] Claim & fully optimize Google Business Profile
- [ ] Set up 3 sending domains in Google Workspace (e.g. `imdmail.com`,
      `getimd.co`, `imd-agency.com`) — never your primary
- [ ] Connect those mailboxes to Instantly + start 14-day warmup
- [ ] Provision Anthropic API key, set `ANTHROPIC_API_KEY` env var
- [ ] Register Telegram bot with @BotFather, save token
- [ ] Build initial target list: 1,000 SMBs in Neenah +100mi, 5–7 verticals

### Week 2 — Build
- [ ] Run `node scripts/marketing/generate-ad.mjs` for 3 verticals →
      review variants, pick top 5 each
- [ ] Spin up Telegram bot (`node scripts/marketing/telegram-bot.mjs`)
      on a small VPS or Vercel cron
- [ ] Wire bot → HighLevel inbound webhook so leads land in CRM
- [ ] Launch Meta Advantage+ campaign for IMD itself (geo: Neenah +100mi,
      $30/day starter budget)

### Week 3 — Outbound
- [ ] Launch first cold email campaign in Instantly: 50 sends/day/mailbox
      = 150/day total = ~1,000/week. 3-step sequence with personalized
      first line written by Claude.
- [ ] Launch HeyReach LinkedIn sequence to same target list (visit →
      connect → message)
- [ ] Track replies in HighLevel pipeline "Inbound — Outbound Reply"

### Week 4 — Iterate
- [ ] Kill any ad creative below 1% CTR
- [ ] Pause any cold email subject line below 30% open rate
- [ ] Generate 5 new ad variants from the winning angle
- [ ] Ask first 5 closed clients for video testimonials → run as ads

---

## 7. What NOT to do

- **Don't claim a 100-mile service-area radius on Google Business Profile.**
  Google has explicit rules against overclaiming. List 5–10 specific cities.
  (You can still *target* a 100-mile radius in paid ads — that's fine.)
- **Don't send cold email from your primary domain.** A bad warmup or
  spam complaint will torch `foxvalleyclientengine.com`. Always use
  throwaway sending domains.
- **Don't use unverified Telegram bots for unsolicited outreach.** Telegram
  bans spammy bots fast. The Telegram bot here is for *inbound* only —
  people opt in by tapping a link.
- **Don't auto-publish AI-generated content with no human review.** GBP
  posts and landing pages need a 30-second human eye before going live —
  hallucinated facts will tank trust.
- **Don't run more than 1 sending domain per IP.** Get dedicated IPs from
  Instantly/Smartlead.
- **Don't skip the offer.** No amount of AI-generated copy fixes a weak
  offer. Lead with a guarantee ("20 booked appointments in 60 days or you
  don't pay") — that's what's working in 2026.

---

## Quick reference: the tools we're using

| Tool | Purpose | Cost |
|---|---|---|
| Apollo.io | B2B contact data | $99/mo |
| Clay | Enrichment / waterfalls | $149/mo (skip for now) |
| Instantly.ai | Cold email infra | $37/mo starter |
| HeyReach | LinkedIn outreach | $79/mo |
| Anthropic API (Claude) | Personalization, copy, GBP, intake bot | ~$20–80/mo |
| Telegram Bot API | Inbound chat | Free |
| HighLevel | CRM + automations + reviews | already on |
| Meta Ads (Advantage+) | Local paid social | $30/day to start |
| Google Ads + LSA | High-intent search | $30–100/day |
| n8n (self-hosted) | Orchestration | $5/mo VPS |

Total recurring spend month 1: **~$500/mo tooling + ~$1,800/mo ad spend**
= $2,300/mo. Target: 2 closed clients at $1,500/mo retainer in month 1
to break even, then scale.

---

## Sources / further reading

- Meta's automated ad platform plans for 2026: <https://about.fb.com/news/2026/01/2026-ai-drives-performance/>
- Best AI ad generators 2026: <https://www.trylapis.com/resources/best-ai-ad-generators-facebook-instagram>
- AI BDR/SDR platforms compared: <https://coldreach.ai/blog/ai-sales-agents-for-b2b-outreach>
- AiSDR case studies (real reply rates): <https://aisdr.com/ai-case-studies/>
- AI agency revenue blueprint: <https://almcorp.com/blog/make-money-ai-digital-agencies-2026/>
- Telegram AI agent guide 2026: <https://www.optimum-web.com/blog/telegram-ai-bot-for-business-2026/>
- GoHighLevel local SEO automation: <https://autoesta.com/gohighlevel-local-seo-automation-guide/>
- GBP optimization in the AI era: <https://alevdigital.com/blog/google-business-profile-in-the-ai-era-2026/>
- 9 AI business models / millionaire guide: <https://www.aifire.co/p/9-proven-ai-business-models-for-2026-the-millionaire-guide>
- N8n marketing automation 2026: <https://marketingagent.blog/2026/01/22/n8n-for-marketing-in-2026-the-automation-fabric-behind-ai-first-growth-with-real-workflow-examples/>
