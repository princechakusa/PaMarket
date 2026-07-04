# PaMarket Admin Panel — Enterprise Audit Report

**File audited:** `www/admin.html` (3,863 lines, single-file app, Supabase JS v2, no framework)
**Date:** 2026-07-04
**Method:** Full static read of the code. Runtime behaviour, RLS policies, and Edge Functions were **not executed** — anything depending on them is marked **Not Verified**.

---

## 1. Executive Summary

The admin panel is a well-crafted single-file console that already covers the day-to-day moderation loop for a small marketplace: listing approval, ID/company verification, user ban/verify, reports triage, paid ads, push notifications, business subscriptions, and a notably mature **Rental Admin** suite (approvals, bulk actions, severity-ranked reports, review auto-flagging, audit logs, lookups, time-windowed analytics).

However, it is architected for **hundreds of users, not hundreds of thousands**. The three structural problems are:

1. **Everything is loaded into browser memory up front.** `loadAllData()` pulls users (limit 500), listings (300), messages (600), reports (200), etc. on every login. All search, filtering, counting, and CSV export operate on those capped arrays. At 100k users, the Users tab silently shows only the newest 500 and every dashboard number except the rental ones is **wrong, not just slow**.
2. **Security is single-role and client-enforced at the UI layer.** One `role='admin'` gate, no RBAC, no MFA, client-side-only login lockout, and — outside rentals — **no audit trail** for bans, deletions, plan overrides, or settings changes. The panel is also shipped inside the Android/iOS app bundles, enlarging the attack surface.
3. **Whole platform verticals have no admin surface.** Jobs, Services, Property, Vehicle Sales, marketplace Reviews, and marketplace Categories are managed nowhere; the rental vertical shows what "done" looks like, and the same pattern needs to be replicated.

The rental modules prove the right patterns already exist in this codebase (server-side `count` queries, `.select('id')` writes that detect RLS-blocked updates, audit-log inserts, pagination via `.range()`). The core recommendation of this audit is: **generalise the rental patterns to the rest of the panel** rather than rebuild anything.

**Production readiness: 6.5/10 today (≤5k users) · 3/10 at 100k users without the High-Priority fixes below.**

---

## 2. Current Strengths (exists and works, per code)

- Clean tab architecture (`TAB_TITLES`/`renderTab` map) — adding a module is cheap.
- Separate Supabase auth storage key so admin sessions don't collide with the app (`pamarket-admin-auth`).
- Consistent `esc()` HTML-escaping across nearly all rendered data.
- Graceful degradation everywhere: missing tables/columns fall back instead of crashing (e.g. `rental_reports.severity` retry, `verifications` table SQL helper shown inline). This matches the "migrations are manual" workflow.
- Rental admin is genuinely enterprise-shaped: bulk approve/reject/feature, listing health flags (no images / low engagement / unavailable), report severity + `resolved_by`/`resolved_at` stamping, required rejection reasons persisted to `rental_audit_logs.after_state`, searchable audit trail, per-company deep view, 7/30/90-day analytics windows with top-listing/company rankings.
- Rental writes use `.update(...).select('id')` and treat 0 matched rows as an RLS denial with a clear error message — the correct server-authoritative pattern.
- Push notification composer: segments, province filter, scheduling, deep links, image URL, live preview, delivery result breakdown (FCM sent / no token / failed).
- Maintenance tab: real storage-orphan purge with paged DB scan and batched deletes, plus an activity log.
- Login brute-force throttle (5 attempts / 15 min) — weak (see Security) but present.
- CSV export for users and listings.
- Mobile-responsive sidebar; confirm dialogs on all destructive actions; optimistic local-state updates after writes.

---

## 3. Missing Modules (no admin surface at all)

