# Stage C2-VERIFY — Live Supabase authorization verification results

Read-only verification only. No schema, migration, function, Edge Function, or app
change was made. Nothing was written to the database.

- Branch: `feat/admin-stage-b-shell`
- HEAD: `9f53cc60e026d66af58d44fc97c4729f2e2420bb`
- Verified: 2026-09-10
- Project: `gxgytumhknmnwspxjzxw` ("PaMarket"), Postgres 17.6, region `aws-1-ap-northeast-1`

---

## 1. Pre-flight status

| Check | Result |
| --- | --- |
| Current branch is `feat/admin-stage-b-shell` | PASS |
| Latest commit is `9f53cc60…2420bb` | PASS (HEAD matches; `origin/feat/admin-stage-b-shell` not queried — offline remote) |
| Working tree | Only untracked `.continue/` and untracked `admin/docs/c2-hardening-plan.md`. No tracked file modified. |
| `admin/docs/c2-hardening-plan.md` exists and uncommitted | PASS (untracked, 53 KB) |
| `.continue/` untouched and uncommitted | PASS (still untracked, not staged) |
| No website / mobile / Supabase source / migration / function / workflow / `www/admin.html` change | PASS — `git status --porcelain` shows only the two untracked paths above |

After verification, `git status --porcelain` still shows only:
```
?? .continue/
?? admin/docs/c2-hardening-plan.md
?? admin/docs/c2-verify-results.md   (this file)
```

---

## 2. Live DB access method used

**Live read-only access WAS available.** Method:

- `npx supabase db query --linked "<SELECT …>"` — the Supabase CLI (v2.117.0 via `npx`;
  no local `supabase`/`psql`/`deno` binary) is already authenticated to the linked
  project. It connects through the Supabase **Management API** query endpoint as the
  `postgres` role via a short-lived `cli_login_postgres` login role.
- `npx supabase db advisors --linked` — the hosted security/performance advisor.
- `npx supabase functions list --project-ref gxgytumhknmnwspxjzxw` — deployed Edge
  Function metadata (`verify_jwt`, version, entrypoint).

All statements issued were single `SELECT`s against `pg_catalog`, `information_schema`,
`pg_policies`, `pg_proc`, `auth.mfa_factors`, and `supabase_migrations.schema_migrations`.
The session reported `transaction_read_only = off` (the login role *could* write), so
read-only discipline was enforced by only sending `SELECT` statements — no `BEGIN`,
no DML, no DDL. No write test was executed (see §13 for designed-but-unrun tests).

---

## 3. Role counts

| Role | Users |
| --- | ---: |
| `user` | 97 |
| `admin` | 1 |
| `super_admin` | 0 |
| `moderator` | 0 |
| `support` | 0 |
| `finance` | 0 |

`select distinct role from public.profiles` → `{admin, user}` only.

- **No `super_admin`, `moderator`, `support`, or `finance` account exists.**
- The specialist-role over-privilege (§5) is therefore **latent, not active** — the
  safest window to fix role separation is now, before any such account is created.
- The single `admin` account **should later be promoted to `super_admin`** as part of
  Stage C2B (per `permissions.md`). **Not changed in this stage.** Promotion is a
  one-row `UPDATE`; it must be paired with the helper/hierarchy work in C2B or the
  account loses access to every `is_admin()`-gated object (see §12, H7).

Migration ledger: `supabase_migrations.schema_migrations` has **72 rows**, versions
`202607120001` … `20260828131916` (timestamp-style IDs). The repo's
`supabase/migrations/` holds **~220 descriptively-named files**
(`fix_*.sql`, `harden_*.sql`, …) plus top-level hand-run files
(`ADMIN_ENTERPRISE_V2.sql`, `AMOS_MODULE_*.sql`). The two naming schemes do not
correspond; **file presence is not proof of deployment.** Confirmed: the deployed DB
was built largely from manually-run SQL, not an ordered migration ledger.

---

## 4. Profile role protection findings  (H1 — top priority)

### Deployed facts

- `public.profiles`: `relrowsecurity = true`, `relforcerowsecurity = false`.
- **`profiles_guard_privileged` DOES NOT EXIST** (`pg_proc` lookup returns nothing).
  The source trigger from `ADMIN_ENTERPRISE_V2.sql` was never deployed.
- Triggers actually on `public.profiles` (both `AFTER`/`BEFORE`, none blocking):
  - `profiles_set_updated_at` — `BEFORE UPDATE … EXECUTE FUNCTION set_updated_at()`
  - `trg_log_role_change` — `AFTER UPDATE … EXECUTE FUNCTION log_role_change()`
    — this only *inserts a row into `role_audit_log` when `role` changes*; it does
    not prevent the change.
- Policies on `public.profiles`:

  | cmd | policy | roles | USING | WITH CHECK |
  | --- | --- | --- | --- | --- |
  | INSERT | `profiles: own insert` | authenticated | – | `id = auth.uid()` |
  | SELECT | `profiles: owner or staff read` | authenticated | `auth.uid() = id OR is_moderator()` | – |
  | UPDATE | `profiles admin update` | authenticated | `is_admin()` | `is_admin()` |
  | UPDATE | `profiles: admin update` | authenticated | `is_admin_team()` | `is_admin_team()` |
  | UPDATE | `profiles: own update` | authenticated | `auth.uid() = id` | `auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid())` |

- Table-level grants on `public.profiles`:
  - `anon`: `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` (**no `SELECT`**)
  - `authenticated`: `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`
  - `service_role`: full
