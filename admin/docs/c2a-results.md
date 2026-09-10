# Stage C2A — Admin RPC EXECUTE grant lockdown: results

Applied to the linked live project `gxgytumhknmnwspxjzxw` on 2026-09-10.

Scope: revoke direct `anon` / `PUBLIC` EXECUTE from 7 admin-only SECURITY DEFINER
RPCs. Nothing else changed — no function body, signature, `search_path`, RLS policy,
table grant, role helper, Edge Function, MFA setting, or app code.

## Migration

| Item | Value |
| --- | --- |
| Forward | `supabase/migrations/20260910120000_lock_down_admin_rpc_execute_grants.sql` |
| Rollback | `supabase/migrations/20260910120000_lock_down_admin_rpc_execute_grants_ROLLBACK.sql` |
| Applied via | `npx supabase db query --linked -f <forward file>` (Management API, `postgres` login role) — consistent with this repo's hand-run SQL convention; **not** recorded in `supabase_migrations.schema_migrations` (that ledger is known-incomplete — see `c2-verify-results.md` §3). Do not run `supabase db push` against this project without reconciling the ledger first. |
| Apply result | Success. Pre-check passed (all 7 functions present with expected signatures); `COMMIT` completed; no error. |

## Functions changed (exact identity signatures)

| # | Function | Return | SECURITY DEFINER | Internal guard (unchanged) |
| --- | --- | --- | --- | --- |
| 1 | `public.admin_revenue_summary(integer)` | `jsonb` | yes | `IF NOT is_admin_team() THEN RAISE` |
| 2 | `public.admin_category_breakdown()` | `record` | yes | admin analytics guard |
| 3 | `public.admin_province_breakdown()` | `record` | yes | admin analytics guard |
| 4 | `public.admin_daily_growth(integer)` | `record` | yes | admin analytics guard |
| 5 | `public.admin_cohorts(integer)` | `record` | yes | admin analytics guard |
| 6 | `public.admin_top_payers(integer, integer)` | `record` | yes | admin analytics guard |
| 7 | `public.get_my_mfa_secret()` | `text` | yes | body is `select mfa_secret from profiles where id = auth.uid()` (row-scoped) |

No overloads exist for any of the 7 (verified live: exactly one `pg_proc` row per name).

## Grants — before → after

Before (all 7, identical), from C2-VERIFY live introspection:

```
proacl: =X/postgres ; postgres=X/postgres ; anon=X/postgres ; authenticated=X/postgres ; service_role=X/postgres
anon EXECUTE=true   PUBLIC EXECUTE=true   authenticated EXECUTE=true   service_role EXECUTE=true
```

After (all 7, identical), from post-apply verification:

```
proacl: postgres=X/postgres ; authenticated=X/postgres ; service_role=X/postgres
anon EXECUTE=false  PUBLIC EXECUTE=false  authenticated EXECUTE=true   service_role EXECUTE=true
```

`postgres` / function owner retains EXECUTE implicitly (unchanged).

## Post-apply verification (read-only)

| Check | Result |
| --- | --- |
| `anon` EXECUTE on all 7 | **false** (was true) |
| `PUBLIC` EXECUTE on all 7 | **false** (was true) |
| `authenticated` EXECUTE on all 7 | **true** (retained) |
| `service_role` EXECUTE on all 7 | **true** (retained) |
| `prosecdef` on all 7 | **true** (unchanged) |
| Return types | unchanged (`jsonb` / `record` / `text`) |
| Overload accidentally missed | none — 7 names, 7 rows |
| Function still exists / body intact | yes — positive execution test below |

Post-apply body fingerprints (`md5(pg_get_functiondef())`), for future drift detection:

```
admin_category_breakdown()            fb5fa743a6bf7d1d775159e60cb2c013
admin_cohorts(weeks integer)          3ffc67367a82aeeb3b8113b36eecfa3c
admin_daily_growth(days integer)      62834ccb70241487a16e343eff4b1266
admin_province_breakdown()            4ffd86b2d78287933d36d0daff3686be
admin_revenue_summary(days integer)   2c3d8816c399f16fa3ead2580acf1746
admin_top_payers(days integer, lim)   cd72fa14384c6cbad974959581563533
get_my_mfa_secret()                   a5f23652603cd15c04822c65ee9f2e4b
```

Positive execution tests (as `postgres`, `auth.uid()` = NULL):
- `select public.admin_revenue_summary(30)` → `ERROR P0001: not authorized` raised at
  the function's own `line 4` guard — proves the function exists, its body is intact,
  and the `is_admin_team()` guard still fires.
- `select public.get_my_mfa_secret()` → returns `NULL` (no row for a null uid) —
  proves it is still executable and row-scoped.

An authenticated admin session (`auth.uid()` set, role in the admin team) passes those
same guards exactly as before, because `authenticated` retains EXECUTE.

## Supabase advisor / lint — delta vs C2-VERIFY baseline

