# PaMarket Website — Go-Live Runbook

Everything built in the recent website work is committed and deploys with
the site. A few pieces need **one-time setup in Supabase / third-party
dashboards** before the paid features and emails switch on. This is the
single checklist for that. Nothing here is code you write — it's config.

Work top to bottom. Each section says what breaks if you skip it (mostly:
that feature stays dormant and shows a friendly "not available yet"
message — the rest of the site is unaffected).

---

## 0. What already works with ZERO setup

These are live the moment the site deploys — no action needed:

- Homepage, browse, listings, shops, reviews, seller profiles, the whole
  redesign.
- **Post a job** (free up to 2 active jobs per employer).
- **Apply to a job**, including LinkedIn-style screening questions.
- **Employer applications inbox** (`/applications`) + shortlist/decline.
- **Seller dashboard** (`/dashboard`) — listings, views, spending, apps.
- Featured/boost *placement* (boosted listings already rank first with a
  FEATURED badge) — buyers see it; only the *buying* needs Paynow below.

---

## 1. Database migrations (Supabase → SQL Editor)

Run these three files' contents, in this order. Each is safe to re-run.

1. `supabase/migrations/add_paynow_boosts.sql`
   → payment ledger + `activate_paynow_boost` (listing boosts).
2. `supabase/migrations/add_paynow_products.sql`
   → widens the ledger for featured-slot packs & job-credit packs.
3. `supabase/migrations/add_platform_stats_rpc.sql`
   → `get_platform_stats()` for the admin section of the dashboard.

**If skipped:** boosts/slots/credits can't be bought; the admin
platform-overview panel won't load. Job posting/applying still work
(they use tables from the app's existing migrations).

---

## 2. Paynow — paid features (boosts, featured slots, job credits)

Revenue rail. Website equivalent of the app's Google Play Billing.

1. Create a Paynow account at **paynow.co.zw** → create a **Web**
   integration → make sure **USD** is enabled on it.
2. Copy the **Integration ID** and **Integration Key**.
3. Set the Edge Function secrets:
   ```
   supabase secrets set PAYNOW_INTEGRATION_ID=xxxxx
   supabase secrets set PAYNOW_INTEGRATION_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
4. Deploy the two functions:
   ```
   supabase functions deploy paynow-create-payment
   supabase functions deploy paynow-check-payment --no-verify-jwt
   ```
   (`--no-verify-jwt` on the check function is required — Paynow calls it
   back without a Supabase JWT; it re-verifies every payment against
   Paynow's own status URL by cryptographic hash before granting anything.)

**Prices are fixed server-side and match the app** — $2/$10/$30 boosts,
$8/$20 job boosts, $2/$5 featured slots, $3/$12 job credits.

**If skipped:** the Boost / Buy-slots / Buy-credits buttons show
"payments not configured yet". Nothing else breaks.

**Test:** sign in, open your own listing, Boost → 1 day ($2) → pay with
EcoCash → you land on `/boost-return`, the listing gets a FEATURED badge
and ranks first. Confirm the `paynow_payments` row is `consumed`.

> Refund note: Paynow has no automatic refund callback. If you refund in
> the Paynow dashboard, reverse the entitlement by hand (e.g. set the
> listing's `featured_until` back).

---

## 3. Resend — application emails

Notifies the employer of each new applicant and sends the candidate a
receipt (and a status email when you shortlist/decline).

1. Sign up at **resend.com** (free tier is plenty to start).
2. **Verify the domain pamarketzw.com** (Resend → Domains → add the DNS
   records at your registrar). This is what keeps mail out of spam.
3. Create an API key (Resend → API Keys).
4. Set secrets:
   ```
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set EMAIL_FROM="PaMarket <noreply@pamarketzw.com>"
   supabase secrets set NOTIFY_WEBHOOK_SECRET=<a-long-random-string>
   ```
   (Reuse the SAME `NOTIFY_WEBHOOK_SECRET` your message-notifications
   webhook already uses, if you have one.)
5. Deploy the function:
   ```
   supabase functions deploy notify-application --no-verify-jwt
   ```
6. Create a **Database Webhook** (Supabase → Database → Webhooks):
   - Table: `public.applications`
   - Events: **Insert** and **Update**
   - Type: Supabase Edge Function → `notify-application`
   - HTTP header: `x-webhook-secret` = the same value from step 4.

**If skipped:** applications still submit and appear in `/applications`;
they just don't send email until this is connected. The function fails
gracefully and never blocks an application.

**Test:** apply to one of your jobs from a second account → the employer
account gets "New application", the applicant gets a receipt → shortlist
them in `/applications` → they get "You've been shortlisted".

---

## 4. Admin & ads — use your existing admin portal (www/admin.html)

Admin (moderation, ads, revenue) lives in your existing hardened portal
`www/admin.html`, which is deliberately kept OFF the public website
(`.github/workflows/pages.yml` strips it from the deploy). Keep running it
the way you already do.

**Ads on the website:** the portal's "Create Paid Ad" tool now writes the
two fields the public website needs (`title` + `placement`), so an ad you
create there with **placement = Home** appears in the homepage sponsored
band on pamarketzw.com (with its headline), as well as in the app. No
separate website admin — one portal. (This is a change to
`www/admin.html`, so rebuild/redeploy your admin the way you normally do.)

**Make yourself admin** (if not already): Supabase → Table Editor →
`profiles`, set your row's `role` to `admin`.

---

## 4b. Fix website image uploads (redeploy get-r2-upload-url + R2 CORS)

Uploading photos when posting on the **website** was failing because the
image-upload Edge Function's CORS allowlist didn't include the website
domain (only the app's). Fixed in code — you must redeploy it:

```
supabase functions deploy get-r2-upload-url
```

If images STILL fail to upload after that, the second layer is the
Cloudflare **R2 bucket's own CORS policy** (the browser PUTs the file
straight to R2). In the Cloudflare dashboard → R2 → your public bucket →
Settings → CORS Policy, ensure it allows the website origin, e.g.:

```json
[
  {
    "AllowedOrigins": ["https://pamarketzw.com", "https://www.pamarketzw.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

(Keep any existing app entries too.) **If skipped:** text posting works
but photos won't attach on the website.

---

## 5. Legal wording (5-minute copy edit)

The website Terms already has a Paynow section (terms.html §11). Double-
check it reads the way you want, and that the app's own Terms
(`www/js/auth.js`) still say Google-Play-only for the app — the two can
differ (app = Play, website = Paynow), which is correct and allowed.

---

## Quick status table

| Feature | Works now | Needs setup |
|---|---|---|
| Browse / listings / shops / reviews | ✅ | — |
| Post & apply to jobs + screening Qs | ✅ | — |
| Applications inbox | ✅ | — |
| Seller dashboard | ✅ | — |
| Boost / featured-slot / job-credit **placement** | ✅ | — |
| Boost / slots / credits **purchase** | — | §1 + §2 (Paynow) |
| Application emails | — | §1 not needed; §3 (Resend) |
| Admin (moderation/ads/revenue) | ✅ your existing www/admin.html | §4 (admin role) |
| Website **image upload** when posting | — | §4b (redeploy fn + R2 CORS) |

---

## Recommended order & time budget

1. §1 migrations — 5 min.
2. §4 make yourself admin — 1 min.
3. §2 Paynow — 20–30 min (mostly Paynow account/verification), then a
   real $2 test boost.
4. §3 Resend — 20 min (mostly DNS propagation for domain verification),
   then a real test application.
5. §5 legal glance — 5 min.

Then leave it a week and read `/dashboard` — the numbers tell us whether
the next build is growth, trust & safety, or on-web chat.
