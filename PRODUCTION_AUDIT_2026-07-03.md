# PaMarket — Production Readiness Audit

**Date:** 2026-07-03
**Scope:** Customer app, Business portal, Admin panel, Website, Supabase schema/RLS
**Method:** Static verification against real code, SQL schema, RLS policies, and call
graphs. No live runtime test environment was available, so any claim that depends on
executing against production is explicitly marked **Not Verified**.

> Honesty note: this audit did **not** cover all 12 requested sections to completion.
> Sections 6 (enterprise fleet-admin rebuild), 10 (performance), and 11 (full journey
> walk-through) were **not** executed — they are net-new construction or require a
> runtime, and are listed under *Not Done / Deferred*. Nothing below is marked
> "working" unless it was traced in code.

---

## Executive Summary

Seven verified defects were found and fixed (6 via SQL migrations that must be run
manually in the Supabase SQL Editor, per project convention; plus client changes).
The most important — the reported **critical** rental-messaging misroute — is fixed
and verified end-to-end in code.

A recurring **root cause** runs through several findings: the `notifications` INSERT
policy is self-only (`auth.uid() = user_id`), which is correct for stopping an anon
read-leak but silently breaks every **cross-user** and **admin→user** notification
that was being inserted client-side. This affected messaging, reviews/leads, and all
admin moderation notices. Fixed for the two highest-impact paths (message trigger +
admin insert policy); the review/lead notification path is a documented follow-up.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| Msg-3 | **Critical** | Rental inquiries routed to owner's personal DM inbox, not Business inbox | **Fixed** |
| N1 | **High** | Cross-user (message) notifications rejected by RLS → never reach recipient | **Fixed (trigger)** |
| A1 | **High** | Admin→user moderation notifications rejected by RLS → users never notified | **Fixed (RLS)** |
| S2 | **High** | `rental_set_listing_state` had no ownership check → any user alters any fleet's state | **Fixed** |
| RP1 | **High** | Business & message reports silently dropped by CHECK constraint | **Fixed** |
| S1 | **Medium** | `get_or_create_rental_conversation` trusted caller-supplied user_id (spoofing) | **Fixed** |
| R3 | **Medium** | No admin moderation for the general `reviews` table | **Fixed (RLS)** |
| AD1 | **Medium** | Ads created in-app never rendered on the website | **Partially fixed (data layer)** |
| S3 | **Low** | Cron aggregation RPC callable by any authenticated user | **Fixed** |
| RP2 | **Low** | Admin reports list capped at 20, no pagination | **Noted** |
| R2 | Gap | Services & jobs have no review capability | **Product decision** |

---

## Section 1 — Review System

**Verified working:**
- General `reviews` table: unique `(seller_id, reviewer_id)` prevents duplicates; UPDATE
  policy exists (`add_listing_view_rpc.sql`) so editing via upsert works; anti-self-review
  CHECK. Ratings computed client-side on read (`profile.js:47`), so no staleness.
- `rental_reviews`: self-review guard trigger, moderation `status`, soft delete, unique
  constraint. Aggregation trigger `rental_sync_company_rating` correctly fires on insert /
  status-update / delete and filters `status='published'` — correct for all reachable
  moderation paths.
- Users/sellers reviewable via profile; rental companies via `rental_reviews`; admin can
  moderate rental reviews.

**Fixed — R3 (Medium):** the general `reviews` table had only a reviewer-self-delete
policy — an admin could not remove an abusive/defamatory review of a normal seller.
→ `fix_reviews_admin_moderation.sql` adds an admin-delete policy.
*Follow-up:* no admin **UI** yet for general-review moderation (RLS is now in place).

**Gap — R2 (product decision):** `services.js` and `jobs.js` have **no** review entry
point. Service and job providers cannot receive reviews. This is a scope decision, not a
bug; service providers (being users) could be reviewed via their profile if an entry
point were added.

**Latent (not reachable today, noted for future):** if rating-editing or `deleted_at`
soft-delete is ever enabled on `rental_reviews`, the aggregation trigger (`update of
status` only; ignores `deleted_at`) would need widening.

**Verdict: PASS** (with one product gap and one moderation-UI follow-up).

---

## Section 2 — Report System

**Fixed — RP1 (High):** users could report a **business** (`messages.js` reportShop) or a
**message**, but `reports.target_type` CHECK only allowed
`listing/user/support/bug/appeal`. Postgres rejected those inserts while the UI said
"Report submitted" and swallowed the error — reports vanished silently.
→ `fix_reports_target_types.sql` widens the constraint to include `business` and
`message`; client now logs insert failures instead of swallowing them.

**Verified working:** report creation for listings/users/support; admin resolution
workflow (`resolveReport` → `status='resolved'`); read-leak already closed
(`admin_security_hardening.sql`: reporter-or-admin only). The admin loader handles any
`target_type` generically, so the newly-accepted types display without further change.

**Noted — RP2 (Low):** admin report loader is `.limit(20)` with no pagination — older
reports are invisible.