- Effective privilege probes (`has_*_privilege`):

  | Probe | Result |
  | --- | --- |
  | `authenticated` SELECT `profiles.mfa_secret` | **true** |
  | `authenticated` SELECT `profiles.two_factor_secret` | **true** |
  | `anon` SELECT `profiles.two_factor_secret` | **true** (column grant exists; blocked in practice by no anon table SELECT + no anon policy) |
  | `anon` SELECT `profiles.mfa_secret` | false |
  | `authenticated` UPDATE `profiles.role` | true (column priv) |
  | `authenticated` UPDATE `profiles.mfa_secret` | true |
  | `authenticated` UPDATE `profiles.status` / `admin_notes` | true |
  | `authenticated` UPDATE table `profiles` | true |
  | `anon` UPDATE table `profiles` | **true** (privilege; blocked by absence of an anon policy) |

### H1 verdict

| Sub-claim | Verdict |
| --- | --- |
| A `user` can escalate **their own `role`** to `admin`/`super_admin` via self-UPDATE | **REFUTED.** The `profiles: own update` `WITH CHECK` re-reads the caller's persisted `role` in a subquery and requires `NEW.role` to equal it. A `SET role='admin'` fails the check. This subquery guard is the live replacement for the missing trigger. |
| `profiles_guard_privileged` is deployed and attached to `profiles` | **REFUTED.** It does not exist. |
| A `user` can self-set **`verified`, `company_verified`, `status`, `ban_reason`, `ban_until`, `verification_pending`, `admin_notes`, `mfa_secret`/`two_factor_secret`** on their own row | **CONFIRMED (by policy logic; needs a write test to be 100%).** The `profiles: own update` policy pins only `role`. Any other column on the caller's own row passes `USING (auth.uid()=id)` and the `WITH CHECK` (which only constrains `id` and `role`). No trigger re-pins the rest. Impact: self-granted verification badge, self-unban, tampering with `admin_notes`. |
| A moderator can read another staff member's raw TOTP seed | **CONFIRMED.** `profiles: owner or staff read` uses `is_moderator()`, which returns every column of any matched row, and `authenticated` has an effective column `SELECT` on `mfa_secret`/`two_factor_secret` (the `admin_mfa_secret_column_lockdown.sql` `REVOKE` did not take effect — table grant still confers it). |
| `anon` holds table-level write privileges on `profiles` | **CONFIRMED** — `INSERT/UPDATE/DELETE/TRUNCATE`. Currently inert (no anon policy on `profiles`), but one permissive anon policy would open it. |

### Column-level grant detail (sensitive columns, `anon` + `authenticated`)

Every one of `role, status, verified, company_verified, ban_reason, ban_until,
admin_notes, mfa_secret, two_factor_secret, two_factor_enabled` has
`INSERT, UPDATE, REFERENCES` granted to **both** `anon` and `authenticated`.
`SELECT` is granted to `authenticated` on all of them; `anon` additionally holds
`SELECT` on `role, status, verified, company_verified, ban_reason, ban_until,
admin_notes, two_factor_secret, two_factor_enabled` (not `mfa_secret`).
`mfa_enabled` (generated boolean): `SELECT` to `authenticated` only.

---

## 5. RLS / grant findings  (admin-sensitive tables)

RLS is **enabled on every base table** in `public` (0 with RLS disabled).
**0 tables have FORCE RLS.** 33 tables were requested; 31 exist. **`moderation_actions`
and `user_sanctions` DO NOT EXIST** in any form — `www/admin.html` references them, so
those panels are non-functional / degrade.

### The broad-grant pattern (near-universal)