| Missing module | Notes |
|---|---|
| **Jobs admin** | Platform has Jobs + Hire Talent (contact requests exist), but no job-post moderation, expiry, employer view, or category management. |
| **Services admin** | No moderation, provider quality, or category tools. |
| **Property admin** | No property-specific moderation (title/deed checks, agent verification, duplicate-address detection). |
| **Vehicle Sales admin** | Rentals are covered; vehicle *sales* rely on generic listing moderation only. |
| **Marketplace Reviews** | Only `rental_reviews` are moderated. If marketplace/business reviews exist, they are unmoderated from this panel. |
| **Marketplace Categories / Lookups** | Categories are hardcoded in the ad-creation form (`electronics`, `vehicles`, …). No equivalent of the rental lookups editor. |
| **Global Audit Logs** | `rental_audit_logs` only. No log of core-admin actions (bans, deletes, plan overrides, settings). |
| **Admin Team Management** | No page to list admins, grant/revoke roles, or see who did what. |
| **Finance / Revenue dashboard** | Ad revenue is a single sum; subscription MRR, payment history, and invoice status have no view. |
| **Boost management** | Tab is named "Ads & Boosts" but renders only `paid_ads` — listing boosts (if they exist in the app) have no surface. **Not Verified** whether boosts are a separate table. |
| **Appeals** | No workflow for banned users or rejected listings/verifications to appeal. |
| **Platform Ops** | No Edge Function/cron/queue/storage/email monitoring (see §12). |

---

## 4. Module-by-Module Audit

Format per module: purpose → gaps → recommendations. "Exists" statements are code-verified.

### 4.1 Overview (dashboard)
- **Purpose:** 6 stat cards, alert boxes for pending work, quick-approve pending listings, recent users.
- **Gaps:** All numbers derive from the capped in-memory arrays (users ≤500, listings ≤300), so "Users: 500" will display forever once the platform passes 500 users. No trends/deltas, no revenue, no rental stats on the main overview, no per-admin task queue.
- **Fix (high):** Replace card values with `select('id',{count:'exact',head:true})` queries (already done for rentals in `raLoadSummary`) or one `admin_dashboard_summary` RPC. Add 7-day deltas.

### 4.2 Listings
- **Exists:** status filter tabs with counts, title/seller search, view modal with photos, approve/reject (optional reason, seller notified), delete, CSV export.
- **Missing features:** pagination (hard 300 cap); server-side search; filters by category/province/price/date; bulk approve/reject (rentals have it); duplicate detection; image moderation queue; quality score; expiry/auto-archive of stale listings; edit listing; seller context (other listings, prior rejections) in the review modal; price column in the table.
- **Automation:** auto-approve for verified sellers exists only as a settings toggle (`autoApproveVerified`) — enforcement is presumably app-side, **Not Verified**. Add: auto-flag listings whose seller has ≥N rejections; auto-expire after N days.
- **Security:** approve/reject/delete are not audit-logged, and updates don't check matched-row count (a silently RLS-blocked update still shows "approved" locally). Copy the rental `.select('id')` pattern.

### 4.3 Users
- **Exists:** search (name/phone/email, in-memory), ban (fixed 30 days) / unban / verify / notify, CSV export.
- **Missing:** pagination beyond 500; status/role/verified filters; **user detail view** (their listings, reports filed/against, businesses, chats, verification history); warning system (strike 1/2/3 before ban); permanent + custom-duration bans; ban expiry automation (`ban_until` is written but nothing in this panel or code unbans on expiry — **Not Verified** if the app enforces it); admin notes on users; login/activity history; trust score; impersonation ("view as user"); account deletion/GDPR export; appeals queue.
- **Security:** bans not audit-logged; no re-auth for bans; nothing prevents banning another admin.
- **Quick wins:** make ban duration selectable (7d / 30d / permanent); add a user drill-down modal aggregating existing tables (listings, reports, businesses already loaded).