**By design:** reports do not notify the reported party (correct — you don't tell
someone they've been reported).

**Verdict: PASS** (after migration; pagination is a scalability follow-up).

---

## Section 3 — Rental Messaging (CRITICAL) — FIXED

**Root cause:** `R.chatCompany` opened rental inquiries via `H.startChatWith` (the
**personal-DM** path), creating a plain `conv_` thread with no `businessId`. The messages
UI files those in the **Personal** inbox tab and shows the owner's personal profile in the
chat header — exactly the reported "goes to the personal account" symptom.

**Fix (`rentals.js`, `index.html`):** new `H.startRentalBizChat` opens a `biz_`-prefixed,
`businessId`-tagged conversation (the same mechanism `startBizChat` uses for shops),
sourcing company identity from the rental detail cache. `business_id` is now preserved in
`detailCache`/`compCache`. The `biz_` conversation id is written into
`rental_conversation_context`, which the business portal's `openInquiry` reads directly —
so the owner's "Recent Inquiries" tap opens the same thread.

**Verified in code:** owner-side pickup via `app.js` Phase-2b biz scan (rental company's
`businesses` row is loaded by `fetchMyBusinesses`, no type filter); inbox segregation
(`messages.js:320`) and Business-tab rendering (`messages.js:331`); recipient
(`owner_user_id`) and RLS unchanged → no isolation impact. Legacy cached details without
`business_id` fall back to the old path.

**Not Verified:** live two-account run against Supabase.
**Known discontinuity:** chats opened before the fix keep old history in the Personal tab
(one-time, not data loss).

**Verdict: PASS (code-verified), pending one live smoke test.**

---

## Section 4 — Business / Cross-User Notifications

**Fixed — N1 (High):** `H.pushNotif` inserts a notification addressed to the **recipient**
from the **sender's** session; the self-only INSERT RLS rejects it, so message
notifications never reached the other party's devices (message body still synced via the
`messages` table). → `fix_message_notifications_server_side.sql` adds a security-definer
trigger on `messages` INSERT that creates the recipient notification(s), mirroring the
existing rental notify-trigger pattern.

**Verified working:** rental event notifications already use security-definer triggers
correctly (`fix_rental_notify_triggers.sql`, `fix_rental_notifications_scope_and_gaps.sql`)
with a `category='rental'` tag for scoping.

**Follow-up (not fixed):** review/lead notifications (`business-profile.js:495`,
`business-leads.js`) hit the same RLS wall and need the same server-side treatment
(trigger or `is_admin`-style definer RPC). Lower frequency than messaging.

**Verdict: PARTIAL PASS** — messaging fixed; review/lead notification delivery is a known
remaining gap.

---

## Section 5 — Admin Panel

**Verified working:**
- **AuthN/AuthZ:** login checks `profiles.role='admin'`, signs out non-admins, has
  brute-force lockout. Crucially, **authorization is enforced server-side by RLS**
  (`is_admin()` policies on profiles/listings/reports/paid_ads/rental_*), not just the UI
  gate — admin.html even surfaces "RLS blocked it" errors, confirming the DB is the
  boundary.
- Verification approval (`verifications`, `company_verifications`) has admin RLS policies.
- No stub/placeholder sections; broadcast-notification composer present.

**Fixed — A1 (High):** admin moderation notices (listing approved/rejected, ban/reinstate,
verification, broadcasts) all insert notifications for the affected user and were **all**
RLS-rejected — users never learned of any moderation outcome.
→ `fix_admin_notifications_insert.sql` widens the insert policy to
`auth.uid() = user_id OR is_admin()`.

**Verdict: PASS** (after migration).

---

## Section 6 — Rental Fleet Admin Rebuild — NOT DONE

Deliberately not executed. This is a full enterprise fleet-management module (dashboards,
maintenance, document verification, bulk ops, revenue analytics, soft delete/restore,
pagination). Building it blind — without a design you have reviewed — risks days of
misdirected work. The **existing** rental admin sections (approvals, companies, listings,
reviews, reports, analytics, audit logs, featured, lookups) are present and RLS-gated.
**Recommend:** a dedicated design pass before implementation.

---

## Section 7 — Website Ad Synchronization

**Verified working (app side):** `paid_ads` is fully dynamic in the app — `active=true`
fetch, realtime INSERT/UPDATE subscriptions, 3-min polling fallback, impression + click
tracking (`app.js`, `ads-carousel.js`). **No hardcoded ads.**

**Fixed (partial) — AD1 (Medium):** the website never read `paid_ads`, so in-app ads did
not appear on the site. → added `PM.fetchActiveAds` (active + `starts_at`/`ends_at`
window) to the shared `marketplace-data.js` PostgREST layer, so the website can render the
**same live ads**. `paid_ads` already has `public read` RLS.