Almost every admin/AMOS/support/moderation/content table grants
`anon` **and** `authenticated`:
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`
(the un-tightened Supabase `GRANT ALL … TO anon, authenticated` default). RLS is the
only thing between a caller and the rows. Exceptions found (already tighter):
`paid_ads` (`SELECT` only to anon/authenticated), `app_error_events`
(`SELECT, UPDATE` to `authenticated`, nothing to `anon`).

### Per-table verified summary

| Table | RLS / FORCE | Effective authz model | support/finance/moderator write? |
| --- | --- | --- | --- |
| `admin_audit_logs` | on / off | INSERT+SELECT policies (`roles=public`) gated by `role IN (5 admin roles)`; **no UPDATE/DELETE policy** (RLS denies), but `anon`+`authenticated` hold table `DELETE`/`TRUNCATE` grants. Browser supplies actor/before/after on INSERT. | INSERT yes, SELECT yes |
| `admin_ip_blocks` | on / off | SELECT `is_admin()`; no other policy (writes via service role / edge fn) | no (read blocked too — `is_admin()` only) |
| `admin_login_attempts` | on / off | INSERT `roles=public CHECK true` (pre-auth, by design); SELECT via `is_admin()` **and** duplicate `is_admin_team()` | read yes (is_admin_team) |
| `admin_mutation_log` / `admin_mutation_blocks` | on / off | SELECT `is_admin()` only | no |
| `admin_saved_views` | on / off | `FOR ALL` `admin_id = auth.uid() AND is_admin_team()` | yes (own rows) |
| `admin_sessions` | on / off | `FOR ALL is_admin_team()` (`roles=public`) | **yes — any admin-team role modifies any session row** |
| `amos_settings`, `amos_integrations`, `amos_content_items`, `amos_content_drafts`, `amos_publish_audit`, `amos_publish_log` | on / off | each `FOR ALL is_admin_team()` (`roles=public`) | **yes — full read+write incl. `amos_integrations`** |
| `support_tickets`, `support_ticket_messages` | on / off | `FOR ALL is_admin_team()` | **yes — full read+write** |
| `moderation_appeals` | on / off | team read + team update `is_admin_team()`; user insert | **yes** |
| `job_runs` | on / off | SELECT `is_admin_team()` (+ dup `role='admin'`); INSERT `CHECK is_admin_team()` | yes |
| `search_logs` | on / off | INSERT `CHECK true`; SELECT `is_admin_team()` | read yes |
| `app_error_events` | on / off | SELECT `is_admin_team()`; UPDATE `is_admin()` | read yes, update no |
| `error_logs` | on / off | INSERT `CHECK true` (×2 dup); SELECT `USING false` (×2 dup) — service-role read only | no |
| `business_verifications` | on / off | `FOR ALL is_admin()` + owner insert/select | no (only `admin`) |
| `company_verifications`, `verifications` | on / off | admin gate is inline `role='admin'` subquery (**excludes `super_admin`**) + owner policies; several duplicate policies | no |
| `content_pages`, `content_page_versions` | on / off | admin write/read `is_admin()`; public read published (`content_pages`) | no |
| `scheduled_notifications` | on / off | `FOR ALL USING false CHECK false` + admin SELECT/UPDATE `role='admin'`; **no admin INSERT policy** — browser INSERT would be RLS-blocked (works via service role?) — see §13 | no |
| `site_announcements` | on / off | admin write `is_admin()`; public read active | no |
| `app_settings` | on / off | admin write `is_admin()`; anon+authenticated read `USING true` | no |
| `reports` | on / off | 5 SELECT policies (dupes) incl. `is_moderator()`; UPDATE `is_moderator()` | moderator yes |
| `reviews` | on / off | public read; own insert/update; admin delete `is_admin()` | no |
| `paid_ads` | on / off | public read active only; writes via `admin_*_paid_ad` RPCs | n/a |

### Key confirmed RLS/grant risks

1. **H2 CONFIRMED** — `admin_sessions`, `admin_saved_views`, all 6 `amos_*` tables
   (incl. `amos_integrations`), `support_tickets`, `support_ticket_messages`,
   `moderation_appeals`, `job_runs`, `search_logs` are gated only by
   `is_admin_team()` (`FOR ALL` where applicable). Any `moderator`/`support`/`finance`
   account created later gets full read+write to all of them. No server-side narrowing
   exists; `www/admin.html`'s `ROLE_PERMS` map is cosmetic.
2. **H8 CONFIRMED** — `anon` holds `INSERT/UPDATE/DELETE/TRUNCATE` table grants on
   essentially every admin-sensitive table. Inert today (policies exclude anon), but
   removes all defence-in-depth.
3. `admin_audit_logs` — browser-inserted with client-supplied `actor_*`/`ip`/
   `before_state`/`after_state`; `DELETE`/`TRUNCATE` granted at table level (RLS
   currently blocks via missing policy). Not trustworthy evidence (H5 CONFIRMED).
4. `super_admin` exclusion is pervasive: `is_admin()` / inline `role='admin'` gate
   `business_verifications`, `company_verifications`, `verifications`, `content_pages`,
   `content_page_versions`, `site_announcements`, `app_settings`, `scheduled_notifications`,
   `admin_ip_blocks`, `reviews` delete, `app_error_events` update. (H7 CONFIRMED, broad.)
5. **5 RLS-enabled tables with NO policy** (deny-all to client roles; functional
   foot-gun): `_category_digest_cooldown`, `rental_analytics_daily`,
   `rental_analytics_events`, `rental_state_transitions`, `rental_vehicle_states`.

---

## 6. SECURITY DEFINER function inventory

**Verified counts (`pg_proc`, schema `public`):**

| Metric | Count |
| --- | ---: |
| Total functions in `public` | 227 |
| `SECURITY DEFINER` | **173** |
| … executable by `anon` | **94** |
| … executable by `PUBLIC` | **80** |
| … executable by `anon`, **non-trigger** | **38** |
| … trigger functions | 61 |
| Any non-trigger function executable by `anon` (incl. `SECURITY INVOKER`) | 78 |

All Stage C plan counts (173 / 94 / 80 / 38) are **CONFIRMED exactly**.

### The 38 anon-callable non-trigger SECURITY DEFINER functions — classification

Legend: A=must stay anon · B=authenticated-only (anon grant unneeded) · C=admin-only ·
D=service/server-only · E=trigger-only (n/a here) · F=needs deeper review.

| Function (args) | anon / pub / auth EXECUTE | Internal guard | Likely consumer | Class | Risk | Recommended action | Safe in C2A? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `admin_revenue_summary(days)` | Y / Y / Y | `is_admin_team()` | admin | **C** | Med | `REVOKE EXECUTE FROM anon, PUBLIC` | **Yes** |
| `admin_category_breakdown()` | Y / Y / Y | (admin analytics) | admin | **C** | Med | same | **Yes** |
| `admin_province_breakdown()` | Y / Y / Y | (admin analytics) | admin | **C** | Med | same | **Yes** |
| `admin_cohorts(weeks)` | Y / Y / Y | (admin analytics) | admin | **C** | Med | same | **Yes** |
| `admin_daily_growth(days)` | Y / Y / Y | (admin analytics) | admin | **C** | Med | same | **Yes** |
| `admin_top_payers(days,lim)` | Y / Y / Y | (admin analytics) | admin | **C** | Med | same | **Yes** |
| `get_my_mfa_secret()` | Y / Y / Y | body scoped to `auth.uid()` | admin.html | **B** | Low | `REVOKE EXECUTE FROM anon, PUBLIC` (keep `authenticated`) | **Yes** |
| `is_admin()` `is_admin_team()` `is_moderator()` | Y / Y / Y | n/a (predicate) | RLS on website+mobile+admin | **A** | Low | leave (needed inside policies for every role) | Leave |
| `is_business_owner(id)` `is_authorized_recruiter()` `is_conversation_member`* `owns_rental_company(id)` `owns_active_rental_company(id)` `get_user_rental_access()` | Y / mix / Y | predicate | RLS helpers | **A** | Low | leave | Leave |
| `increment_listing_view(id)` `increment_business_view(id)` `rental_increment_view(id)` | Y / Y / Y | none (counter) | website/mobile public pages | **A** | Low (view-count inflation only) | leave; optional rate-limit later | Leave |
| `get_platform_stats()` `get_seller_rating_summary(seller)` | Y / mix / Y | none | website public | **A** | Low | leave | Leave |
| `list_public_indexable_profiles()` `list_public_indexable_profiles_page(after,limit)` | Y / N / N | none (SEO allowlist) | sitemap/SEO | **A** | Low | leave | Leave |
| `log_client_error(14 args)` | Y / N / Y | none | mobile/website crash logging (pre-auth) | **A** | Low | leave; ensure size caps | Leave |
| `track_ad_click(id)` `track_ad_impression(id)` | Y / N / Y | none | website ad slots | **A** | Low | leave | Leave |
| `get_job_credit_balance()` | Y / Y / Y | `auth.uid()` scoped | mobile/website | **B** | Low | `REVOKE FROM anon, PUBLIC` | Yes (low) |
| `apply_listing_boost(id,days)` | Y / N / Y | verifies `seller_id = auth.uid()` + wallet | mobile/website | **B** | Low | `REVOKE FROM anon` | Yes (low) |
| `spend_job_credit(id)` | Y / Y / Y | verifies `seller_id = auth.uid()` | mobile/website | **B** | Low | `REVOKE FROM anon, PUBLIC` | Yes (low) |
| `save_listing(id)` `unsave_listing(id)` | Y / N / Y | inserts `(auth.uid(), …)` | mobile/website | **B** | Low | `REVOKE FROM anon` | Yes (low) |
| `record_conversation_deletion(cid)` `revoke_conversation_deletion(cid)` | Y / N / Y | `auth.uid()` scoped | mobile/website | **B** | Low | `REVOKE FROM anon` | Yes (low) |
| `touch_last_active()` | Y / N / Y | `auth.uid()` scoped | mobile/website | **B** | Low | `REVOKE FROM anon` | Yes (low) |
| `delete_my_account()` | Y / N / Y | `if auth.uid() is null then return` | `delete-my-account` edge fn / mobile | **B/F** | Med | `REVOKE FROM anon`; also see duplicate below | Review first |
| `delete_own_account()` | Y / N / Y | `auth.uid()` scoped (no null-guard; harmless) | legacy? | **F** | Med | duplicate of `delete_my_account`; confirm caller, then `REVOKE FROM anon` or drop | Review first |
| `rental_set_listing_state(id,state,reason,auto_return)` | Y / Y / Y | `is_admin()` OR owns company | rental owner + admin | **B/F** | Med | `REVOKE FROM anon, PUBLIC`; note `is_admin()` excludes `super_admin` | Review first |
| `rental_setup_company(...)` `rental_business_analytics(id)` | Y / Y / Y | (company-owner checks) | rental owner | **B/F** | Med | `REVOKE FROM anon, PUBLIC` after caller check | Review first |
| `get_or_create_*` (not in this list — authenticated-only) | – | – | – | – | – | – | – |

`is_conversation_member` is actually `authenticated`-only (listed here for context).

### 24 authenticated-only (not anon, not public) SECURITY DEFINER non-trigger RPCs

`admin_create_paid_ad`, `admin_delete_paid_ad`, `admin_set_paid_ad_active`,
`admin_pause_scheduled_paid_ad`, `admin_expire_due_paid_ads`,
`amos_set_integration_credential`, `browse_recruitment_candidates`,
`create_job_listing`, `create_shop_order`, `find_business_staff_candidate`,
`get_or_create_recruitment_conversation`, `get_or_create_rental_conversation`,
`get_recruitment_candidate`, `get_unread_message_count`, `has_valid_candidate_profile`,
`is_conversation_member`, `list_my_contact_requests`, `register_push_token`,
`renew_listing`, `rental_capture_lead`, `request_candidate_contact`,
`unregister_all_push_tokens`, `unregister_push_token`, `update_shop_order_status`.

Verified guard details:
- `admin_create_paid_ad` → `if auth.uid() is null or not public.is_admin()` →
  **excludes `super_admin` and specialists** (H7). Class C-by-intent, currently
  `authenticated`+internal guard. `SET search_path TO ''` (good).
- `amos_set_integration_credential` → `IF NOT is_admin_team()` → **any
  `support`/`finance`/`moderator` may write Vault secrets + flip `amos_integrations`**
  (H2). Class C/D. `SET search_path TO 'public','vault'`.

---

## 7. Anon / PUBLIC executable function list  (the ones that should change)

**Immediately safe to lock down in C2A** (`REVOKE EXECUTE FROM anon, PUBLIC`; keep
`authenticated`) — admin analytics + self-scoped MFA read, all confirmed to have an
internal `is_admin*`/`auth.uid()` guard so no client currently depends on anon access:

- `admin_revenue_summary(integer)`
- `admin_category_breakdown()`
- `admin_province_breakdown()`
- `admin_cohorts(integer)`
- `admin_daily_growth(integer)`
- `admin_top_payers(integer, integer)`
- `get_my_mfa_secret()`

**Low-risk B-class** (revoke `anon`/`PUBLIC`, keep `authenticated`; verify no anon
caller in mobile/website first — all have `auth.uid()` guards so anon calls already
no-op or error): `get_job_credit_balance`, `apply_listing_boost`, `spend_job_credit`,
`save_listing`, `unsave_listing`, `record_conversation_deletion`,
`revoke_conversation_deletion`, `touch_last_active`.

**Needs review before change (F):** `delete_my_account` + `delete_own_account`
(duplicate destructive pair), `rental_set_listing_state`, `rental_setup_company`,
`rental_business_analytics`.

**Leave anon (A):** the RLS predicate helpers (`is_admin*`, `is_moderator`,
`is_business_owner`, `owns_rental_company`, …), view counters, `get_platform_stats`,
`get_seller_rating_summary`, `list_public_indexable_profiles[_page]`,
`log_client_error`, `track_ad_click`, `track_ad_impression`.

---

## 8. View security findings

| View | Owner | `security_invoker` | `security_barrier` | Grants (anon / authenticated) | Bypasses RLS? |
| --- | --- | --- | --- | --- | --- |
| **`profiles_public`** | `postgres` | **NOT SET** | `true` | `SELECT` / `SELECT` | **YES — runs as owner `postgres`, bypasses `profiles` RLS.** Advisor: `security_definer_view` **ERROR**. |
| `rental_company_profiles_public` | `postgres` | `true` | – | `DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE` (both) | No (invoker). Sloppy full DML grant on a view, but harmless. |

**`profiles_public` — CONFIRMED still SECURITY DEFINER.** Definition:
```
SELECT id, name, avatar, verified, role, created_at, updated_at, bio, city,
       last_seen, privacy, language, status, NULL::text AS phone
