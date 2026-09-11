# Stage C2B-FIX — Restore `super_admin` legacy gate compatibility

- Branch: `feat/admin-stage-b-shell`
- Starting local and remote HEAD: `3a2a23c37bf7b7eaac3033690c84bb4719caa8f5`
- Supabase project: `gxgytumhknmnwspxjzxw`
- Applied: 2026-09-11
- Deployed migration ledger: `20260911184603_restore_super_admin_legacy_admin_gates`

This emergency compatibility fix is complete. It is not C2C, C2F, or a React admin feature migration.

## Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260911184603_restore_super_admin_legacy_admin_gates.sql` | Applied forward migration |
| `supabase/migrations/20260911184603_restore_super_admin_legacy_admin_gates_ROLLBACK.sql` | Paired rollback, rehearsed inside a rolled-back transaction |
| `supabase/tests/c2b_fix_super_admin_legacy_gates.test.sql` | Fifteen live assertions, all transactionally rolled back |
| `admin/docs/c2b-fix-results.md` | Scope and evidence |

No other repository file was changed. The legacy admin, website, mobile app, existing migrations, Edge Functions, workflows, and root build files were not edited.

## Live inspection before the fix

The deployed helper definitions were:

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  );
$$;
```

Both excluded the newly promoted `super_admin`. Live dependency inspection found 66 RLS policies using `is_admin()` and five using `is_moderator()`. Updating the helpers restores the large existing policy surface without rewriting it.

Fourteen policies still contained direct `role = 'admin'` checks. Seven were active blockers for core legacy verification or notification workflows and were included. The other seven were redundant with a permissive helper/team policy or belonged to long-tail business/payment/job/report cleanup and remain scheduled for C2F.

The existing C2B controls were confirmed before apply: one real `super_admin`, the privileged-profile trigger present, and `amos_set_integration_credential` guarded by `is_super_admin()`.

## Applied helper definitions

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'moderator')
  );
$$;
```

Both remain `STABLE SECURITY DEFINER`, now use an empty fixed search path, and schema-qualify `public.profiles`. `PUBLIC` execution was removed. Explicit `EXECUTE` remains for `anon`, `authenticated`, and `service_role` because existing public-role RLS policies need the helpers to evaluate to false rather than error for non-admin callers. This narrows the effective ACL and does not increase anon capability.

Role behavior after apply:

| Role | `is_admin()` | `is_moderator()` |
| --- | --- | --- |
| `super_admin` | true | true |
| `admin` | true | true |
| `moderator` | false | true |
| `support` | false | false |
| `finance` | false | false |
| `user` | false | false |

`is_admin_team()` was not changed. Specialist roles received no new helper access.

## Inline policies changed

Only these seven policies were recreated, retaining their names, commands, and `authenticated` role while replacing the inline profile lookup with `public.is_admin()`:

1. `company_verifications` — `companyverif admin read` (`SELECT`)
2. `company_verifications` — `companyverif admin select` (`SELECT`)
3. `company_verifications` — `companyverif admin update` (`UPDATE`)
4. `verifications` — `verif admin select` (`SELECT`)
5. `verifications` — `verif admin update` (`UPDATE`)
6. `scheduled_notifications` — `scheduled notifications admin read` (`SELECT`)
7. `scheduled_notifications` — `scheduled notifications admin update` (`UPDATE`, including `WITH CHECK`)

No profile, listing, report, review, business-verification, announcement, or settings policy needed direct editing because its active legacy path already calls one of the two central helpers. Reports recover through `is_moderator()`.

## Edge Functions

No Edge Function source was changed and no Edge Function was deployed. Known exact-role checks remain in `admin-sentry-issues`, `get-r2-upload-url`, `process-account-deletion`, and `get-cv-url`; those are endpoint-specific C2E/C2F work. The legacy browser login itself accepts every value in `ADMIN_ROLES`, including `super_admin`, and assigns the loaded database role after login.

## Apply and rollback evidence

`apply_migration` returned `success: true`. Post-apply introspection found the migration in `supabase_migrations.schema_migrations`, both new helper bodies, empty fixed search paths, `PUBLIC=false`, and the seven policies using `is_admin()`.

The paired rollback was executed inside a transaction with its terminal `COMMIT` replaced by `ROLLBACK` for rehearsal. Assertions confirmed that it restored the exact pre-fix helper semantics and all seven inline checks; the transaction then rolled back. Fresh introspection confirmed the forward fix remained deployed afterward.

The live test suite also used a single `BEGIN … ROLLBACK` transaction. Temporary role changes, profile updates, role-audit rows, and Vault probes did not persist. Post-test counts found no probe secret.

## Test results

All 15 assertions passed:

1. `super_admin` passes `is_admin()`.
2. `super_admin` passes `is_moderator()`.
3. `admin` still passes `is_admin()`.
4. `admin` still passes `is_moderator()`.
5. `moderator` still passes `is_moderator()`.
6. `moderator` does not pass `is_admin()`.
7. `support` passes neither helper.
8. `finance` passes neither helper.
9. A normal user passes neither helper.
10. The real `super_admin` can read another profile through the legacy staff policy.
11. The real `super_admin` can perform a representative guarded profile action.
12. A normal user cannot read or update another admin profile.
13. `amos_set_integration_credential` rejects `admin`, `moderator`, `support`, and `finance`.
14. `amos_set_integration_credential` accepts `super_admin`.
15. All seven selected inline policies use `is_admin()` after apply.

Final live role counts are one `super_admin` and 98 `user`; no temporary `admin`, `moderator`, `support`, or `finance` role remained.

A final authenticated-role simulation for the promoted account `e79039a4-2216-4526-81e1-c8c25e688834` returned `is_admin=true`, `is_moderator=true`, all 99 profile rows visible through the staff policy, and successful read queries for verifications, company verification, business verification, reports, scheduled notifications, announcements, and settings. The transaction rolled back.

## Security advisors

The before and after advisor sets are identical; this migration introduced no new finding:

| Finding | Level | Before | After |
| --- | --- | ---: | ---: |
| RLS enabled without policy | info | 5 | 5 |
| Security-definer view | error | 1 | 1 |
| Mutable function search path | warning | 3 | 3 |
| Extension in public | warning | 1 | 1 |
| Anon-executable security-definer function | warning | 89 | 89 |
| Authenticated-executable security-definer function | warning | 118 | 118 |
| Leaked-password protection disabled | warning | 1 | 1 |

These are pre-existing C2F/C2C findings. The two changed functions do not add to them; their `PUBLIC` execution was narrowed and their search paths hardened.

## Deferred role-check risks

Seven direct-role policies remain on `business_leads`, `business_payments` (two), `businesses`, `job_runs`, and `reports` (two). Current helper/team policies make several redundant, but their stale literal checks should be removed family-by-family during C2F.

Three deployed database functions still contain direct admin-role checks: `is_authorized_recruiter`, `rental_notify_report_submitted`, and `request_candidate_contact`. Repository and Edge inspection also identifies exact-role checks in recruitment, rental notification, account deletion, Sentry, R2 upload, and CV access paths. They were outside the minimum compatibility surface and remain for C2E/C2F review.

Recommended next stage: return to the approved sequence rather than broadening this emergency patch. Run C2C planning/native MFA preparation or the separately approved next hardening slice; do not begin Stage D until its prerequisites are satisfied.