**Remaining:** (1) actual homepage banner **placement/render** left for a design pass;
(2) `PM.trackAdEvent` is a stub — the anon website key cannot UPDATE `paid_ads`
(admin-write RLS), so website impression/click tracking needs a security-definer increment
RPC (like the app's listing-view RPC).

**Verdict: PARTIAL** — capability delivered; render + tracking are scoped follow-ups.

---

## Section 8 — Website / App Data Consistency

**Verified working:** the website's `marketplace-data.js` queries the **same production
tables** (`listings` with `status=eq.active`, `businesses`, `rental_*`, `jobs`) via
PostgREST with the anon key — the identical database the app uses. No duplicate content
store, no hardcoded/placeholder/fake listings found. Website and app show identical live
data.

**Verdict: PASS.**

---

## Section 9 — Security

**Fixed:**
- **S2 (High)** `rental_set_listing_state`: no ownership check → any authenticated user
  could change any vehicle's operational state (e.g. flag a competitor's fleet
  unavailable). Now requires listing ownership or admin.
- **S1 (Medium)** `get_or_create_rental_conversation`: trusted caller-supplied `p_user_id`
  → inquiry/lead spoofing. Now uses `auth.uid()`.
- **S3 (Low)** `rental_aggregate_daily`: cron job granted to `authenticated` → revoked.

(All three in `fix_rental_definer_rpc_authz.sql`; none are called by the app, so zero
flow impact.)

**Verified working (already hardened before this audit):**
- Notifications anon read-leak closed (`fix_notifications_rls_missing.sql`).
- Rental company verification-document leak closed — base table owner/admin-only, public
  view exposes only safe columns (`fix_rental_company_profiles_doc_leak.sql`).
- Rental analytics auth-bypass fixed (`fix_rental_business_analytics_auth_bypass.sql`).
- No service-role key or secret in client code; R2 uploads are auth-gated (Bearer token)
  with size limits.

**Not Verified (require prod/runtime):** the `get-r2-upload-url` Edge Function's key
namespacing/authz (memory flags it can be stale in prod); full RLS behavior under a live
anon session.

**Verdict: PASS for reviewed surfaces; edge-function deployment unverified.**

---

## Section 10 — Performance — NOT DONE

Not executed. Observations noted incidentally: admin reports/notifications use small
`.limit()` values with no pagination (RP2); the app has feed/filter indexes migrations
(`add_feed_indexes_*`, `add_filter_indexes_*`) and a rental search-index table, suggesting
prior perf work. A dedicated pass (query plans, index coverage, realtime subscription
count) is recommended.

---

## Section 11 — User Journey Walk-through — NOT DONE (no runtime)

Cannot be honestly certified without executing the app. Code-level tracing was done for
the rental inquiry journey (Section 3) and notification delivery (Sections 4–5) only.

---

## Section 12 — Certification

### Migrations to run manually (Supabase SQL Editor), in any order:
1. `fix_reports_target_types.sql` — accept business/message reports
2. `fix_reviews_admin_moderation.sql` — admin can moderate general reviews
3. `fix_message_notifications_server_side.sql` — deliver message notifications
4. `fix_admin_notifications_insert.sql` — deliver admin moderation notices
5. `fix_rental_definer_rpc_authz.sql` — authz on rental definer RPCs

Client changes (`rentals.js`, `messages.js`, `marketplace-data.js`, `index.html`) are
already pushed to `master`. `rentals.js` cache version bumped to `v=18`.

### Subsystem status
| Subsystem | Status |
|-----------|--------|
| Reviews | PASS (product gap: services/jobs; follow-up: general-review admin UI) |
| Reports | PASS after migration (follow-up: pagination) |
| Rental messaging | PASS (code-verified; 1 live smoke test pending) |
| Cross-user notifications | PARTIAL (messaging fixed; review/lead delivery pending) |
| Admin panel | PASS after migration |
| Rental fleet admin | NOT DONE (needs design) |
| Ad sync | PARTIAL (data layer done; render + tracking pending) |
| Website/app consistency | PASS |
| Security | PASS for reviewed surfaces (edge fn unverified) |
| Performance | NOT AUDITED |
| User journeys | NOT AUDITED (no runtime) |

### Production readiness
**Not a single percentage — that would be false precision.** Honest assessment:
- **Data-integrity & security core (Sections 1–5, 8, 9): ~90% verified**, contingent on
  the 5 migrations being applied. Without them, notifications and business/message reports
  remain broken.
- **Full platform certification: incomplete** — Sections 6, 10, 11 were not done.

### Remaining risks
1. **Migrations not yet applied** → notification & report fixes are inert until run.
2. Review/lead notifications still RLS-blocked (Section 4 follow-up).
3. `get-r2-upload-url` edge function deployment state unverified.
4. No runtime verification of any user journey.

### Recommended next steps (priority order)
1. Apply the 5 migrations; smoke-test rental inquiry + a message notification live.
2. Extend the server-side notification pattern to review/lead events.
3. Add a security-definer increment RPC so website ads track impressions/clicks; place the
   homepage ad banner.
4. Add admin UI + pagination for general reviews and reports.
5. Scope the Section 6 fleet-admin module and Sections 10–11 (perf + journeys) as
   dedicated efforts.