### 4.4 Verifications (ID + Company)
- **Exists:** merged queue (verifications table + `verification_pending` profiles), signed R2 URLs for private docs, selfie/ID viewers, approve/reject with reason sent to user, company vs sole-trader doc sets, recent-reviews table.
- **Missing:** reviewer assignment (two admins can review the same item); duplicate-ID fraud detection (same document/selfie across accounts); rejection reason templates; verification expiry/re-verification; SLA timer (time-in-queue); zoom/rotate on doc images; count of prior attempts per user.
- **Security bug (important):** the inline SQL helper shown to the admin creates `CREATE POLICY "Admin reads verifications" ... FOR SELECT USING (true)` — that makes **every authenticated user able to read all verification rows (ID document URLs included)**. If this SQL was ever run, fix the policy to check the admin role. **Not Verified** whether it was applied — flag for a manual check in Supabase.

### 4.5 Send Notification
- **Exists:** segment targeting (all/verified/unverified/sellers/buyers/individual), province filter, type, deep link, image, schedule-later, preview, history (last 30), FCM result breakdown via `send-push` Edge Function.
- **Missing:** reusable templates; drafts; per-campaign delivery/open analytics; scheduled-notification list (you can schedule but not see/cancel scheduled sends — **Not Verified**, may live server-side); frequency capping; quiet-hours guard; audience size preview before send; A/B testing.
- **Note:** segment size for "All Users" displays `DATA.users.length` — wrong past 500 users.