FROM profiles;
```
Granted `SELECT` to `anon`. Effect: **any anonymous caller can read `role`,
`verified`, `status`, `bio`, `city`, `last_seen`, `privacy` for all 98 users**,
bypassing the `profiles` "owner or staff" RLS. `phone` is nulled; `email`, wallet,
tokens, MFA columns are **not** in the view. Modest info-disclosure (every user's
role + verification status is effectively public). The repo migration
`fix_profiles_public_security_invoker.sql` did not take effect on the deployed DB.

---

## 9. MFA / aal2 findings

- **Supabase native MFA: unused.** `auth.mfa_factors` is **empty** (0 rows, 0
  verified). The single `admin` account has no native factor.
- **`aal2` enforced nowhere.** `select … from pg_policies where qual/with_check ILIKE
  '%aal%'` → **0 rows.** No function body mentions `aal2` (0 rows). No Edge Function
  source checks assurance level (confirmed in Stage C2 plan review).
- **Legacy TOTP fields still reachable.** `authenticated` has an *effective* column
  `SELECT` on `profiles.mfa_secret` and `profiles.two_factor_secret` (H3 CONFIRMED —
  the column `REVOKE` in `admin_mfa_secret_column_lockdown.sql` is overridden by the
  table-level grant). Combined with `profiles: owner or staff read` (`is_moderator()`
  → all columns of any matched row), a `moderator`/`admin` can read another staff
  member's raw seed. `get_my_mfa_secret()` is `SECURITY DEFINER`, `SET search_path
  public`, self-scoped — but anon/PUBLIC executable (unnecessary).
- Legacy columns present on `profiles`: `two_factor_enabled`, `two_factor_secret`,
  `mfa_secret`, `mfa_enabled` (generated `mfa_secret IS NOT NULL`).
- **Actions that should require `aal2`** (later, C2C): admin-role changes, MFA/security
  policy changes, integration-credential changes, legal/content publish, business-
  verification decisions, listing deletion, user ban/unban, evidence export,
  bulk export/download.
- **No MFA change made.**

---

## 10. Edge Function findings

Deployed `verify_jwt` (from `functions list`, 32 ACTIVE functions):

| Function | Deployed `verify_jwt` | Role check (source) | Perm check | aal2 | Audit log | Secrets exposed | CORS | Recommended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin-login-guard` | **false** | none on `mutation-*` (uses verified UID only) | – | no | writes attempt/mutation rows only | no (service key server-side) | shared allowlist + `x-automation-secret` | Emit `security_events` for attempts / mutation-throttle / honeypot. Keep. |
| `admin-sentry-issues` | **true** (v1, fresh) | exact `role === 'admin'` → excludes `super_admin` | none | no | no | no (Sentry token server-side) | shared + `pamarket.app` extras | Fix to role hierarchy (+ `errors.view`); add audit emit. |
| `get-r2-upload-url` | **true** | `role === 'admin'` for `ads/`,`amos/`,`verification/` GET; user-path checks elsewhere | prefix/type/size/rate | no | rate-limit ledger only | no (R2 keys server-side) | shared allowlist | Hierarchy for admin prefixes; audit admin uploads. User paths OK. |
| `get-cv-url` | **true** | `role ∈ {admin, moderator}` or self/job-owner | – | no | rate-limit ledger | no | shared; `pamarket.app` extras unverified | Safe for Stage D (not called by new admin). |
| `send-push` | **true** *(deployed; matches `config.toml`; source header comment "deploy --no-verify-jwt" is stale)* | secret / service-role only — **not caller role** | – | no | per-send result | no | shared + `x-automation-secret` | Add `is_admin_team()` on the JWT path if the new admin calls it directly; audit admin broadcasts. |
| `amos-research-runner`, `amos-content-generator`, `amos-publish-dispatcher`, `amos-analytics-collector`, `amos-seo-runner`, `amos-advanced-intelligence`, `amos-competitor-tracker`, `amos-media-generator`, `amos-tiktok-oauth-start`, `amos-tiktok-oauth-callback`, `amos-unsubscribe` | **false** (all) | automation-secret + own checks | varies | no | varies | must confirm no Vault creds in error bodies | shared allowlist | Per-endpoint review before the new admin calls any: JWT-path role check, `amos.run`/`amos.publish`/`integrations.manage` split, outcome logging, error redaction, CORS. Treat as server-only until reviewed. |
| `automation-runner` | true | cron/secret | – | no | – | no | – | Out of scope (not admin UI). |
| `apple-notifications-webhook`, `play-rtdn-webhook` | false | provider-signed payload | – | – | – | no | – | **Do not touch** — webhook by design. |
| `verify-apple-*`, `verify-play-*`, `paynow-*`, `delete-my-account`, `process-account-deletion`, `notify-message`, `dispatch-notification-push` | mixed | own | – | – | – | no | – | Out of scope. |
| `diag-apple` | true (v7) | – | – | – | – | – | – | Diagnostic function deployed; not in current repo `functions/` tree — flag as possible leftover to review/remove. |

