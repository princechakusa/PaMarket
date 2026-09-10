# Stage C2 — Supabase authorization hardening plan

Planning and verification only. No schema change, no migration edit, no Edge Function
change, no deployment, no merge. Nothing in this document has been applied.

- Branch: `feat/admin-stage-b-shell`
- HEAD: `9f53cc60e026d66af58d44fc97c4729f2e2420bb`
- Prepared: 2026-09-10
- Supabase project referenced by Stage C: `gxgytumhknmnwspxjzxw` (config.toml `project_id = "pamarket"`)

---

## 1. Pre-flight status

| Check | Result |
| --- | --- |
| Branch is `feat/admin-stage-b-shell` | PASS |
| HEAD is `9f53cc60…2420bb` | PASS |
| Working tree | Clean. Only `?? .continue/` (untracked, untouched, not staged) |
| `admin/` Stage C files present | PASS — 34 files under `admin/src`, `admin/tests/{security.test.ts,shell.test.tsx,setup.ts}`, docs `architecture.md`, `permissions.md`, `parity-matrix.md`, `audit-plan.md`, `supabase-verification.md` |
| `www/admin.html` unchanged | PASS — identical to HEAD (`git diff HEAD` empty; byte delta vs. blob is CRLF normalization only) |
| No unrelated tracked changes | PASS — `git diff --stat HEAD` empty |
| `.continue/` untouched and uncommitted | PASS — still untracked |
| Live DB mutation performed | NONE. No live connection was made (no client tooling in this environment); Stage C's earlier read-only findings are used as the deployed baseline |

No blockers to proceeding with planning.

---

## 2. Current deployed authorization findings

### Roles and role helpers

- `public.profiles.role` in use: **`user` (97)**, **`admin` (1)**. `super_admin`, `moderator`,
  `support`, `finance` are recognised by code but **no account holds them today**.
- Three inconsistent role predicates are deployed, gating different objects:

  | Helper | Recognises | Defined in (repo) | Notes |
  | --- | --- | --- | --- |
  | `public.is_admin()` | `admin` only | `admin_security_hardening.sql`, `security_hardening_2026_06.sql`, `fix_listings_rls_2026_07.sql`, `fix_profiles_base_table_public_read_conflict.sql`, `business_admin_visibility_2026_06.sql`, `FIX_ADMIN_PROFILE_UPDATE.sql` (re-declared 6×) | Excludes `super_admin` |
  | `public.is_admin_team()` | `super_admin, admin, moderator, support, finance` | `ADMIN_ENTERPRISE_V2.sql`, `FIX_PRIVACY_RLS.sql` | Treats all five equally |
  | `public.is_moderator()` | `admin, moderator` | `moderation_backend_phase_a.sql`, `fix_message_rate_limit.sql` | Excludes `super_admin` — a `super_admin` cannot moderate |

  There is **no hierarchy**: `super_admin` is not a superset of `admin` anywhere in the
  database, and `support`/`finance` are not narrowed anywhere in the database.

### Tables used by admin (from `www/admin.html`)

Direct table reads/writes (RLS-gated), no `functions.invoke`: `profiles`, `listings`,
`reports`, `reviews`, `verifications`, `company_verifications`, `business_verifications`,
`businesses`, `business_subscriptions`, `business_leads`, `business_payments`,
`moderation_actions`, `moderation_appeals`, `user_sanctions`, `contact_requests`,
`support_tickets`, `support_ticket_messages`, `conversations`, `messages`,
`conversation_deletions`, `notifications`, `scheduled_notifications`, `site_announcements`,
`content_pages`, `content_page_versions`, `blog_videos`, `categories`, `cities`,
`provinces`, `app_settings`, `paid_ads`, `featured_slot_packs`, `job_credit_packs`,
`job_runs`, `search_logs`, `error_logs`, `app_error_events`, `admin_audit_logs`,
`admin_sessions`, `admin_login_attempts`, `admin_ip_blocks`, `admin_saved_views`,
`play_purchases`, `play_subscriptions`, `play_recruiter_subscriptions`, all `amos_*`
(integrations, settings, schedule, content_items/drafts/revisions/feedback,
media_assets, metrics_daily, publish_log, publish_audit, market_intelligence,
competitor_watchlist, learning_signals, seo_recommendations, countries), all `rental_*`
(companies, vehicle_listings, vehicle_media, categories, brands, locations,
featured_listings, featured_slot_packs, reports, reviews, activity_logs, audit_logs).

### Admin-related RLS policies

- Predominant pattern on admin/AMOS/support/rental-admin tables:
  `FOR ALL USING (is_admin_team()) WITH CHECK (is_admin_team())` — e.g. `admin_sessions`,
  `admin_login_attempts` (read), `moderation_appeals`, `job_runs`, `search_logs`, and
  every `amos_*` table (`AMOS_MODULE_0_FOUNDATION.sql` and later modules). Any
  admin-team role gets **full read + write**.
- `admin_audit_logs` INSERT policy checks only admin-team membership and accepts
  browser-supplied `actor_id`, `actor_email`, `actor_role`, `ip`, `user_agent`,
  `before_state`, `after_state` (`auditLog()` in `www/admin.html`). No append-only
  protection; admin-team can `UPDATE`/`DELETE`.
- `admin_sessions` `FOR ALL` lets any admin-team role modify any session row;
  "revoke session" is a row edit, **not** a Supabase JWT revocation.
- `profiles` SELECT is "owner or `is_moderator()`" (`harden_profiles_owner_or_staff_read.sql`,
  re-asserted by `fix_profiles_base_table_public_read_conflict.sql` after a confirmed
  2026-07-23 anon full-table read leak). `profiles` UPDATE has an admin policy
  (`is_admin()`) plus a self-update policy (`ADMIN_ENTERPRISE_V2.sql`).

### Table grants for `anon` / `authenticated` / `PUBLIC`

- Reviewed admin tables commonly grant `anon` **and** `authenticated` broad table
  privileges **including `INSERT`/`UPDATE`/`DELETE`**, then rely on RLS to reject rows.
  Wider than least privilege; one policy mistake becomes a data breach.
- `authenticated` retains effective `SELECT`/`UPDATE` on `profiles.mfa_secret` /
  `profiles.two_factor_secret` because the table-level grant overrides the
  column-level `REVOKE` in `admin_mfa_secret_column_lockdown.sql`. `anon` retains
  direct `SELECT` on `two_factor_secret` for any row a policy allows.

### Views accessible to client roles

- `profiles_public` — flagged by the Supabase security advisor as `SECURITY DEFINER`
  (bypasses RLS). Repo has `fix_profiles_public_security_invoker.sql` and
  `fix_profiles_public_security_invoker` / `fix_profiles_base_table_public_read_conflict`
  attempting to correct this; **deployed state not confirmed** — needs live check.

