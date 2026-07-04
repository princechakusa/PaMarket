# PaMarket Admin — World-Class Operations Platform

**File:** `www/admin.html` (6,395 lines, single-file, Supabase JS v2, no framework)
**Migrations:** `supabase/ADMIN_ENTERPRISE_UPGRADE.sql` (v1) + `supabase/ADMIN_ENTERPRISE_V2.sql` (v2)
**Date:** 2026-07-04

This document describes the third-pass transformation of the admin panel from an enterprise administration system into a full operations platform, in the mould of the internal consoles at Airbnb / Amazon / LinkedIn. It is additive: nothing from the previous passes was removed, and every new capability **feature-detects its backing database object** and degrades to a clear "run the migration" notice rather than breaking.

---

## Design principles held throughout

1. **Nothing loads at login except lightweight counts.** Every module lazy-loads on first tab open. This is what lets the panel stay fast at 1M users / 250k businesses / millions of rows.
2. **Never pull rows to count or sum them.** New heavy aggregation (revenue, category/province distribution, growth, cohorts) is done in Postgres via `SECURITY DEFINER` RPCs (`ADMIN_ENTERPRISE_V2.sql`) and returns small JSON. Where an RPC isn't installed, the panel falls back to a **bounded** client query (≤1,500 rows) and says so.
3. **Every write is RLS-checked** (`updRow` → `.select('id')`), **every action is audited** (`auditLog`), and **destructive/critical actions re-authenticate** (`reauth`).
4. **Feature detection over assumptions.** `hasTable()` / `rpc()` probe once and cache; missing objects produce a migration notice, never a crash.

---

## New shared infrastructure (v2)

| Capability | What it does |
|---|---|
| `rpc(name,args)` | Calls a Postgres aggregation function; returns `{missing:true}` if not installed so callers can show a notice. |
| `hasTable(t)` / `CAP` cache | One-shot probe of an optional table. |
| Global search (press **g** or the topbar Search) | Command-palette overlay searching users, listings, businesses in parallel; jumps straight to the record. |
| Saved views (`admin_saved_views`) | Per-admin, per-module saved filter sets. Wired into Listings and Users; the helper `savedViewsBar` drops into any module. |
| Admin session + device tracking (`admin_sessions`) | A row per login with parsed device; 2-min heartbeat; revoked on logout; listed/revocable in the Security Center. |
| Login-attempt logging (`admin_login_attempts`) | Server-visible success/failure log (brute-force signal) shown in the Security Center. |
| **TOTP two-factor auth** (`profiles.mfa_secret`) | Self-contained RFC 6238 implementation via Web Crypto (HMAC-SHA1) — no external library. QR enrolment, ±30s drift tolerance, required at every login once enabled. |
| Trust / risk / fraud scoring | `computeTrust` (0–100, higher good) and `computeRisk` (0–100, higher bad) from transparent live signals; surfaced in the User CRM and Moderation Inbox. |
| Keyboard shortcuts | `/` focuses the tab search box, `g` opens global search, `Esc` closes overlays. |
| Real-time auto-refresh | Optional 30s dashboard refresh toggle. |

---

## New operations modules

### 1. Executive Command Center (enhanced Overview)
Live command strip with pulsing indicators: **online now** (5-min window), **active today**, **new today**, **SLA breaches**, **pending work**, **support open**. Quick-action launcher, optional 30-second auto-refresh, plus the existing KPI/trend/work-queue/revenue/recent-actions grid. Online metrics use `profiles.last_seen_at` (V2) written by the app.

### 2. Moderation Inbox (unified, risk-ranked)
One queue that merges **pending listings + ID verifications + open reports + pending rental listings + open appeals** into a single list ordered by **risk = severity × age**. Each row has inline approve/reject/resolve/ban actions so moderators never tab-hop. This is the single biggest daily-operations win — it is how moderators at scale actually work (one queue, not fifteen tabs).

### 3. Support Center (`support_tickets` + `support_ticket_messages`)
Full ticket desk: priority (urgent/high/normal/low), status workflow, assignment, **SLA age chips**, threaded customer replies vs **internal notes**, canned **templates**, first-response stamping, resolve-with-**CSAT** request. Legacy support messages in `reports` remain in the Reports tab.