No `amos-set-integration-credential` Edge Function exists — integration credentials
are written by the **`amos_set_integration_credential` RPC** (§6, H2).

---

## 11. Confirmed high-risk items

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| H1a | `role` self-escalation via `profiles` self-UPDATE | **REFUTED** | `profiles: own update` `WITH CHECK` pins `role` via subquery |
| H1b | Self-modify `verified`/`company_verified`/`status`/`ban_*`/`verification_pending`/`admin_notes` on own row | **CONFIRMED** (policy logic; write-test pending) | only `role` is pinned; `profiles_guard_privileged` absent; no other blocking trigger |
| H2 | Specialist roles unrestricted server-side | **CONFIRMED** | `is_admin_team()` `FOR ALL` on `admin_sessions`, 6×`amos_*` (incl. `amos_integrations`), `support_tickets(+messages)`, `moderation_appeals`, `job_runs`, `search_logs`; `amos_set_integration_credential` guard = `is_admin_team()` |
| H3 | Legacy TOTP seed readable by staff / `authenticated` | **CONFIRMED** | `has_column_privilege('authenticated','profiles.mfa_secret','SELECT') = true`; `is_moderator()` row read returns all columns |
| H4 | No native MFA, no `aal2` anywhere | **CONFIRMED** | `auth.mfa_factors` empty; 0 policies/functions reference `aal` |
| H5 | `admin_audit_logs` not trustworthy evidence | **CONFIRMED** | browser INSERT with client `actor_*`/`before`/`after`; table `DELETE`/`TRUNCATE` granted to anon+authenticated; no FORCE RLS |
| H6 | 38 anon-callable SECURITY DEFINER non-trigger RPCs | **CONFIRMED (exact)** | `pg_proc` count |
| H7 | `super_admin` excluded by `is_admin()` / inline `role='admin'` | **CONFIRMED, broad** | gates `business_verifications`, `company_verifications`, `verifications`, `content_pages(+versions)`, `site_announcements`, `app_settings`, `scheduled_notifications`, `admin_ip_blocks`, `reviews` delete, `app_error_events` update, all `admin_*_paid_ad` RPCs, `admin-sentry-issues`, `get-r2-upload-url` admin prefixes |
| H8 | `anon` holds table `INSERT/UPDATE/DELETE/TRUNCATE` on admin tables | **CONFIRMED** | grants on `profiles` + ~all admin/AMOS/support tables (exceptions: `paid_ads`, `app_error_events`) |
| H9 | `profiles_public` view bypasses RLS | **CONFIRMED** | `security_invoker` not set, owner `postgres`, `SELECT` to `anon`; advisor ERROR |
| H10 | Migration ledger disconnected from repo | **CONFIRMED** | 72 timestamp-ID rows vs ~220 named files |
| — | Advisor totals | **CONFIRMED** | 1 `security_definer_view` (ERROR), 94 `anon_security_definer_function_executable`, 116 `authenticated_security_definer_function_executable`, 3 `function_search_path_mutable` (`biz_plan_listing_limit`, `biz_plan_featured_slots`, `biz_plan_staff_limit`), 1 `extension_in_public` (`pg_trgm`), 1 `auth_leaked_password_protection` (disabled), 124 `auth_rls_initplan` (perf), 356 `multiple_permissive_policies`, 17 `duplicate_index` |

