# Email setup — Mailgun + Cloudflare

End-to-end walkthrough for wiring the dispatcher to a real, authenticated
sending domain. The dispatcher itself is fully built (`workers/email_dispatcher/`);
this doc only covers the external-account plumbing.

Estimated wall-clock: 30 min if DNS is on Cloudflare, ~1 hr otherwise (waiting
on DNS propagation at slow registrars).

---

## 1. Choose a sending subdomain

Use `mg.<your-apex>` (so `mg.foxvalleyclientengine.com`), not the apex itself.
Reasons:

- Mailgun's docs assume it; their UI generates DNS records scoped to it.
- A bad outreach reputation stays on `mg.`, not the marketing/site domain.
- You can still set `Reply-To: hello@<apex>` so replies hit your real inbox.

## 2. Mailgun signup

1. Sign up at https://signup.mailgun.com/new/signup. Pay-As-You-Go is fine
   (1,000 emails/mo free, then $0.80 per 1,000).
2. **Sending → Domains → Add New Domain**
3. Domain name: `mg.foxvalleyclientengine.com`
4. DKIM key length: **2048-bit**
5. Region: **US** (matches `smtp.mailgun.org`; pick EU and you'll need
   `smtp.eu.mailgun.org` plus `MAILGUN_REGION=eu` when running the DNS script).

Mailgun will display 5 DNS records on the next screen. Keep that tab open.

## 3. Add DNS via Cloudflare API (fastest path)

Create an API token:

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token**
2. Template: **Edit zone DNS**
3. Zone resources: **Include → Specific zone → foxvalleyclientengine.com**
4. Continue → Create → copy the token (you only see it once)

Copy the DKIM public-key string from Mailgun's TXT record for
`s1._domainkey.mg.foxvalleyclientengine.com`. It looks like `k=rsa; p=MIGfMA0G...`
followed by a long base64 blob. Copy everything between the quotes — not
the quotes themselves.

Then run:

```bash
export CF_API_TOKEN='<paste token>'
export MAILGUN_DKIM_PUBLIC_KEY='k=rsa; p=MIGfMA0G...'   # full key from Mailgun
export DMARC_REPORT_EMAIL='cschett13@gmail.com'         # optional but recommended

./scripts/cloudflare-mailgun-dns.sh foxvalleyclientengine.com
```

Output should end with `done.` and five records will exist in Cloudflare DNS.
DRY_RUN=1 prints what it would do without writing.

## 4. Verify in Mailgun

1. Wait ~30 seconds.
2. Back in Mailgun → your domain → **Verify DNS settings**.
3. All five rows should turn green within a minute or two. If any stay red,
   recheck the corresponding Cloudflare record's content.

## 5. Grab SMTP credentials

Mailgun → Sending → Domain settings → **SMTP credentials**:

```
SMTP hostname:  smtp.mailgun.org
Port:           587
Username:       postmaster@mg.foxvalleyclientengine.com
Password:       <long generated string>
```

Click the eye icon to reveal, or **Reset password** if you've lost it. Note
the password — it is shown only once on reset.

## 6. Fill in `.env`

Paste the password into `SMTP_PASSWORD`. All other SMTP vars in `.env.example`
already match the Mailgun convention. Verify the postal address — CAN-SPAM
requires a real, current street address in the footer of every send.

## 7. Smoke-test before deploying

```bash
./scripts/smtp-test.py your-personal-email@gmail.com
```

This loads `.env`, connects to Mailgun, authenticates, and sends one message.
On success the SMTP transcript prints to stdout and the message lands in your
inbox within seconds. **Check the spam folder first** — your domain reputation
is brand-new and Gmail/Outlook will be cautious for the first few sends.

If it lands in spam: that's normal on day one. Real volume + replies + people
clicking "Not spam" trains the reputation in 7–14 days. Don't blast 5,000
contacts on day one — Mailgun will throttle you and inbox providers will
flag the domain.

## 8. Recommended warmup ramp

| Day | Daily sends | Notes |
|-----|------------:|-------|
| 1–2 | 20          | Friendlies who will open and reply. |
| 3–5 | 50          | Start the real outreach list. |
| 6–10 | 100        | |
| 11–14 | 200       | |
| 15+ | 500+        | Watch Mailgun's bounce/complaint dashboard. |

Keep bounce rate < 5% and complaint rate < 0.1% or Mailgun will suspend
the account. Scrub the list (NeverBounce / ZeroBounce) before importing if
the contacts came from old scraping runs.

## Troubleshooting

**AUTH FAILED at `smtp-test.py`**
The username must be `postmaster@mg.foxvalleyclientengine.com`, not
`postmaster@foxvalleyclientengine.com`. Mailgun shows the wrong one in some
UI surfaces — always use the value from **Domain settings → SMTP credentials**.

**Mailgun verify stays red on the TXT records**
Cloudflare splits long TXT values on save. The API script handles this
correctly. If you added the TXT manually through the dashboard and it's
red, delete + re-add via the script.

**CNAME `email.mg…` shows orange cloud in Cloudflare**
Click it to make it gray (DNS only). Proxy breaks open-tracking pixels.

**Emails land in spam every time**
- Check `https://www.mail-tester.com/` — send a test to the address it
  gives you, then click "Then check your score." Anything below 8/10
  needs fixing before volume.
- Add a real `https://foxvalleyclientengine.com` website if there isn't
  one. Receivers check that the sending domain has a public presence.
- Set up DMARC at `p=quarantine` once a week of clean sending shows no
  spoofing reports.