### 4. Finance Center
Revenue streams (subscriptions / advertising / other), **failed & pending payments needing action**, **monthly revenue** bars, **active plan mix**, **top-paying businesses**. Prefers the `admin_revenue_summary` / `admin_top_payers` RPCs; falls back to bounded client aggregation. CSV export.

### 5. Analytics Center (extends Analytics)
Adds an **acquisition/conversion funnel** (registered → engaged → verified → paying), **weekly retention cohorts** (`admin_cohorts` RPC), and **search analytics** (top searches + top zero-result searches = catalogue gaps, from `search_logs`) on top of the existing server-side category/province/growth/verification charts.

### 6. Security Center
Your **MFA** status + enrolment/disable, **active admin sessions** (revocable), **recent login attempts** (success/fail with device), a **role × permission matrix**, and an **RLS verification probe**. Restricted to full admins.

### 7. Automation Center (`job_runs`)
Health of scheduled jobs (unban-expired, expire-ads, expire-subscriptions, purge-notifications) with last-run/status from `job_runs`, **manual runners** for each so you never wait for the schedule, and **auto-moderation rule** toggles stored in `app_settings`. The V2 migration ships commented pg_cron blocks that write to `job_runs`.

### 8. CRM depth
- **User CRM:** `viewUser` now shows trust **and fraud risk** with a reasons line, plus messages-sent and contact-unlock counts and last-active time, alongside the existing listings/businesses/reports/verification/notes history.
- **Business CRM:** `viewBusiness` now loads lifetime revenue, lead→conversion rate, payment history and an audit timeline.

---

## Migrations (both idempotent, additive, manual)

`ADMIN_ENTERPRISE_V2.sql` creates only new objects:
- Tables: `admin_sessions`, `admin_login_attempts`, `support_tickets`, `support_ticket_messages`, `admin_saved_views`, `moderation_appeals`, `job_runs`, `search_logs`.
- Columns: `profiles.last_seen_at`, `profiles.admin_notes`, `profiles.mfa_secret`.
- RPCs (all admin-guarded, `GRANT`ed to anon/authenticated): `admin_revenue_summary`, `admin_category_breakdown`, `admin_province_breakdown`, `admin_daily_growth`, `admin_cohorts`, `admin_top_payers`.
- A reusable `is_admin_team()` guard function.
- Commented pg_cron automation blocks.

**The panel runs fully without either migration.** Each dependent feature shows a one-line "run ADMIN_ENTERPRISE_V2.sql" notice until its object exists. Per the project's manual-migration workflow, run both files by hand in the Supabase SQL Editor.

---

## Scale posture (1M users / 250k businesses / millions of listings-reviews-messages)

- **Counts & aggregates:** server-side (`head:true` counts + RPCs). No module sums rows in the browser except bounded fallbacks (explicitly labelled).
- **Lists:** every table is server-paged (25–50/page) with server-side search/filter.
- **Login:** loads ~28 parallel counts + settings only.
- **Lazy loading:** each module fetches on first open; the dashboard optionally polls.
- **Media:** ad creatives already moved to R2 (previous pass).

Remaining scale caveats (documented, not blocking): the **Chats** viewer still loads recent messages client-side (needs a conversations RPC); revenue fallback path is bounded to ~1,500 rows when the RPC isn't installed; **search analytics** and **online users** require the app to write `search_logs` / `last_seen_at`.

---

## Security posture

MFA (TOTP) available for every admin; server-side login-attempt logging; session tracking + remote revoke; role×permission matrix mirrored by RLS; unified audit trail across all actions; re-auth on MFA-disable, permanent bans, bulk deletes, business deletion, storage purge; RLS probe. The `is_admin_team()` function centralises the team guard for every new table's policies.

Still recommended (unchanged from prior audit): exclude `admin.html` from the mobile app bundles; extend table RLS policies to the non-admin roles you want to grant write access (starter policies are in `ADMIN_ENTERPRISE_UPGRADE.sql`).

---

*Implementation is complete and syntax-verified. Every referenced onclick/oninput handler resolves to a defined function. All new capabilities degrade gracefully when their migration has not yet been applied.*