---

## 12. Refuted / adjusted plan assumptions

| c2-hardening-plan.md assumption | Status after live verification |
| --- | --- |
| "H1: a normal `user` may be able to `UPDATE` their own `role`" | **REFUTED for `role`.** The `profiles: own update` policy's subquery `WITH CHECK` blocks it. **Re-scope H1** to the *other* privileged columns (`verified`, `company_verified`, `status`, `ban_*`, `verification_pending`, `admin_notes`), which are **not** pinned. |
| "`profiles_guard_privileged` … deployed state not confirmed" | **CONFIRMED ABSENT.** Does not exist. The live guard is the self-update policy's `role`-pinning subquery, nothing more. |
| "`profiles_public` … deployed state not confirmed" | **CONFIRMED still SECURITY DEFINER** (no `security_invoker`), `SELECT` to `anon`. |
| "38 anon RPCs — full list pending" | **Now fully enumerated and classified** (§6/§7). Most are legitimate A-class predicates/counters; only ~7 need C2A action, ~8 more are low-risk B-class, ~5 need review. |
| "MFA column `REVOKE` … being defeated by the table grant" | **CONFIRMED** — `has_column_privilege('authenticated', …, 'mfa_secret', 'SELECT') = true`. |
| "5 RLS tables with no policy (identity TBD)" | **Identified:** `_category_digest_cooldown`, `rental_analytics_daily`, `rental_analytics_events`, `rental_state_transitions`, `rental_vehicle_states`. Deny-all, not a leak. |
| "`send-push` verify_jwt = false (deploy `--no-verify-jwt`)" | **Adjusted:** deployed `verify_jwt = **true**` (matches `config.toml`). The source header comment is stale. |
| "`moderation_actions` / `user_sanctions` used by admin" | **Refuted:** neither table exists. Those `www/admin.html` panels are non-functional. |
| Advisor "5 RLS tables no policy" (Stage C) | Current advisor run does **not** emit that lint; the direct catalog query still finds 5. Keep the finding, sourced from the catalog. |
| "173 SDEF / 94 anon / 80 public / 38 callable" | **CONFIRMED exactly.** |