| Advisor finding | Before | After |
| --- | ---: | ---: |
| `anon_security_definer_function_executable` (WARN) | 94 | **87** (−7 — exactly the C2A subset) |
| `security_definer_view` (ERROR) | 1 | 1 |
| `authenticated_security_definer_function_executable` (WARN) | 116 | 116 |
| `auth_leaked_password_protection` (WARN) | 1 | 1 |
| `function_search_path_mutable` (WARN) | 3 | 3 |
| `extension_in_public` (WARN) | 1 | 1 |
| `auth_rls_initplan` (WARN) | 124 | 124 |
| `multiple_permissive_policies` (WARN) | 356 | 356 |
| `duplicate_index` (WARN) | 17 | 17 |

**No new advisor issues.** The only change is the intended −7 on the anon
SECURITY-DEFINER-function count. None of the 7 targets appears in the anon list any more.

## Compatibility checks

| Check | Result |
| --- | --- |
| Only caller in repo | `www/admin.html` (lines ~1575, 6152, 9003, 9004, 9491) — via `sb.rpc(...)` / the `rpc()` helper, which always uses the authenticated admin Supabase client, reached only **after** the role gate at line ~1568. `authenticated` retains EXECUTE → unaffected. |
| Mobile app (`apps/mobile/**`) | **0 references** to any of the 7 RPC names (grep). Unchanged, not touched. |
| Public website (`www/*.html` except `admin.html`) | **0 references**. Unchanged, not touched. |
| Edge Functions (`supabase/functions/**`) | **0 references**. None depends on anon execution of these RPCs. Nothing changed or deployed. |
| Authenticated admin path | Verified by grants (`authenticated` EXECUTE = true) + unchanged internal guards + positive execution test. No live admin JWT was available in this environment for an end-to-end call; not required given the above. |

## Confirmations

- `www/admin.html` — **unchanged** (`git status` clean for the path; no diff vs HEAD).
- Mobile app and public website — **unchanged** (no files touched; grep clean).
- Edge Functions — **none changed, none deployed.**
- No schema / table / RLS policy / function body / role helper / MFA change.
- Database writes made: **only** the 14 `REVOKE` + 28 `GRANT` statements on the 7
  functions' EXECUTE privilege, plus one `NOTIFY pgrst`.

## Remaining risks (out of scope for C2A — tracked in c2-hardening-plan.md)

- H1b — a `user` can still self-set `verified` / `company_verified` / `status` /
  `ban_*` / `admin_notes` on their own `profiles` row (only `role` is pinned;
  `profiles_guard_privileged` absent). → **C2B**.
- H2 — `is_admin_team()` still gives any future `moderator`/`support`/`finance`
  account full read+write to `admin_sessions`, all `amos_*` (incl. `amos_integrations`),
  `support_tickets`, `moderation_appeals`, `job_runs`, `search_logs`, and the
  `amos_set_integration_credential` Vault-write RPC. → **C2B / C2F**.
- H3 — `authenticated`/staff can still read legacy TOTP seed columns
  (`mfa_secret`, `two_factor_secret`); no native MFA; no `aal2` anywhere. → **C2C**.
- H5/H8 — `admin_audit_logs` browser-forgeable; `anon` still holds
  `INSERT/UPDATE/DELETE/TRUNCATE` table grants on it and most admin tables. → **C2D / C2F**.
- H7 — `super_admin` still excluded by `is_admin()` / inline `role='admin'` across
  ~12 objects and the `admin_*_paid_ad` RPCs. → **C2B**.
- H9 — `profiles_public` view still `SECURITY DEFINER` (no `security_invoker`),
  `SELECT` to `anon` → every user's role/verification/status readable anonymously.
  → **C2B / C2F**.
- The 31 remaining anon-callable non-trigger SECURITY DEFINER functions not in the
  C2A subset — the ~8 low-risk B-class self-scoped RPCs and ~5 F-class
  (`delete_my_account`/`delete_own_account` dup, `rental_set_listing_state`,
  `rental_setup_company`, `rental_business_analytics`) still need per-name caller
  review before a follow-up EXECUTE lockdown.
- `admin_revenue_summary` / `admin_cohorts` etc. keep `SET search_path TO 'public'`
  (not `''`); the 3 advisor-flagged mutable-search_path functions
  (`biz_plan_*`) are untouched. → later cleanup stage.

## Recommendation for the next stage

**Stage C2B — Profile privileged-column protection + `super_admin` role separation.**
Highest-value remaining item: it closes H1b (self-granted verification / self-unban),
introduces `is_super_admin()` / `has_admin_privilege(min_role)` so `super_admin > admin
> specialist` is enforced server-side, tightens `amos_set_integration_credential` to
`super_admin`, and promotes the single existing `admin` account to `super_admin` in the
same change so nothing loses access. Must ship as one migration + paired rollback, must
not create any specialist account, and must keep `www/admin.html` working (it does, as
long as `admin`/`super_admin` retain full access). A rolled-back write test (T1 / T5
from `c2-verify-results.md` §13) should confirm the H1b fix and the specialist blast
radius before and after.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