### SECURITY DEFINER functions in exposed schema (`public`)

- **173** `SECURITY DEFINER` functions in `public`.
- **80** executable by `PUBLIC`; **94** executable by `anon` (incl. inherited PUBLIC).
- **38** of the anon-executable ones are ordinary callable RPCs (not trigger functions).
- Advisor explicitly reports the 94 anon-callable definer functions as exposed
  attack surface, plus 3 functions with mutable `search_path`.

### Functions executable by `anon` / `PUBLIC` (known callable RPCs)

- `admin_revenue_summary`, `admin_category_breakdown`, and related cohort/growth
  analytics RPCs — `SECURITY DEFINER`, granted to `PUBLIC`/`anon`. They contain an
  internal `is_admin_team()` guard, so not a data leak **today**, but the anon grant
  is unnecessary.
- `get_my_mfa_secret()` — `SECURITY DEFINER`, anon/public executable; body is scoped
  to `auth.uid()` so an anon caller gets nothing, but the grant is unnecessarily broad.
- Full authoritative list requires the read-only query in §11.

### Functions used directly by current admin (`www/admin.html` `.rpc(...)`)

`admin_create_paid_ad`, `admin_delete_paid_ad`, `admin_set_paid_ad_active`,
`admin_pause_scheduled_paid_ad`, `admin_expire_due_paid_ads`,
`amos_set_integration_credential`, `get_my_mfa_secret`.

- Paid-ad RPCs: granted to `authenticated`, internal `is_admin()` check →
  **excludes `super_admin` and every specialist role**.
- `amos_set_integration_credential(provider, secret_name, secret_value)`:
  `SECURITY DEFINER` into `vault`, internal guard is `is_admin_team()` →
  **any `support`/`finance`/`moderator` account could write integration secrets**,
  contradicting the target rule that `integrations.manage` is `super_admin`-only.

### Functions used by mobile/website that must not be broken

Role helpers `is_admin()`, `is_moderator()`, `is_admin_team()` are referenced by
listings/reports/reviews/profiles/messages RLS that the public website and mobile
app depend on. `get_my_mfa_secret()` is used by `www/admin.html`. Any signature or
semantics change to these three helpers is a cross-surface change.

### Edge Functions used by admin

| Function | `verify_jwt` | Server-side authz | Used by |
| --- | --- | --- | --- |
| `admin-login-guard` | `false` (deploy `--no-verify-jwt`) | `check`/`record`/`whoami` unauthenticated by design; `mutation-check`/`mutation-record` call `getUser` on the Bearer JWT but **do not check `profiles.role`** | `www/admin.html` login + audit IP + destructive-action throttle |
| `admin-sentry-issues` | `true` | `getUser` then **exact** `profile.role === 'admin'` → excludes `super_admin` | `www/admin.html` Error Center |
| `get-r2-upload-url` | `true` | `getUser`; `ads/` + `amos/manual-media/` prefixes require `role === 'admin'`; `verification/` GET requires `role === 'admin'` or own path | `www/admin.html` ad/AMOS media upload + mobile/website uploads |
| `get-cv-url` | `true` | `getUser`; allows `role ∈ {admin, moderator}` or self or job-owner | mobile/website recruiter flow (not admin.html directly) |
| `send-push` | `false` | `x-automation-secret` OR service-role; `target:'admins'` resolves via `profiles.role` | `www/admin.html` announcements + AMOS + login-guard alerts |
| `amos-*` runners/dispatchers (10) | `false` | automation-secret paths + own request checks | `www/admin.html` AMOS panels |

### Edge Functions that verify only JWT but not admin role