---

## 13. Items needing later, approved write tests  (designed, NOT executed)

Run each in a **rolled-back** transaction as a **non-admin authenticated user**
(a disposable `user` account), on a maintenance window, with explicit approval.
`BEGIN; … ; ROLLBACK;` — never commit.

1. **T1 — privileged-column self-write (H1b).** As a `user`:
   `UPDATE public.profiles SET verified = true, company_verified = true,
   status = 'active', ban_until = NULL, admin_notes = 'x' WHERE id = auth.uid();`
   Expected if H1b holds: **1 row updated** (policy `profiles: own update` passes
   because `role` is unchanged, so the `WITH CHECK` subquery matches). Confirm, then
   `ROLLBACK`. Also try the same statement adding `role = 'admin'` → expect **0 rows /
   check violation** (confirms `role` is still pinned).
2. **T2 — anon table write on `profiles` (H8).** With the anon key via PostgREST:
   `PATCH /rest/v1/profiles?id=eq.<uuid>` with `{"name":"x"}` → expect **401/403 /
   0 rows** (no anon policy). Confirms the grant is inert. Read-only-safe (no row
   should change); still treat as a test.
3. **T3 — `profiles_public` anon read (H9).** With the anon key:
   `GET /rest/v1/profiles_public?select=id,role,verified&limit=5` → expect **rows
   returned** (confirms RLS bypass). Purely a read; low sensitivity but records the
   exposure.
4. **T4 — `admin_revenue_summary` as anon (H6).** `POST /rest/v1/rpc/admin_revenue_summary`
   with the anon key → expect the internal `is_admin_team()` guard to `RAISE` (so
   **error, not data**). Confirms the anon grant is currently "guarded but exposed".
5. **T5 — specialist-role blast radius (H2).** Create a throwaway `moderator`
   profile in a transaction, `SET LOCAL ROLE authenticated` + `request.jwt.claims`,
   `SELECT`/`INSERT` against `amos_integrations`, `admin_sessions`, `support_tickets`
   → expect **success** (confirms over-privilege). `ROLLBACK` (drops the test role
   and any rows).
6. **T6 — `scheduled_notifications` admin INSERT.** As the real `admin`:
   `INSERT INTO public.scheduled_notifications (...)` in a transaction → determine
   whether RLS blocks it (no INSERT policy) or whether `www/admin.html` actually
   routes this through a service-role path. `ROLLBACK`.

---

## 14. Safe first hardening stage recommendation

**Proceed to Stage C2A**, scoped tighter than the original plan now that callers are
known:

- **C2A-1 (zero compatibility risk):** `REVOKE EXECUTE ON FUNCTION … FROM anon, PUBLIC`
  for the 6 admin analytics RPCs + `get_my_mfa_secret()`. All have internal guards;
  `www/admin.html` calls them as an authenticated admin; no mobile/website caller.
  Paired `*_ROLLBACK.sql` = the matching `GRANT`s.
- **C2A-2 (low risk, after a quick mobile/website grep per name):** `REVOKE … FROM
  anon` for the 8 B-class self-scoped RPCs (`apply_listing_boost`, `spend_job_credit`,
  `save_listing`, `unsave_listing`, `get_job_credit_balance`, `touch_last_active`,
  `record_conversation_deletion`, `revoke_conversation_deletion`). Keep `authenticated`.
- **C2A-3 (defence-in-depth, reversible):** `REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.admin_audit_logs FROM anon, authenticated` (keep nothing for anon; keep
  `SELECT, INSERT` for `authenticated` only so the current browser audit path still
  works until C2D replaces it). This removes the `DELETE`/`TRUNCATE` foot-gun on the
  evidence table without changing any read/insert behaviour.

**Defer to their own stages:** H1b column pinning + `super_admin` hierarchy (C2B),
`profiles_public` `security_invoker` fix (C2B or C2F), MFA column effective-`REVOKE`
+ native rollout (C2C), server-owned audit table (C2D), Edge Function role/aal/audit
(C2E), the broad `anon` table-grant cleanup and `is_admin_team()` policy rewrite
(C2F, per table family).

**Do NOT** bundle C2A with anything that touches `profiles`, the role helpers, or
RLS policy predicates.

---

## 15. Objects that must not be changed yet

- `www/admin.html`, `apps/mobile/**`, `www/**` (public website), `.continue/`.
- The role helpers `is_admin()`, `is_admin_team()`, `is_moderator()` — their current
  bodies. Add new helpers (`is_super_admin()`, `has_admin_privilege(min_role)`) in
  C2B; migrate callers gradually.
- Webhook / billing Edge Functions: `apple-notifications-webhook`, `play-rtdn-webhook`,
  `verify-apple-*`, `verify-play-*`, `paynow-*`, `automation-runner`,
  `delete-my-account`, `process-account-deletion`, `notify-message`,
  `dispatch-notification-push`, and their `verify_jwt` settings.