### 4.6 Reports & Support
- **Exists:** support-message vs user-report split, status filters, WhatsApp/email reply deep links, resolve/dismiss with graceful status fallback.
- **Missing vs enterprise:** severity levels (rental reports have them; marketplace ones don't); assignment to a specific admin; internal notes; evidence attachments; investigation timeline; SLA tracking (time-to-first-response / time-to-resolve); escalation rules (N reports on same target → auto-hide listing); linkage actions ("ban reporter-target user", "remove reported listing") directly from the row; repeat-offender aggregation (reports grouped by target).
- **Bug-level detail:** `dismissReport` falls back to marking `resolved` when the DB rejects `dismissed`, but then removes the row from the local list — the UI and DB can disagree until refresh.

### 4.7 Contact Requests (Hire Talent)
- **Exists:** approve/decline with notification to employer, status filters.
- **Missing:** pagination (300 cap); requester history (how many unlocks has this employer had); abuse guard (mass-unlock scraping of candidate contact details is a real privacy risk at scale — add per-employer rate visibility).

### 4.8 Ads & Boosts
- **Exists:** create ad (4 formats, placement, tap action, image compressed to ~60KB base64, schedule dates, price), pause/resume, delete, totals (impressions/clicks/revenue), per-ad CTR.
- **Missing:** approval workflow — ads created by admin go live immediately (`active:true`), and there is no queue for advertiser-submitted ads; auto-expiry when `ends_at` passes (the `active` flag is independent of dates — an expired ad stays "Active" unless the app checks dates; **Not Verified**); budgets/pacing; frequency caps; targeting beyond one category; billing/invoice records (only a manual `price_paid` number); performance-over-time charts; edit ad (must delete + recreate).
- **Scalability:** base64 images in the `paid_ads` row bloat the table and every ad fetch in the app. Move ad creatives to R2 (the rental media path already uses R2 per project convention) and store a URL.

### 4.9 User Chats
- **Exists:** last 600 messages grouped client-side into conversations, thread viewer.
- **Missing:** search; pagination per conversation; keyword/abuse scanning (scam-phrase detection is standard for marketplaces); export for investigations; privacy access control — **any admin can silently read all user messages with no audit log**. At minimum, log chat-view events; ideally gate behind a "reveal" click that records a reason.
- **Scalability:** 600 messages ≈ a few hours of traffic at scale; conversation grouping in the browser stops being meaningful almost immediately. Needs a `conversations`-level query or RPC.

### 4.10 Analytics (marketplace)
- **Exists:** listings by category, by province, new users 7d, verification funnel, ad revenue.
- **Critical flaw:** every chart is computed from the capped arrays. Past 300 listings/500 users the charts are **silently wrong** (they'll show the distribution of the *newest* rows only). This is worse than missing — it misleads decisions.
- **Missing:** DAU/MAU, retention, listing→contact conversion funnel, revenue over time, moderation throughput (approvals/day, median time-to-approve), fraud dashboard, jobs/services/property splits, cross-vertical comparison. The rental analytics module (event-stream based, windowed) is the template.
- **Fix:** move to SQL aggregates (RPCs or views) — e.g. `select category, count(*) from listings group by 1`.

### 4.11 Businesses
- **Exists:** status filters, upgrade-request queue (approve = mark paid + rotate subscription + set plan; decline), plan override modal, verification level cycling (0–3), suspend/activate, delete, detail modal with leads/listings counts.
- **Missing:** subscription **expiry automation** — `current_period_end` is written but nothing downgrades expired subscriptions (needs a pg_cron job or check-on-read); renewal reminders; payment history per business; churn/MRR metrics; employee/branch management; complaint history per business; verification-level meaning is opaque (cycling 0→1→2→3→0 via one button invites mistakes — use an explicit picker).
- **Integrity risk:** `approveBizUpgrade` performs 4 sequential writes (payment → old sub → new sub → business row) with no transaction; a mid-sequence failure leaves inconsistent state. Wrap in a single RPC (`SECURITY DEFINER` function) — this also gives you a server-side audit point.
- `bizSetVerify` and `adminDeleteBusiness` write without `.select('id')` — RLS-blocked writes appear to succeed in the UI.

### 4.12 Rental Admin (Dashboard, Approvals, Companies, Listings, Reports, Reviews, Featured, Analytics, Audit Logs, Lookups)
The strongest section. Remaining gaps against the rental checklist:
- **Fleet monitoring / utilisation / maintenance tracking / document expiry / availability calendar:** none exist. The code is explicit and honest that rentals are inquiry-based with no booking data, so utilisation can't be derived today. If bookings ever land, these become the top rental asks. Vehicle document expiry (insurance, fitness) has no schema support — would need columns; defer until business need is confirmed (rule: don't invent tables prematurely, but this is the one place a small migration is justified).
- **Company performance:** deep view exists (views/inquiries/conversion). Missing: trend over time, response-time to inquiries.
- **Dispute handling:** reports queue covers listings; there is no renter-vs-company dispute object. Reuse `rental_reports` with a `target_type` before inventing a table.
- **Fraud indicators:** review auto-flags exist (spam/abuse/duplicate heuristics). Missing: duplicate-vehicle detection (same photos/plate across companies), price-anomaly flags.
- **Reviews:** flagged queue exists; missing reviewer-history view ("all reviews by this user") — one query away since `reviewer_id` is loaded.
- **Featured:** expiry countdown + performance shown; missing auto-deactivate on expiry (cron) and revenue attribution.
- **Audit logs:** searchable + filterable; missing actor-name resolution (shows truncated UUIDs — join to profiles) and CSV export.
- **Bulk actions:** sequential per-row awaits; fine at 30 rows, batch via `.in('id', ids)` later.

### 4.13 Maintenance
- **Exists:** error-log purge, 30d+ notification purge, conversation-tombstone purge, orphaned-photo scan/purge, activity log.
- **Missing:** dry-run mode for the destructive purges; scheduled automation (all manual — a weekly pg_cron for old notifications removes the chore); R2 orphan scan (only the Supabase `listings-photos` bucket is scanned; rental media lives in R2 and is never cleaned — **Not Verified** whether an R2 cleanup exists elsewhere).

### 4.14 Settings
- **Exists:** 5 platform toggles, FX rate with staleness warning, support WhatsApp number, app info.
- **Missing:** change history (who changed maintenance mode and when); feature flags beyond the 5 toggles; prohibited-words list for listings; province/category management; admin-role management; settings are one shared JSONB row — concurrent admins can clobber each other's saves (last-write-wins on the whole object). Merge server-side via RPC or per-key rows.
- Two toggles' enforcement (`allowNewRegistrations`, `maintenanceMode`) happens app-side — **Not Verified**.

---

## 5. High-Priority Improvements (do first — correctness & security)

1. **Server-side counts and pagination for core modules.** Replace `DATA.*.length`-derived stats (Overview, Analytics, Settings app-info, notification audience counts) with `count:'exact',head:true` queries; add `.range()` paging + server-side `ilike` search to Users and Listings. Without this, the panel reports wrong numbers past trivial scale. The rental code already demonstrates every needed pattern.
2. **Global admin audit log.** Create one `admin_audit_logs` table (mirror of `rental_audit_logs`) and insert on: ban/unban, verify, listing approve/reject/delete, business delete/plan override, ad create/delete, settings change, notification send, chat view. This is the single biggest enterprise gap.
3. **Apply the `.select('id')` matched-rows check to all non-rental writes** (listings, profiles, businesses, ads, reports). Today an RLS-blocked update outside rentals shows a success toast while the DB is unchanged.
4. **Verify the `verifications` RLS policy in Supabase.** If `USING (true)` SELECT was applied from the inline helper SQL, all users can read ID-document paths. Change to an admin-role check. (Manual check — SQL runs are manual per project convention; flag in release notes.)
5. **Fix analytics data sources** (§4.10) — misleading charts are worse than none.
6. **RBAC groundwork:** add `role in ('admin','moderator','support')` semantics — even just hiding destructive buttons for non-full-admins client-side *plus* matching RLS policies server-side. One role for everyone who can delete businesses does not survive a team of 3+.

## 6. Medium-Priority Improvements

- User detail drill-down view (aggregates data already loaded).
- Report assignment, internal notes, and severity for marketplace reports (port the rental severity pattern; `admin_note` column likely needed — reuse rentals' approach of stashing context in the audit log if avoiding migrations).
- Ban improvements: duration picker, permanent option, expiry automation, warning strikes.
- Subscription expiry automation (pg_cron) + `approveBizUpgrade` as a single RPC transaction.
- Ad auto-expiry + move ad images from base64-in-row to R2.
- Bulk actions on marketplace listings (copy `raBulkAction`).
- Marketplace lookups editor (categories/provinces) replacing hardcoded lists.
- Scheduled-notification management list.
- Chat-access audit logging.
- Jobs/Services/Property moderation tabs (clone the Listings tab filtered by vertical — cheapest path if these are rows in `listings` by category; **Not Verified** whether jobs/services have separate tables).

## 7. Low-Priority Improvements

- Table sorting, column pickers, saved filter presets.
- Actor-name resolution + CSV export in rental audit logs.
- Doc image zoom/rotate in verification review.
- Keyboard shortcuts (A=approve, R=reject in queues).
- Fix `dismissReport` local-state divergence and the lookups-table `colspan` off-by-one (cosmetic).
- Debounce search inputs instead of full re-render + focus-restore hack per keystroke.
- De-duplicate the twice-declared Supabase URL/anon key constants.

## 8. Enterprise-Level Recommendations

- **Admin roles & permissions matrix** (owner / moderator / support / finance) enforced by RLS, with a Team page.
- **Unified moderation queue**: one "work queue" view merging pending listings, verifications, reports, and rental approvals, ordered by age/severity — this is how admins at scale actually work (single queue, not 24 tabs).
- **SLA instrumentation**: store `first_actioned_at` on queue items; dashboard of median time-to-decision.
- **Trust & safety scoring**: simple per-user trust score (verified + account age + rejections + reports-against) surfaced everywhere a user appears.
- **RPC layer for compound writes** (plan changes, upgrade approvals, ban+notify) so multi-step operations are atomic and server-audited.
- **Feature flags table** read by the app, managed in Settings.

## 9. Security Recommendations

- MFA (TOTP) for admin accounts — Supabase Auth supports it natively; the login form needs a challenge step.
- Server-side login rate limiting; the current `sessionStorage` lockout resets on a new tab/incognito window.
- Session hygiene: idle timeout + re-auth prompt before destructive actions (business delete, bulk reject, purges).
- **Stop shipping `admin.html` in the mobile app bundles** (`android/.../public/admin.html`, `ios/App/App/public/admin.html`). It's protected only by RLS, but it hands every app user the full admin UI, table names, and expected policies. Serve it from a separate origin (or at least exclude from Capacitor copy).
- Audit logging (§5.2) and chat-view logging (§4.9).
- RLS verification checklist per table — several code comments reference policies that "should" exist (`rvl: admin all`, `FIX_ADMIN_PROFILE_UPDATE.sql`); maintain a canonical list and a read-only verification query, as was done for the rental migrations.
- Failed-action monitoring: the panel already detects 0-row updates in rentals; also *record* them (they are attempted-privilege-escalation signals).
- Avoid string-concatenated IDs into inline `onclick` handlers as a pattern; IDs are UUIDs today so risk is low, but any future non-UUID id becomes an XSS vector. Prefer `data-id` + delegated listeners when convenient.

## 10. Performance & Scalability Recommendations

At **100k users**: Users/Listings tabs and all overview stats break (caps); chats unusable; CSV exports incomplete; notification segment counts wrong. At **1M users / multi-country**: everything above plus the single-JSONB settings row, base64 ad images, and client-side conversation grouping become hard blockers; province lists and currency (hardcoded Zimbabwe provinces, USD/ZiG) need config-driven equivalents.

Preparation without a rebuild:
1. Pagination + server search on every table (the `.range()` pattern exists in `raLoadAllListings`).
2. Counts via `head:true` or a summary RPC/materialised view refreshed by cron.
3. Lazy per-tab loading instead of `loadAllData()` loading 11 datasets at login (rentals already lazy-load; core tabs should too).
4. CSV export via server-side query (RPC returning rows or an Edge Function streaming a file), not the in-memory array.
5. Analytics on `rental_activity_logs`-style event tables with SQL aggregation, never client-side reduction of row dumps.
6. Move heavy media (ad creatives) to R2, matching the rental convention.

## 11. Automation Opportunities

- pg_cron: expire subscriptions past `current_period_end`; deactivate featured/ads past `ends_at`; unban users past `ban_until`; purge 30d+ notifications weekly; refresh dashboard summary view.
- Auto-escalation: ≥3 open reports on one target → auto-hide + high-severity queue entry.
- Auto-approve listings from verified sellers (toggle exists — verify enforcement, then trust it).
- Port the rental review auto-flag heuristics to marketplace reviews/listings descriptions (URL/spam/profanity checks).
- Digest push/email to admins: "N items pending over 24h".

## 12. Operational Improvements (platform ops tooling)

Missing entirely; add as a single "Ops" tab in priority order:
1. **Edge Function health** — last error and invocation counts for `send-push`, `get-r2-upload-url` (Supabase logs API or a heartbeat table).
2. **Cron/job monitoring** — a `job_runs` table each scheduled job writes to; red badge when a job misses its window.
3. **Storage usage** — DB size, bucket sizes, R2 object counts (R2 requires a small Edge Function proxy).
4. **Error-log viewer** — `error_logs` is only purgeable today; make it browsable/filterable first.
5. Maintenance mode + announcements already exist (settings toggle + announcement ad type) — good.

## 13. UI/UX Improvements (no redesign)

- Unified work-queue landing view (§8) with age indicators.
- Persist active tab + filters across reloads (localStorage).
- Show queue-item age ("waiting 2d") on pending listings/verifications.
- Confirmation modals for bulk ops should list affected item names, not just counts.
- Empty states already good; add "last refreshed at" timestamp near the Refresh button.
- Replace the verification-level cycling button with an explicit level picker showing what each level means.

## 14. Final Production Readiness Score

| Dimension | Score /10 | Rationale |
|---|---|---|
| Moderation workflows | 7 | Complete loops for listings/verifications/rentals; missing assignment, SLA, appeals |
| Security & access control | 4 | Single role, no MFA, no core audit trail, admin UI shipped in app bundles |
| Scalability | 3 | In-memory caps break stats and search past ~500 users |
| Analytics & BI | 4 | Rental analytics solid; marketplace analytics misleading at scale |
| Operations tooling | 3 | Maintenance purges only; no function/cron/storage monitoring |
| Coverage of platform verticals | 5 | Marketplace + rentals strong; Jobs/Services/Property/Sales/Reviews absent |
| Code quality & resilience | 8 | Consistent, defensive, migration-tolerant, good patterns to generalise |
| **Overall** | **6.5/10 at current scale · 3/10 at 100k users** | Fix §5 items 1–4 to reach ~8/10 without any redesign |

---

*All findings are based on static analysis of `www/admin.html`. Items marked **Not Verified** require checking live Supabase policies, Edge Functions, or app-side enforcement.*

---
---

# POST-UPGRADE RE-AUDIT (2026-07-04, after the enterprise enhancement)

The enhancement pass (+1,735 / −272 lines, 3,863 → 5,325 lines) implemented the High-Priority, Medium-Priority and Enterprise recommendations above. This section re-audits the result.

## Everything Improved

**Architecture / performance**
- Login now loads only server-side counts + settings (`loadCounts`, ~24 parallel `head:true` count queries). All 11 eager dataset loads at login are gone; every module lazy-loads on first tab open via `TAB_LOADERS`.
- Users and Listings are fully server-paged (50/page), server-searched (`ilike` with input sanitisation) and server-filtered (status, category, province, price range, date window, role, verification state), with exact server totals and Prev/Next pagers. The 500/300-row caps are gone.
- Every badge, Overview stat, KPI, and Analytics chart is computed from server counts/aggregates — no number anywhere is derived from a paged in-memory array any more.
- CSV exports re-query the server (up to 10k rows, filter-aware) instead of dumping the loaded page.
- Analytics rebuilt: per-category and per-province server counts, 7/14/30-day daily growth series for users and listings, verification funnel, subscription + ad revenue, moderation throughput (from the audit trail), report resolution rate — all server-side.

**Security**
- RBAC: five roles (`super_admin, admin, moderator, support, finance`) with a permission map; login/init accept the role set; destructive/managed actions call `requirePerm`. UI enforcement is backed by RLS (see migration notes).
- Unified audit trail: 47 `auditLog` call sites across every module record actor, role, entity, before/after state and reason to `admin_audit_logs` (append-only, admin-team-only RLS). Admin logins, chat views, exports, purges, settings changes, bans, deletions, plan overrides — all recorded.
- Checked writes: 15 `updRow` call sites — every core update now detects RLS-blocked writes (0 rows matched) and errors instead of showing a false success (previously rentals-only).
- Re-authentication (password re-entry) required for: permanent bans, bulk deletes, business deletion, storage purge.
- Warning/strike system, permanent + custom-duration bans, and internal admin notes on users.
- The migration file documents and fixes the world-readable `verifications` SELECT policy flagged in the original audit.

**New modules**
- **Jobs / Services / Property / Vehicle Sales**: per-vertical operations views (server-counted stat cards incl. stale-post detection, paged moderation table, search/filters, approve/reject with seller notification + audit, top posters).
- **Reviews Center**: unified marketplace + rental review moderation with shared spam/abuse/duplicate heuristics, flagged-only queue, reviewer history, delete/publish/hide/remove actions.
- **Audit Center**: one searchable trail across core admin + rental admin — action filter, free-text search, before/after JSON diff viewer, CSV export, pagination.
- **Operations Center**: DB reachability + latency, auth session check, Edge Function health pings (`send-push`, `get-r2-upload-url`) with latency, per-table row counts, browsable client error log, old-notification pressure gauge, audit-trail on/off indicator.

**Module upgrades**
- Overview → executive dashboard: 10 live stat cards, today/7d/30d KPIs with week-over-week trend arrows, 48h SLA-breach alert, oldest-first work queue with inline approve/reject, revenue snapshot, recent admin actions, refresh timestamp.
- Users → drill-down profile (trust score 0–100 from live data, listings, rejections, reports by/against, businesses, verification history, warnings, admin notes) + role column + filters.
- Listings → bulk approve/reject/delete, duplicate-title detection per seller, seller history modal, moderation timeline, price column, queue-age chips.
- Reports → severity levels, take-assignment, internal notes, investigation log, SLA age chips, auto-escalation flag (3+ open reports on one target), ban-target shortcut; `dismissReport` local-state divergence fixed.
- Ads → creatives upload to Cloudflare R2 (base64 only as fallback), expired-ad detection + one-click bulk deactivation, average CTR, audit on create/toggle/delete.
- Notifications → reusable templates (stored in app_settings), server-counted audience preview, prefill fixes for paged users.
- Businesses → renewal/expiry monitoring with overdue-downgrade action, renewal column, explicit verification-level picker (replaces blind cycling), audited plan overrides and upgrades, re-authed deletes.
- Settings → feature-flag manager, merge-safe key-level saves (concurrent admins no longer clobber the settings JSONB), change history viewer.
- Rentals → audit-log actor names resolved, CSV export added. (The rental suite was already the strongest module.)
- UX → `/` focuses the current search box, debounced searching, "waiting Xh/d" age chips on all queues, refresh timestamps, richer empty states with migration guidance.

## Remaining Weaknesses (honest list)
1. **Chats module** still loads the last 600 messages and groups client-side — usable for support spot-checks, not at scale. Needs a conversations-level RPC. Chat views are now at least audited.
2. **RBAC writes** for the new roles require extending each table's RLS policies (starter policies included, commented, in the migration). Until then non-admin roles are read-mostly (writes fail safely with a visible RLS error).
3. **No MFA** on admin accounts (Supabase supports TOTP; needs a challenge step in the login form).
4. `admin.html` is still shipped inside the Android/iOS bundles — excluding it from the Capacitor copy remains recommended.
5. Cron-type automation (auto-unban past `ban_until`, auto-expire ads/subscriptions/featured on schedule) is one-click manual, not scheduled — pg_cron jobs are the next step.
6. Revenue figures sum server-filtered rows client-side (correct up to ~2k payment rows / 1k ads); above that an RPC aggregate is needed.
7. Rental fleet-document expiry (insurance/licence) has no schema support; deferred until the business needs it.
8. Marketplace review moderation is delete-only (the `reviews` table has no status column; adding one is an optional future migration).
9. `approveBizUpgrade` remains 4 sequential writes (no transaction) — an RPC would make it atomic.

## Score Movement

| Dimension | Before | After |
|---|---|---|
| Moderation workflows | 7 | 9 |
| Security & access control | 4 | 7 (8 with migration applied; MFA still missing) |
| Scalability | 3 | 8 |
| Analytics & BI | 4 | 8 |
| Operations tooling | 3 | 7 |
| Vertical coverage | 5 | 8 |
| Code quality & resilience | 8 | 8 |
| **Enterprise readiness** | — | **8/10** |
| **Production readiness** | 6.5 / 3 at scale | **8.5/10 at current scale · 7.5/10 at 100k users** |

## Required / Recommended Migrations
- **`supabase/ADMIN_ENTERPRISE_UPGRADE.sql`** (new, run manually in the SQL Editor):
  1. `admin_audit_logs` table + indexes + admin-team-only RLS (enables Audit Center, notes, timelines, action history). *Everything else works without it; audit features show a clear "run the migration" notice until it runs.*
  2. `reports.severity` + `reports.assigned_to` columns.
  3. Commented starter RLS grants for moderator/support roles.
  4. Commented fix for the world-readable `verifications` SELECT policy — **check this one regardless**.
- No other schema changes. No existing tables altered destructively. Fully idempotent.