- `admin-login-guard` `mutation-check`/`mutation-record` — validates JWT, no role check
  (low impact: it only reads/writes the caller's own throttle rows, keyed by verified UID).
- `get-r2-upload-url` — JWT-only for the user-scoped prefixes (`listings/`, `chat/`,
  `cv/`, `profiles/`, `rentals/`, `verification/<uid>/`, `businesses/<owned>`); this is
  correct for those paths. Admin paths (`ads/`, `amos/`) do check role.

### Edge Functions that accept admin-sensitive input

- `admin-sentry-issues` — proxies arbitrary Sentry `query`/`issueId`; token is a
  server secret. Role-gated.
- `get-r2-upload-url` — issues signed write URLs; server-generates the object key,
  validates prefix + content type + size + rate limit.
- `send-push` — can push to `target:'admins'` / `target:'all'`; secret/service-role
  gated, not caller-role gated.
- `amos-publish-dispatcher`, `amos-media-generator`, `amos-content-generator`,
  `amos-tiktok-oauth-start` — trigger outbound publishing / spend / OAuth; each
  needs endpoint-specific review before the new admin calls it.

### Source ↔ deployed mismatches

- `profiles_guard_privileged` trigger (blocks non-admins from editing `role`,
  `verified`, `status`, `ban_*`, `mfa_secret` on their own row) is defined **only** in
  the manually-run `ADMIN_ENTERPRISE_V2.sql`. Stage C found the deployed `profiles`
  table carrying only timestamp + role-audit triggers — **the guard appears absent
  live**. Combined with the "profiles self update" policy this is a potential
  privilege-escalation path. **Must be verified live before Stage D (§13).**
- `admin_mfa_secret_column_lockdown.sql` claims authenticated secret reads are
  revoked; deployed effective privileges still allow them (table grant wins).
- Only a subset of the repo's admin/security/AMOS migration filenames appear in
  `supabase_migrations.schema_migrations`. Many live objects came from hand-run SQL
  files (`ADMIN_ENTERPRISE_*.sql`, `AMOS_MODULE_*.sql`, `FIX_*.sql`). File presence
  is not proof of deployment; there is no reliable ordered ledger.
- Advisor also flags: 5 RLS-enabled tables with **no policy**, 3 mutable function
  `search_path`, `pg_trgm` installed in `public`, leaked-password protection disabled.

---

## 3. Role counts

| Role | Users | Source |
| --- | ---: | --- |
| `user` | 97 | Stage C read-only check, 2026-09-10 |
| `admin` | 1 | same |
| `super_admin` | 0 | same |
| `moderator` | 0 | same |
| `support` | 0 | same |
| `finance` | 0 | same |

Implication: the specialist-role over-privilege is **latent, not active**. The safest
window to fix role separation is **now, before any specialist account exists**.

---

## 4. High-risk findings (ranked)

| # | Finding | Impact | Live-verify needed |
| --- | --- | --- | --- |
| H1 | `profiles_guard_privileged` trigger appears **absent** on deployed `profiles`, while a self-update policy exists | A normal `user` may be able to `UPDATE` their own `role` to `admin` / set `verified` / clear `ban_*` | **YES — top priority** |
| H2 | Specialist roles are unrestricted server-side (`is_admin_team()` = all five equal; `is_moderator()` = admin+moderator) | The moment a `moderator`/`support`/`finance` profile is created they get full read+write to `admin_audit_logs`, `admin_sessions`, `support_tickets`, every `amos_*` table, `moderation_appeals`, `job_runs`, and can call `amos_set_integration_credential` to write Vault secrets. UI `ROLE_PERMS` is cosmetic. | Partial (confirm policy set) |
| H3 | Legacy MFA secret columns readable/updatable by `authenticated` (table grant overrides column `REVOKE`); `anon` retains `two_factor_secret` select where a row policy allows | A staff account that can read another staff row (`is_moderator()`) can read a raw TOTP seed and mint valid codes → full 2FA bypass | **YES** |
| H4 | No native Supabase MFA; no `aal2` enforced in any RLS policy or Edge Function; "MFA" is client-verified TOTP in `www/admin.html` | Privileged admin actions have no cryptographic second factor at the server | No (confirmed absent) |
| H5 | `admin_audit_logs` is browser-written with client-supplied actor/IP/before/after and no append-only protection | Audit trail is not admissible evidence; an admin-team member can rewrite or delete history | Partial |
| H6 | 38 anon-callable `SECURITY DEFINER` RPCs | Any future internal-guard regression on one becomes anonymously reachable; unnecessary attack surface | **YES — need full list** |
| H7 | `super_admin` is locked out of paid-ad RPCs (`is_admin()`), Sentry proxy (`role==='admin'`), and AMOS media upload | Introducing `super_admin` as the top role breaks admin operations unless helpers are fixed first | No |
| H8 | Broad `anon`/`authenticated` table-level `INSERT`/`UPDATE`/`DELETE` grants on admin tables | RLS is the only thing standing between a logged-in user and admin-table writes | Partial |
| H9 | `admin_sessions` "revoke" is not real JWT/session revocation | Security Center shows a revoked session while the JWT stays valid until expiry | No |
| H10 | Migration ledger is incomplete; objects came from hand-run SQL | Cannot safely reason about "what is deployed" without live introspection; every C2 stage must re-verify against live | n/a |

---

## 5. SECURITY DEFINER function classification summary

The authoritative per-function list (name, `provolatile`, `prosecdef`, `proacl`) must
come from the read-only query in §11 — 173 functions cannot be enumerated from repo
files alone because the ledger is incomplete. The classification **framework** and the
functions already identified:

| Class | Definition | Known members (partial) | First-migration safe? |
| --- | --- | --- | --- |
| **A — anon-required** | Must stay callable by `anon` (public marketplace, pre-auth) | trigger functions fired by anon writes; public listing/search read helpers | Leave as-is |
| **B — authenticated-only** | Logged-in users, not anon | `get_my_mfa_secret()` (currently anon/public — move to `authenticated`) | Yes — low risk |
| **C — admin-only** | Admin-team only, never anon | `admin_revenue_summary`, `admin_category_breakdown`, cohort/growth analytics RPCs (currently `PUBLIC`/`anon`; keep internal guard, drop anon/PUBLIC EXECUTE) | Yes — guard already present, revoke is additive |
| **D — service/server-only** | Only service-role or a trusted Edge Function | anything writing `vault.*`, cron heartbeat writers, cross-user mutation helpers | Needs review — confirm no browser caller first |
| **E — dead/unknown** | No caller found in `www/admin.html`, `apps/mobile`, `www/*.html`, or another function | unknown until the §11 caller sweep is done | No — prove unused first |
| **F — needs deeper review** | Definer + broad grant + non-trivial body | `amos_set_integration_credential` (guard too broad: `is_admin_team()` should be `super_admin`); the 3 mutable-`search_path` functions | No |

### Risky-function detail (known today)

| Function | Current EXECUTE | Definer/Invoker | Used by | Risk | Recommended action | Safe in first migration? |
| --- | --- | --- | --- | --- | --- | --- |
| `amos_set_integration_credential(text,text,text)` | `authenticated` (anon revoked) | DEFINER (into `vault`) | `www/admin.html` | Any specialist role can write integration secrets | Tighten internal guard to `super_admin`; keep `authenticated` EXECUTE | Yes (guard tighten only — but coordinate with H7: `super_admin` must exist first) |
| `admin_revenue_summary()` and cohort/growth analytics RPCs | `PUBLIC` + `anon` | DEFINER | `www/admin.html` | Anon-reachable; guard is the only defence | `REVOKE EXECUTE FROM anon, PUBLIC`; `GRANT` to `authenticated` | Yes |
| `admin_category_breakdown()` | `PUBLIC` + `anon` | DEFINER | `www/admin.html` | as above | as above | Yes |
| `get_my_mfa_secret()` | `authenticated` + `anon`/`PUBLIC` | DEFINER | `www/admin.html` | Low (self-scoped) but broad grant | `REVOKE FROM anon, PUBLIC` | Yes |
| `admin_create_paid_ad` / `admin_delete_paid_ad` / `admin_set_paid_ad_active` / `admin_pause_scheduled_paid_ad` / `admin_expire_due_paid_ads` | `authenticated` | DEFINER | `www/admin.html` | `is_admin()` guard excludes `super_admin` | Migrate guard to a hierarchy helper once one exists (C2B) | No — depends on C2B |
| `is_admin()` / `is_moderator()` / `is_admin_team()` | `authenticated` | DEFINER | website + mobile + admin RLS | Inconsistent; changing them is cross-surface | Add a new `has_admin_privilege(min_role)` helper; migrate callers gradually; do **not** redefine the existing three in one step | No — design in C2B |
| `profiles_public` (view) | client roles | advisor: DEFINER | website profile cards | May bypass RLS on `profiles` | Confirm live; recreate `security_invoker=on` if still DEFINER | Yes if confirmed broken |

---

## 6. Anon / PUBLIC executable function list

- Counts (Stage C): 80 `PUBLIC`-executable, 94 `anon`-executable definer functions;
  38 are callable RPCs, the rest are trigger functions (fine — triggers need the
  privilege to fire on anon writes).
- Confirmed callable + non-trigger + should-not-be-anon: `admin_revenue_summary`,
  `admin_category_breakdown`, related admin cohort/growth analytics RPCs,
  `get_my_mfa_secret`.
- **Action:** run the §11 query to produce the full 38-row list with `proacl`, then
  sweep `www/admin.html`, `www/*.html`, `apps/mobile/**`, and
  `supabase/functions/**` for each name to classify A–F. Only functions with **zero
  legitimate anon caller** and a clear class C/B/D destination go into C2A.

---

## 7. Admin table grant / RLS findings

- **Excessive grants:** admin/AMOS/rental-admin/support tables grant `anon` +
  `authenticated` table-level `SELECT/INSERT/UPDATE/DELETE`; RLS is the sole gate.
- **Anon has unnecessary access:** `anon` should have **no** grant on `admin_*`,
  `amos_*`, `support_tickets`, `moderation_appeals`, `job_runs`, `search_logs`,
  `rental_audit_logs`, `rental_activity_logs`. (Marketplace tables like `listings`,
  `profiles` public-read, `categories`, `provinces`, `cities` must keep anon read.)
- **Authenticated has unnecessary write:** `authenticated` should not hold
  table-level `INSERT/UPDATE/DELETE` on admin-only tables — the admin panel writes
  should flow through role-checked policies on a minimal grant, or (better) through
  definer RPCs / Edge Functions.
- **RLS missing or too broad:** advisor reports 5 RLS-enabled tables with no policy
  (identity TBD via §11). "Too broad" = every `is_admin_team()` `FOR ALL` policy
  listed in §2.
- **Views bypassing RLS:** `profiles_public` (advisor: DEFINER) — confirm live.
- **Unsafe authorization patterns:** `admin_audit_logs` INSERT trusting client
  `actor_*`; `admin_sessions` `FOR ALL` letting any admin-team row edit any session;
  `is_moderator()` used on tables that then hand back **every column** of a matched
  row (this is how a moderator can read a `super_admin`'s `mfa_secret`).
- **Admin-only tables reachable by non-admins:** not today (only 1 `admin` exists),
  but structurally yes for any future `moderator`/`support`/`finance` via
  `is_admin_team()`.

---

## 8. MFA / aal2 findings

- **Native Supabase MFA:** tables exist (`auth.mfa_factors`, challenges, AMR, sessions);
  the one `admin` account has **no verified native factor**. Native MFA is effectively
  unused.
- **`aal2` enforcement:** **none.** No RLS policy references `auth.jwt()->>'aal'`; no
  Edge Function checks assurance level.
- **Current custom MFA is unsafe:** `www/admin.html` verifies a TOTP client-side
  (RFC 6238 in the browser) against `profiles.mfa_secret` fetched via
  `get_my_mfa_secret()`. The secret columns (`mfa_secret`, `two_factor_secret`,
  `two_factor_enabled`, `mfa_enabled`) live on `profiles`; effective `authenticated`
  `SELECT`/`UPDATE` on the secret columns is still open (table grant beats the
  column `REVOKE`), and `is_moderator()`-scoped row reads expose other staff seeds.
  A client-verified factor is not a server-enforced factor.
- **Sensitive admin actions that should require `aal2`:** admin-role changes, MFA-policy
  changes, security-setting changes, integration-credential changes, legal/content
  publish, business-verification decisions, listing deletion, user ban/unban,
  evidence export, bulk export/download.
- **Must be removed or migrated later:** custom browser TOTP verification;
  `get_my_mfa_secret()`; the four legacy `profiles` columns; the "2FA" badge should
  read a boolean, never a seed.
- **Safe migration plan (no lock-out):**
  1. Enrol a **native** TOTP factor for the single existing `admin` while custom TOTP
     still works (belt-and-braces window).
  2. Ship an admin-only Edge/RPC path that reports the caller's `aal` (already exposed
     by Stage C's connection page as read-only).
  3. Add `aal2` checks in **Edge Functions first** (fail-closed, easy rollback by
     redeploy) for the sensitive actions in the list above — warn-only for one
     release, then enforce.
  4. Add `aal2` to RLS only for a small, well-tested set (e.g. `admins.manage`,
     `mfa_policy.manage`, `security.manage`, evidence export) once every admin has a
     native factor.
  5. Only after (1)–(4) are stable: `REVOKE` effective access to the legacy secret
     columns and drop `get_my_mfa_secret()`; keep the generated `mfa_enabled` boolean.
  6. Keep a documented `super_admin` break-glass (native factor reset via Supabase
     dashboard) so a lost device never bricks the platform.
- **No MFA change is made in this stage.**

---

## 9. Role / permission mismatch findings

| Layer | `super_admin` | `admin` | `moderator` | `support` | `finance` |
| --- | --- | --- | --- | --- | --- |
| **Target (`permissions.md`)** | everything | operational catalogue **minus** `integrations.manage`, `security.manage`, `admins.manage`, `mfa_policy.manage`, `audit.export` | listings/verification/moderation/reports/reviews only | users/reports/chats/support only | read-only monetization/ads/billing/revenue |
| **UI (`www/admin.html` `ROLE_PERMS`)** | `['*']` | `['*']` (identical to super_admin) | narrowed set incl. `listings.moderate`, `verifications.manage`, `reports.manage`, `users.warn` | `reports.manage`, `contacts.manage`, `users.view`, `chats.view`, `notifications.send` | `ads.manage`, `businesses.billing`, `analytics.view`, `users.view` |
| **DB RLS** | = `admin` (via `is_admin_team()`); **excluded** by `is_admin()` and `is_moderator()` | full on `is_admin_team()` and `is_admin()` tables | full on every `is_admin_team()` table; full on `is_moderator()` tables | **full on every `is_admin_team()` table** | **full on every `is_admin_team()` table** |
| **Edge Functions** | **rejected** by `admin-sentry-issues`, `get-r2-upload-url` ad/amos paths (both require `role==='admin'`) | accepted everywhere | `get-cv-url` only | none | none |

Mismatch summary:
- **`admin` and `super_admin` are treated identically** in the UI (`['*']`) and in DB
  RLS (`is_admin_team()`), and `super_admin` is *worse off* than `admin` in
  `is_admin()`/`is_moderator()` tables and in three Edge Functions.
- **`support` and `finance` have far too much server access**: `is_admin_team()`
  grants them write to audit logs, sessions, AMOS tables, moderation appeals — none
  of which appears in their target catalogue. Only the UI hides it.
- **`moderator`** server access is also broader than target (all AMOS + audit +
  sessions), narrowed only by the UI.
- **Permissions that need server enforcement** (cannot stay UI hints):
  `admins.manage`, `mfa_policy.manage`, `security.manage`, `integrations.manage`,
  `audit.export`, `legal.publish`, `content.publish`, `taxonomy.publish`,
  `orders.manage`, `listings.moderate` (delete), `verifications.manage`,
  `users.assist` (ban/unban), `ads.manage`, `errors.resolve`, `rentals.moderate`.
- **Permissions that may remain frontend-only hints** (route visibility / menu
  gating, where the underlying read is already RLS-safe): all `*.view` route
  permissions, `dashboard.view`, `analytics.view`, `audit.view` (read of a
  server-owned table already RLS-restricted), `reports.view`, `chats.view`.

**No role or policy change is made in this stage.**

---

## 10. Edge Function hardening findings

| Function | JWT verify | Role check (server) | Permission check | `aal2` where sensitive | Logs outcome | Exposes secret? | CORS | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin-login-guard` | gateway off (by design) | none on `mutation-*` (uses verified UID only) | n/a | no | writes attempt/mutation rows | no (service key server-side) | shared allowlist + `x-automation-secret` | **Needs audit/evidence logging** (login attempts, mutation throttle, honeypot). Role check not required for its current scope. Keep. |
| `admin-sentry-issues` | `true` | `role === 'admin'` (exact) | none | no | no | no (token server-side) | shared + `pamarket.app` extras | **Needs role fix** (accept role hierarchy incl. `super_admin`; ideally an `errors.view` check). Otherwise safe for Stage D. |
| `get-r2-upload-url` | `true` | `role === 'admin'` for `ads/`,`amos/`,`verification/` GET; user-path checks elsewhere | prefix/content-type/size/rate-limit | no | rate-limit ledger only | no (R2 keys server-side) | shared allowlist | **Needs role fix** for admin prefixes (hierarchy); **needs audit logging** for admin uploads. User paths safe. |
| `get-cv-url` | `true` | `role ∈ {admin, moderator}` or self/job-owner | n/a | no | rate-limit ledger only | no | shared allowlist; `pamarket.app` extras unverified | **Safe enough for Stage D** (not called by new admin yet). Consider `audit.export`-style logging when bulk-accessed. |
| `send-push` | gateway off (by design) | secret/service-role only, **not caller role** | n/a | no | per-send result | no | shared + `x-automation-secret` | **Needs role check** if the new admin calls it directly with a user JWT (add `is_admin_team()` on the JWT path); **needs audit logging** for admin-initiated broadcasts. |
| `amos-publish-dispatcher`, `amos-media-generator`, `amos-content-generator`, `amos-research-runner`, `amos-seo-runner`, `amos-analytics-collector`, `amos-competitor-tracker`, `amos-advanced-intelligence`, `amos-tiktok-oauth-start` | gateway off | automation-secret + own checks | varies | no | varies | must confirm none echo Vault creds in errors | shared allowlist | **Needs per-endpoint review** before the new admin calls any: confirm JWT-path role check, `integrations.manage`/`amos.run`/`amos.publish` separation, outcome logging, error redaction, CORS. Treat as **server-only + needs role/permission/audit** until reviewed. |
| `admin-sentry-issues` CORS extras / `get-r2-upload-url` / `get-cv-url` `pamarket.app` origins | — | — | — | — | — | — | `https://pamarket.app` / `www.pamarket.app` kept without a confirmed live caller | **Needs CORS cleanup** — confirm or drop these origins (approval required per Stage 6 note). |

Classification roll-up:
- **Safe enough for Stage D as-is:** `get-cv-url` (unused by new admin), `admin-login-guard` (keep, add logging later).
- **Needs role check:** `send-push` (JWT path), `amos-*` (JWT paths).
- **Needs permission check (beyond role):** `admin-sentry-issues` (`errors.view`),
  `get-r2-upload-url` admin prefixes (`ads.manage` / `amos.run`), `amos-*`
  (`amos.run` vs `amos.publish` vs `integrations.manage`).
- **Needs `aal2` check:** `amos-set-integration-credential` path, any future
  role-change / security-setting / publish / export Edge Function.
- **Needs audit/evidence logging:** `admin-login-guard`, `admin-sentry-issues`,
  `get-r2-upload-url` (admin), `send-push` (admin broadcast), all `amos-*` publish paths.
- **Needs CORS cleanup:** the unverified `pamarket.app` extras on three functions.
- **Should be server-only:** the `amos-*` runners already are (gateway off +
  secret) — keep, don't expose a browser-callable variant.

**No Edge Function is changed or deployed in this stage.**

---

## 11. Audit / legal evidence logging proposal

### Current gaps

- Only `admin_audit_logs` exists; it is browser-inserted with client-controlled
  `actor_*`, `ip`, `user_agent`, `before_state`, `after_state`.
- No append-only guarantee; admin-team `UPDATE`/`DELETE` allowed.
- No record of: login attempts tied to an outcome + real IP in a protected table
  (they land in `admin_login_attempts`, admin-team readable, insert `WITH CHECK (true)`),
  honeypot triggers (honeypot is a UI placeholder only in Stage C), blocked/suspicious
  actions, role changes as first-class events, MFA changes, export/download actions.
- No retention policy, no legal-hold mechanism, no export path with a manifest/checksum.

### Proposed design (server-owned, append-only)

- **New table `public.security_events`** (created in C2D, not now):
  - DB-generated `id uuid default gen_random_uuid()`, `occurred_at timestamptz default now()`.
  - `actor_user_id uuid` (from verified JWT, server-set), `actor_role text` (loaded
    from `profiles` server-side), `actor_aal text check in ('aal1','aal2','unknown')`.
  - `action text not null` (stable name), `target_type text`, `target_id text`.
  - `result text not null check in ('success','failure','blocked','suspicious')`.
  - `request_id text`, `correlation_id text` (client may supply correlation_id only,
    never as identity), `route text`, `action_source text`.
  - `ip inet` (from trusted Edge/proxy boundary only), `user_agent_min text`.
  - `honeypot_triggered boolean` (never the contents), `time_to_submit_ms int`
    (from a server-signed start marker), `rate_limit_rule text`,
    `edge_function text`, `rpc text`, `reason text` (bounded length, secret-pattern
    rejected), `linked_audit_id uuid` (FK-style link to `admin_audit_logs`),
    `error_code text` (redacted).
- **Write path:** a single `SECURITY DEFINER` function `record_security_event(...)`
  callable only by service-role / a JWT-verifying Edge Function — **not** by
  `anon`/`authenticated`. It derives actor + role + aal + ip server-side; the browser
  may pass only `reason`, `route`, `action_source`, `correlation_id`.
- **RLS model:** `ENABLE` + `FORCE` RLS. No `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`
  grant to `anon`/`authenticated`. `SELECT` policy: `role ∈ {admin, super_admin}`
  only — specialist roles get nothing. A `BEFORE UPDATE/DELETE` trigger raises for
  everyone including admin-team (defence in depth; note true immutability is limited
  while DB owners retain access).
- **Retention:** default 24 months from `occurred_at`; a scheduled server job
  deletes/anonymises expired rows and records aggregate deletion counts. Review the
  period with counsel before production; any change is versioned and prospective.
- **Legal hold:** companion table `security_event_legal_holds` (case scope, owner,
  reason, start/review/release dates). The retention job skips rows in an active hold
  scope. Exported case evidence follows the case's retention decision.
- **Export:** `super_admin`-only, via a JWT-verifying Edge Function that reloads
  `profiles.role`, requires `aal2`, records the export as its own `security_events`
  row, applies bounded filters, and returns a checksum-bearing manifest. Browser
  permission `audit.export` is a hint, not the authority.
- **Failure isolation:** customer-facing/public/mobile paths emit best-effort via a
  bounded async outbox with short timeouts and a dead-letter counter — a logging
  failure must never surface to a marketplace user. Sensitive **admin** mutations are
  fail-closed: write the durable evidence/operation record first (same transaction
  where feasible), else return a controlled admin error rather than completing an
  untraceable change.
- **Exclusions (never logged):** passwords, OTP codes, MFA/TOTP secrets, access
  tokens, refresh tokens, cookies, service-role/API keys, `Authorization` headers,
  private signed URLs, payment-card data, honeypot field contents, message bodies,
  support attachments, raw request/response bodies. Provider errors are redacted
  before persistence; `reason` has a length cap and secret-pattern rejection.

### Does this need a migration?

**Yes — one migration in Stage C2D** (new table(s) + `record_security_event` function
+ RLS + triggers + grants). No existing object is altered; `admin_audit_logs` stays as
operational notes until the server-attributed path is live. **Not created in this stage.**

---

## 12. Recommended hardening stages

Ordering principle: verify first, then the changes that are additive + reversible +
invisible to mobile/website/`www/admin.html`, then the structural ones.

### C2-VERIFY — read-only live introspection (do this first, no changes)

- **Goal:** produce the authoritative deployed picture the incomplete ledger denies us.
- **Objects changed:** none.
- **Checks (run against live via Supabase SQL editor or a one-off local script using
  the service-role key — never in the browser, never committed):**
  - `select role, count(*) from public.profiles group by 1;`
  - `select n.nspname, p.proname, p.prosecdef, p.provolatile, p.proacl
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' order by 2;` — full 173-function list + ACLs.
  - `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.prorettype <> 'trigger'::regtype::oid;` — the 38 callable anon RPCs.
  - `select table_name, grantee, privilege_type from information_schema.role_table_grants
     where table_schema='public' and grantee in ('anon','authenticated')
     order by 1,2;` — table grant matrix.
  - `select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies
     where schemaname='public' order by 1,2;` — full policy dump.
  - `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relrowsecurity and not exists
     (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);`
     — the 5 no-policy RLS tables.
  - `select tgname, tgrelid::regclass from pg_trigger where tgrelid='public.profiles'::regclass;`
     — confirm whether `trg_profiles_guard` / `profiles_guard_privileged` exists.
  - `select has_column_privilege('authenticated','public.profiles','mfa_secret','SELECT'),
     has_column_privilege('authenticated','public.profiles','two_factor_secret','SELECT'),
     has_column_privilege('anon','public.profiles','two_factor_secret','SELECT');`
  - `select relname, relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r';`
  - view definitions: `select viewname, definition from pg_views where schemaname='public' and viewname like '%profiles%';`
  - `select * from supabase_migrations.schema_migrations order by version;` — the real ledger.
- **Risk:** none (read-only).
- **Compatibility risk:** none.
- **Tests:** n/a. **Rollback:** n/a.
- **Before Stage D?** **YES — mandatory.** No other C2 stage should start until H1
  (profiles self-escalation) is confirmed or refuted.

### C2A — Function EXECUTE grant lockdown (clearly unsafe public/anon functions)

- **Goal:** remove `anon`/`PUBLIC` EXECUTE from callable definer RPCs that have no
  legitimate anonymous caller.
- **Objects likely changed:** `REVOKE EXECUTE ... FROM anon, PUBLIC` on
  `admin_revenue_summary`, `admin_category_breakdown`, the admin cohort/growth
  analytics RPCs, `get_my_mfa_secret`, plus any C-class function the C2-VERIFY sweep
  confirms has zero anon callers. `GRANT EXECUTE ... TO authenticated` where a
  logged-in caller exists. Trigger functions untouched.
- **Risk:** Low. Additive-restrictive; each function keeps its internal guard.
- **Compatibility risk (mobile/website/admin):** Low — `www/admin.html` calls these
  as an authenticated user; mobile/website have no confirmed anon caller. **Must be
  re-checked per function against the C2-VERIFY caller sweep before including it.**
- **Tests:** for each function — authenticated admin call still returns; anon call
  now returns `permission denied for function`; one mobile smoke path per family.
- **Rollback:** single `GRANT EXECUTE ... TO anon` per function (kept in a paired
  rollback file, matching repo convention).
- **Before Stage D?** **YES** for the confirmed-safe subset (analytics RPCs +
  `get_my_mfa_secret`). The long tail can follow.

### C2B — Profile role protection + admin role separation

- **Goal:** (a) guarantee non-admins cannot edit privileged `profiles` columns;
  (b) introduce a real role hierarchy so `super_admin > admin > specialist` is
  enforced server-side without breaking `www/admin.html`.
- **Objects likely changed:**
  - `profiles`: (re)install `profiles_guard_privileged` trigger **or** an equivalent
    column-privilege design (`REVOKE UPDATE (role, verified, status, ban_reason,
    ban_until, verification_pending) ON public.profiles FROM authenticated` + an
    admin-only definer RPC for staff mutations). Prefer the column-`REVOKE` design —
    it does not depend on a trigger surviving future policy edits.
  - New helper `public.has_admin_privilege(min_role text)` (definer, stable) encoding
    the hierarchy. New `public.is_super_admin()`.
  - Migrate `amos_set_integration_credential` guard `is_admin_team()` → `is_super_admin()`.
  - Leave `is_admin()` / `is_admin_team()` / `is_moderator()` **defined but begin
    migrating callers**; do not redefine them in one step (website + mobile depend on them).
  - Decide + apply: promote the single existing `admin` account → `super_admin`
    (so it keeps paid-ad RPC + Sentry access once those move to the hierarchy helper).
- **Risk:** Medium. Touches `profiles` (used everywhere) and the role model.
- **Compatibility risk:** Medium. `www/admin.html` keeps working **iff** the existing
  account is `super_admin` (or `admin` retains equivalent access) and the three legacy
  helpers keep their current meaning during the transition. No specialist account
  should be created until this stage lands.
- **Tests:** normal `user` cannot `UPDATE` own `role`/`verified`/`ban_*` (expect 0
  rows / raise); existing admin can still verify/ban/promote via the panel; paid-ad
  RPCs still succeed for the (now `super_admin`) account; website login/profile-edit
  and mobile profile-edit regression pass; `amos_set_integration_credential` rejects a
  simulated `finance` JWT.
- **Rollback:** drop the new helpers; restore prior grants/trigger from the paired
  rollback file. Role promotion reversed with a one-line `UPDATE`.
- **Before Stage D?** **YES** — the new admin must not connect to `profiles` writes
  while H1/H2 stand.

### C2C — Native MFA `aal2` enforcement plan and safe rollout

- **Goal:** replace client-verified TOTP with native Supabase MFA and enforce `aal2`
  on the most sensitive actions.
- **Objects likely changed:** no schema change in the first step — Edge Functions
  gain an `aal` check (warn-only, then enforce) for role-change / security / publish /
  export / integration-credential paths. Later: RLS `aal2` predicates on a small set;
  later still, `REVOKE` legacy MFA column access + drop `get_my_mfa_secret()` + drop
  the four legacy columns (keep generated `mfa_enabled`).
- **Risk:** Medium→High at the enforcement step (lock-out risk).
- **Compatibility risk:** Low for mobile/website (they don't use admin MFA); High for
  admin operators if enforced before every admin has a native factor.
- **Tests:** enrol native factor for the existing admin; `aal1` session is warned then
  blocked on a sensitive action; `aal2` session passes; break-glass reset documented
  and rehearsed.
- **Rollback:** redeploy Edge Functions without the `aal` check; keep legacy columns
  until step 5 so the old path is still available.
- **Before Stage D?** Plan yes, **enforcement no** — enforce after the new admin's
  auth flow exists and native enrolment is done. Warn-only checks can ship early.

### C2D — Server-owned audit / evidence logging

- **Goal:** stand up `security_events` (+ legal-hold table + `record_security_event`
  writer + export Edge Function) per §11.
- **Objects likely changed:** **new** objects only — one migration. `admin_audit_logs`
  untouched.
- **Risk:** Low (additive).
- **Compatibility risk:** None for mobile/website/`www/admin.html` (they don't write
  the new table). The new admin writes through the definer path only.
- **Tests:** browser cannot `INSERT`/`UPDATE`/`DELETE` `security_events`; definer
  writer records a row with server-derived actor/ip/aal; specialist role cannot
  `SELECT`; export requires `super_admin` + `aal2` and self-logs; retention job dry-run
  reports counts; legal hold suspends deletion for its scope.
- **Rollback:** `drop table security_events, security_event_legal_holds; drop function
  record_security_event;` (paired rollback file). No data loss elsewhere.
- **Before Stage D?** **YES** — the new admin needs a trustworthy evidence sink before
  it performs any privileged mutation (fail-closed rule in `audit-plan.md`).

### C2E — Edge Function role / permission / audit checks

- **Goal:** every admin-related Edge Function verifies role via the hierarchy helper,
  checks the specific permission where the target model requires it, checks `aal2`
  where sensitive, logs its outcome to `security_events`, and has a clean CORS allowlist.
- **Objects likely changed:** `admin-sentry-issues` (hierarchy + `errors.view`),
  `get-r2-upload-url` (hierarchy for admin prefixes + audit on admin uploads),
  `send-push` (role check on the JWT path + audit on admin broadcasts),
  `admin-login-guard` (emit `security_events` for attempts/mutation-throttle/honeypot),
  each `amos-*` function after its individual review (role/permission split +
  outcome logging + error redaction), CORS extras (`pamarket.app`) confirmed or removed.
- **Risk:** Medium (behaviour change in deployed functions).
- **Compatibility risk:** Medium — `www/admin.html` calls `admin-sentry-issues`,
  `get-r2-upload-url`, `send-push`, and the `amos-*` set; each change must keep the
  existing `admin`/`super_admin` operator working. Mobile uses `get-r2-upload-url`
  (user paths — unchanged) and `get-cv-url` (unchanged). Webhook functions
  (`apple-notifications-webhook`, `play-rtdn-webhook`, `verify-*`, `paynow-*`) are
  **out of scope** — do not touch.
- **Tests:** per function — operator success path; wrong-role rejection; `aal1`
  rejection where enforced; `security_events` row written; CORS preflight from the
  real admin origin passes and an unknown origin is refused.
- **Rollback:** redeploy each function from its pre-C2E source (functions are
  independently deployable).
- **Before Stage D?** Partly — `admin-sentry-issues` role fix and audit emission
  should land before the new admin uses Error Center; `amos-*` reviews gate the AMOS
  panels only.

### C2F — Grants / RLS cleanup

- **Goal:** least-privilege table grants; replace uniform `is_admin_team()` `FOR ALL`
  policies with role/permission-scoped policies; add policies to the 5 bare RLS
  tables; fix `profiles_public` if still DEFINER; move `pg_trgm` out of `public`;
  fix mutable `search_path`; enable leaked-password protection.
- **Objects likely changed:** `REVOKE` `anon`/`authenticated` table DML on `admin_*`,
  `amos_*`, `support_tickets`, `moderation_appeals`, `job_runs`, `search_logs`,
  `rental_audit_logs`, `rental_activity_logs`; rewrite their policies to
  `has_admin_privilege('admin')` / permission-scoped; policies for the 5 bare tables;
  `create or replace view profiles_public ... security_invoker=on`;
  `alter extension pg_trgm set schema extensions`; `alter function ... set search_path`;
  auth config toggle.
- **Risk:** High — this is the broad structural change; touches many tables the panel
  reads/writes.
- **Compatibility risk:** High for `www/admin.html` (every admin table), Low for
  mobile/website (marketplace tables are not in this set, but `profiles_public` and
  `pg_trgm` search are — regression-test search + profile cards).
- **Tests:** full `www/admin.html` click-through per section as `super_admin` and as a
  simulated specialist role (each sees only its catalogue); website search + profile
  cards; mobile smoke. Do this table-family by table-family, not in one migration.
- **Rollback:** paired rollback file per family restoring prior grants + policies.
- **Before Stage D?** **NO** — do this as the new admin migrates each feature, family
  by family, so each change is validated by the feature that depends on it.

### C2G — Verification test suite and rollback rehearsal

- **Goal:** a repeatable authorization test suite (SQL + a scripted set of
  authenticated calls per role) and a rehearsed rollback for every prior stage.
- **Objects likely changed:** none in production — test assets live under
  `admin/tests/` or `supabase/tests/`.
- **Risk:** None.
- **Compatibility risk:** None.
- **Tests:** the suite itself — anon cannot call locked RPCs; each role sees only its
  tables; `aal1` blocked where enforced; `security_events` immutable; export gated.
- **Rollback:** n/a.
- **Before Stage D?** **YES** — the suite must be green before the new admin touches
  production data, and re-run after every subsequent migration.

---

## 13. What must be fixed before Stage D

1. **C2-VERIFY** run in full — especially confirm whether `profiles_guard_privileged`
   is deployed. If a normal `user` can escalate their own `role`, that is a live
   production vulnerability and takes precedence over the whole admin rebuild.
2. **C2B** — profile privileged-column protection (column `REVOKE` + admin RPC), the
   `has_admin_privilege()` hierarchy, `is_super_admin()`, `amos_set_integration_credential`
   guard tightened, existing admin promoted to `super_admin`. No specialist account
   created until this lands.
3. **C2A** (confirmed-safe subset) — revoke `anon`/`PUBLIC` EXECUTE from the admin
   analytics RPCs and `get_my_mfa_secret`.
4. **C2D** — `security_events` table + writer + export path, so the new admin has a
   fail-closed evidence sink before its first privileged mutation.
5. **H3 first step** — `REVOKE` effective `authenticated`/`anon` access to
   `profiles.mfa_secret` / `two_factor_secret` at the table-grant level (the column
   `REVOKE` alone is being defeated by the table grant). This is small and reversible
   and closes a TOTP-seed exposure.
6. **C2E partial** — `admin-sentry-issues` role fix + audit emission before Error
   Center is used from the new admin.

## 14. What can safely wait

- Full triage + lockdown of the long tail of the 38 anon RPCs (after the caller sweep).
- C2C **enforcement** of `aal2` in RLS (plan and warn-only checks can be early;
  enforcement waits for native enrolment of every admin + break-glass rehearsal).
- C2F broad grant/RLS restructure — done family-by-family as each feature migrates,
  not before Stage D.
- `pg_trgm` schema move, mutable `search_path` cosmetic fixes, leaked-password
  protection toggle (do them in C2F).
- `profiles_public` view repair — unless C2-VERIFY shows it is still `SECURITY DEFINER`
  and leaking columns, in which case it moves to §13.
- `admin_sessions` → real JWT/session revocation (needs a Supabase admin API Edge
  Function; design later).
- Retention-job automation and legal-hold tooling polish (table + manual job first).
- Cloudflare Turnstile / Access evaluation (free-tier only; separate track).
- CORS `pamarket.app` extras — confirm or drop in C2E; not urgent.

## 15. What must not be changed

- `www/admin.html` — stays live and untouched until the new admin fully replaces it.
- Mobile app and public website code paths.
- The three legacy role helpers' **current semantics** during C2B — add new helpers,
  migrate callers gradually; do not redefine `is_admin()`/`is_admin_team()`/`is_moderator()`
  in a single migration.
- Webhook / billing Edge Functions: `apple-notifications-webhook`, `play-rtdn-webhook`,
  `verify-apple-purchase`, `verify-apple-subscription`, `verify-play-purchase`,
  `verify-play-subscription`, `paynow-create-payment`, `paynow-check-payment`,
  `apple`/`play` `verify_jwt=false` gateway config, `delete-my-account` /
  `process-account-deletion`, `notify-message`, `notify-application`,
  `dispatch-notification-push`, `automation-runner`.
- The AMOS automation-secret invocation paths (cron + `x-automation-secret`).
- Grants that mobile/website rely on: `listings` public read + owner write,
  `profiles` "owner or staff" read + self-update (benign columns), `push_tokens`
  own-access, `conversations`/`messages` membership policies, `applications`,
  `businesses` owner policies, `categories`/`provinces`/`cities` public read.
- Never put `service_role` in a browser bundle; never expose a server secret via a
  `VITE_` variable or an Edge Function response.
- No migration file already in `supabase/migrations/` is edited — new migrations only,
  each with a paired `*_ROLLBACK.sql` per repo convention.
- `.continue/` — leave untracked and untouched.

## 16. Questions / blockers

1. **DB access for C2-VERIFY.** This environment has no `psql`/`supabase`/`deno`.
   Need either: the service-role key in a local one-off script (git-ignored, deleted
   after), or the queries in §12 run by a human in the Supabase SQL editor and the
   output handed back. Which?
2. **`super_admin` introduction.** Confirm the plan: create `super_admin`, promote the
   one existing `admin` account to it, and make `admin` the "operational minus
   owner-controls" role per `permissions.md`. Yes/no?
3. **`admin` target scope.** `permissions.md` says `admin` excludes
   `integrations.manage`, `security.manage`, `admins.manage`, `mfa_policy.manage`,
   `audit.export`. Confirm that is the intended production contract (it changes what
   `amos_set_integration_credential` and future RPCs must check).
4. **Specialist accounts.** Confirm none will be created until C2B lands (today there
   are zero, which is what makes C2B low-risk).
5. **Custom TOTP users.** Only the one `admin` account, no native factor. Confirm
   no other operator is mid-enrolment before C2C step 1.
6. **`www/admin.html` lifespan.** Roughly how many Stage-D feature migrations before
   `admin.html` is retired? Affects whether C2F can be aggressive or must stay
   backwards-compatible with the legacy panel for months.
7. **CORS `pamarket.app`.** Is `https://pamarket.app` / `www.pamarket.app` a real
   current or planned origin for any Edge Function caller, or safe to drop in C2E?
8. **Retention period.** 24 months is the `audit-plan.md` default — has counsel
   signed off, or is that still open?

## 17. Recommendation for the next implementation prompt

Run **Stage C2-VERIFY** as its own prompt, read-only, no changes:

> Provide read-only Supabase introspection output for project `gxgytumhknmnwspxjzxw`
> using the queries in `admin/docs/c2-hardening-plan.md` §12 (role counts; full
> `pg_proc` definer/ACL list; the 38 non-trigger anon-executable RPCs; the
> `information_schema.role_table_grants` matrix for `anon`/`authenticated`; full
> `pg_policies` dump; the 5 RLS-tables-without-policy list; `pg_trigger` on
> `public.profiles`; `has_column_privilege` for the MFA secret columns;
> `profiles_public` view definition; `supabase_migrations.schema_migrations` ledger).
> Then classify every anon-callable RPC A–F by sweeping `www/admin.html`, `www/*.html`,
> `apps/mobile/**`, and `supabase/functions/**` for each name. Produce
> `admin/docs/c2-verify-results.md`. Confirm or refute finding H1 (profiles
> self-escalation). Make no schema, migration, function, or deployment change.

Only after C2-VERIFY, and only with the §16 decisions made, proceed to **Stage C2A**
(anon/PUBLIC EXECUTE lockdown on the confirmed-safe subset) with its paired rollback
file, then **C2B** design.

**Stop after the plan. No changes are approved by this document.**

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