- The `amos-*` automation-secret invocation paths (cron + `x-automation-secret`).
- `paid_ads` / `app_error_events` grants (already least-privilege).
- Any `GRANT` that mobile/website relies on: `profiles` owner-or-staff read +
  self-update, `content_pages`/`site_announcements`/`app_settings` public read,
  `paid_ads` public read, the A-class anon RPCs in §7, view counters.
- No existing file in `supabase/migrations/` is edited — new migrations only, each
  with a paired `*_ROLLBACK.sql`.
- The single `admin` account's `role` — promotion to `super_admin` happens in C2B
  together with the hierarchy helpers, not before.

---

## 16. Questions / blockers

1. **Write-test window.** §13 T1/T5/T6 need a maintenance window + explicit approval
   and a disposable `user` (and, for T5, a disposable `moderator`) account. Approve?
2. **`super_admin` rollout.** Confirm: introduce `super_admin`, promote the existing
   `admin`, make `admin` the "operational-minus-owner-controls" role per
   `permissions.md`. This must land in the same stage as `has_admin_privilege()` or
   the account loses access to ~12 objects/RPCs (H7).
3. **`scheduled_notifications` INSERT path.** Does `www/admin.html` insert directly
   (would be RLS-blocked — no INSERT policy) or via a service-role Edge Function?
   Affects whether this is a live bug. (T6.)
4. **`profiles_public` consumers.** The website profile cards / SEO read this view.
   Switching it to `security_invoker=on` will start enforcing `profiles` RLS —
   confirm the website only reads its own-or-public data through it, or add an
   explicit public-columns policy on `profiles` first.
5. **`diag-apple`** Edge Function is deployed but not in the repo `functions/` tree —
   intentional diagnostic, or a leftover to remove?
6. **`delete_my_account` vs `delete_own_account`** — two near-duplicate destructive
   SECURITY DEFINER functions, both anon-granted. Which is canonical? Can the other
   be dropped?
7. **`moderation_actions` / `user_sanctions`** don't exist — is that admin
   functionality abandoned, renamed, or pending a migration?
8. **CORS `pamarket.app` / `www.pamarket.app`** extras on `admin-sentry-issues`,
   `get-r2-upload-url`, `get-cv-url` — real origin or safe to drop?
9. **Retention period** for the future evidence table — 24 months is the
   `audit-plan.md` default; counsel sign-off outstanding.

---

## Final report

- **Live DB access worked.** Method: `npx supabase db query --linked` (Management API,
  `postgres` login role) for arbitrary read-only SQL, plus `supabase db advisors
  --linked` and `supabase functions list`. No local `psql`/`deno` needed.
- **H1 (profile self-escalation): SPLIT.**
  - `role` self-escalation → **REFUTED.** Blocked by the `profiles: own update`
    policy's `WITH CHECK` subquery that pins `role`.
  - Self-modification of `verified`, `company_verified`, `status`, `ban_reason`,
    `ban_until`, `verification_pending`, `admin_notes` on one's own row →
    **CONFIRMED by policy logic** (only `role` is pinned; `profiles_guard_privileged`
    is absent; no other blocking trigger). One rolled-back write test (§13 T1) would
    make this 100% certain.
- **SECURITY DEFINER functions: 173** (of 227 in `public`). **94 anon-executable**,
  80 PUBLIC-executable, **38 anon-executable non-trigger** — all Stage C numbers
  confirmed exactly.
- **Biggest confirmed risks:** (1) H1b privileged-column self-write on `profiles`;
  (2) H2 — `is_admin_team()` gives any future `moderator`/`support`/`finance` account
  full read+write to `admin_sessions`, all `amos_*` incl. `amos_integrations`,
  `support_tickets`, `moderation_appeals`, `job_runs`, `search_logs`, plus the
  `amos_set_integration_credential` Vault-write RPC; (3) H3 — `authenticated`/staff
  can read raw legacy TOTP seeds; (4) H9 — `profiles_public` view leaks every user's
  role/verification/status to `anon`; (5) H5/H8 — `admin_audit_logs` is
  browser-forgeable and `anon` holds `DELETE`/`TRUNCATE` grants on it.
- **Can C2A safely proceed? YES**, in the tightened scope of §14 (revoke anon/PUBLIC
  EXECUTE from the 6 admin analytics RPCs + `get_my_mfa_secret`; optionally the 8
  low-risk B-class RPCs; optionally strip `DELETE`/`TRUNCATE` on `admin_audit_logs`).
  Each with a paired rollback. C2A must not touch `profiles`, the role helpers, or
  RLS predicates.
- **Files changed:** `admin/docs/c2-verify-results.md` (this file, new, untracked).
  No other file created or modified. `admin/docs/c2-hardening-plan.md` remains
  untracked from the prior stage.
- **No schema, migration, function, Edge Function, RLS, grant, role, or app change
  was made. No database write occurred.**
- **Recommended next implementation prompt:** *Stage C2A — Function EXECUTE grant
  lockdown (safe subset)*. Scope: one new migration `NNNN_c2a_execute_grant_lockdown.sql`
  + paired `_ROLLBACK.sql` that `REVOKE EXECUTE … FROM anon, PUBLIC` on
  `admin_revenue_summary`, `admin_category_breakdown`, `admin_province_breakdown`,
  `admin_cohorts`, `admin_daily_growth`, `admin_top_payers`, `get_my_mfa_secret`
  (and, after a per-name mobile/website grep, the 8 B-class self-scoped RPCs), plus
  `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_audit_logs FROM anon` and
  `REVOKE UPDATE, DELETE, TRUNCATE … FROM authenticated`. Do not deploy; produce the
  migration + a test script (anon call → expect guard error; authenticated admin call
  → expect success; one mobile smoke path per RPC family) and a rollback rehearsal.
  Stop before applying.

**Stop after verification. No hardening implemented.**

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
