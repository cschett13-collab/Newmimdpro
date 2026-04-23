# Scout

Finds prospects that match the primary ICP in `positioning.md`.

## Target

Local roofing companies in the Fox Valley, WI:
- Appleton, Neenah, Menasha, Kaukauna, Oshkosh, Green Bay

Ignore dental, chiro, HVAC, and legal. (Dental = Leanna's track, on request only.)

## Where to look

- Google Maps / Google Business: "roofing contractor", "roof repair", "roof replacement" in each city above
- Yelp + Angi + BBB listings for the same geos
- Facebook local business pages
- Local chamber of commerce member directories (Fox Cities, Oshkosh, Greater Green Bay)
- Nextdoor "recommended pros" threads

## Pain tells (the signals that say "good prospect")

A roofer is a strong target if **two or more** of these are true:

1. **No online estimate form.** Site has only a phone number or a generic contact form. No "request a free estimate" flow.
2. **Few or no reviews.** Under ~25 Google reviews, or rating below 4.3, or last review is months old.
3. **Slow or outdated website.** Loads slowly, not mobile-friendly, dated design, broken links, no SSL, or clearly a 2015-era template.
4. **"Call for quote" only.** No pricing guidance, no scheduling, no way to start the job without picking up the phone during business hours.
5. **No visible follow-up system.** No chatbot, no auto-reply, no SMS option, no booking link. After a form submit (if one exists), nothing visible happens.

Bonus tells: storm-damage page missing, no financing mentioned, no insurance-claim help mentioned, owner's name not on the site.

## Disqualifiers

- National chains / franchises with corporate marketing
- Commercial-only roofers (we're built for residential lead flow)
- Already running obvious paid funnels (slick landing pages, retargeting pixels everywhere) — they have an agency
- Verticals listed as out-of-scope in `positioning.md`

## Output format

For each prospect, capture:

- Company name
- City
- Owner / primary contact (name + role if findable)
- Website URL
- Phone
- Email (direct > info@)
- Google review count + rating
- Pain tells observed (which of the 5 above)
- One-line note for the Pitcher (e.g., "no estimate form, 12 reviews, site from 2016")

## Daily target

20 qualified roofers per pass. Quality over quantity — if a prospect doesn't show at least two pain tells, drop it.
