# Stage C2B — Profile privileged-column protection + super-admin role separation

Preparation and validation only. **Nothing in this stage was applied to the live
database.** No schema, RLS policy, grant, or account was changed. All live testing
below ran inside `BEGIN … ROLLBACK` transactions and left zero trace (verified).

- Branch: `feat/admin-stage-b-shell`
- HEAD / remote at start of this stage: `77e97f90ce8b3d7479c7ac73bdc2e3c930d6cfbd`
- Prepared: 2026-09-11
- Project: `gxgytumhknmnwspxjzxw`

---

## 1. Files created

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260911090000_profiles_privileged_column_guard_and_role_hierarchy.sql` | forward migration (NOT applied) |
| `supabase/migrations/20260911090000_profiles_privileged_column_guard_and_role_hierarchy_ROLLBACK.sql` | paired rollback |
| `supabase/tests/c2b_privileged_column_guard.test.sql` | repeatable, self-contained, rolled-back test script (run live, see §9) |
| `supabase/migrations/20260911090000_c2b_promote_admin_to_super_admin_APPROVAL_REQUIRED.sql` | separate, clearly-marked, **not executed** promotion step |
| `admin/docs/c2b-results.md` | this file |

Nothing else was created or modified. `.continue/` untouched.

## 2. Every SQL object affected (by the forward migration, if/when applied)

| Object | Kind | Change |
| --- | --- | --- |
| `public.role_rank(text)` | function | **new** |
| `public.is_super_admin()` | function | **new** |
| `public.has_admin_privilege(text)` | function | **new** |
| `public.profiles_guard_privileged()` | function | **new** (trigger function) |
| `trg_profiles_guard_privileged` on `public.profiles` | trigger | **new** |
| `public.amos_set_integration_credential(text,text,text)` | function | **modified** — internal guard only (signature/SECURITY DEFINER/search_path/grants unchanged) |

Nothing else. No table column added/dropped, no existing RLS policy touched, no
existing grant on `profiles` or any other table touched, `is_admin()` /
`is_admin_team()` / `is_moderator()` bodies untouched.

## 3. Exact privileged-column protection mechanism

A **`BEFORE UPDATE` row-level trigger** (`trg_profiles_guard_privileged` →
`public.profiles_guard_privileged()`), not a column `REVOKE`. C2-VERIFY already found
that `authenticated` holds an effective table-level UPDATE grant on every column of
`profiles`, which is exactly the kind of grant that silently overrides a column
`REVOKE` (as it already did for `mfa_secret`/`two_factor_secret` in
`admin_mfa_secret_column_lockdown.sql`). A trigger fires for every caller regardless
of table/column grants and regardless of RLS bypass (`rolbypassrls` only affects
policy evaluation, not trigger execution — confirmed live: `postgres`, which bypasses
RLS, still had its own privileged-column writes silently re-pinned by this trigger
during test setup, which is what proved the mechanism is grant-independent).

Behaviour: for any `UPDATE` on `public.profiles` where the caller is **not**
admin-team (`is_admin_team()`) and **not** the trusted `service_role`
(`auth.role() = 'service_role'`), the trigger re-pins these 8 columns to their prior
(`OLD`) value:

```
role, verified, company_verified, status, ban_reason, ban_until,
verification_pending, admin_notes
```

It does **not** reject the statement — an `UPDATE` that also touches a legitimate
field succeeds for that field while the privileged columns are silently held at
their previous value. This mirrors the design already described (but never deployed)
in `ADMIN_ENTERPRISE_V2.sql`, widened from `is_admin()` to `is_admin_team()` to match
the union of the two existing admin `UPDATE` policies on `profiles`
(`profiles admin update` uses `is_admin()`; `profiles: admin update` uses
`is_admin_team()`), and extended to `service_role` since no current legitimate
`profiles`-column writer needed that bypass (verified — see §6) but a future one
might, and RLS bypass alone does not exempt it from the trigger.

The pre-existing `profiles: own update` policy (which already pins `role` alone via
a `WITH CHECK` subquery) is untouched and keeps working exactly as before; the
trigger is additive defence-in-depth covering the other 7 columns plus `role` again.

## 4. Every legitimate profile field users can still edit

Live tested (see §9, test 6): `bio`. By construction (not individually re-tested,
but structurally identical — none of these columns are in the 8-column guard list,
and the existing `profiles: own update` policy's `USING (auth.uid() = id)` covers
them): `name`, `phone`, `avatar`, `language`, `open_to_work`, `job_title`, `skills`,
`sector`, `exp`, `city`, `province`, `whatsapp_number`, `phone_for_calls`,
`contact_method`, `contact_availability`, `linkedin_url`, `github_url`, `website_url`,
`cv_file_name`, `cv_file_path`, `company`, `privacy`, `marketing_email_opt_out`,
`push_subscription`, `last_seen`/`last_seen_at`/`last_active_at` (already
server-touched by `touch_last_active()`), `unsubscribe_token`. The pre-existing
`char_length(bio) <= 500`, `char_length(name) <= 120`, and avatar-not-a-data-URI
`CHECK` constraints on `profiles` are unaffected.

Explicitly **not** in this list and explicitly still guarded: the 8 columns in §3.
`mfa_secret`/`two_factor_secret`/`two_factor_enabled`/`mfa_enabled` are also not
guarded by this trigger — they are out of scope for C2B (tracked as H3, deferred to
C2C per `c2-hardening-plan.md`) and were not touched.

## 5. Proposed role hierarchy and exact permissions

| Role | `role_rank()` | `has_admin_privilege('admin')` | `has_admin_privilege('super_admin')` | `is_super_admin()` |
| --- | ---: | --- | --- | --- |
| `super_admin` | 4 | true | true | true |
| `admin` | 3 | true | false | false |
| `moderator` / `support` / `finance` | 2 (equal tier — no ordering between them) | false | false | false |
| `user` | 1 | false | false | false |
| unrecognised role | NULL | `has_admin_privilege` raises; caller treated as no-privilege everywhere else | — | — |

`has_admin_privilege(min_role)` floors at rank 2 (the admin-team tier) regardless of
`min_role`, so it can never return `true` for an ordinary user even if called with
`min_role = 'user'` by mistake — a deliberate fail-safe. It raises (does not
silently return `false`) if `min_role` is not one of the six known role names, so a
typo in a future caller fails loud rather than failing open or silently permissive.

This is **additive** — it does not change what `is_admin()` (`admin` only),
`is_admin_team()` (all five admin-team roles equally), or `is_moderator()`
(`admin`+`moderator`) currently return or currently gate. New work should prefer
`has_admin_privilege()` / `is_super_admin()`; the three legacy helpers remain
authoritative for every object that already calls them until each is migrated
individually in a later stage (see §6/§7).

## 6. Every existing authorization check inspected

Fresh live introspection (2026-09-11, this stage), not reused from C2-VERIFY:

| Predicate | Referenced by other functions | Referenced by RLS policies |
| --- | ---: | ---: |
| `is_admin()` | **16** | **66** |
| `is_admin_team()` | **11** | **38** |
| `is_moderator()` | **8** | **5** |
| inline `role = 'admin'` / `role = ANY(array[...])` (no helper call) | **5** | **17** |

Full table/function name lists were captured and are available in this stage's
query transcript; the notable ones already known from C2-VERIFY (`business_verifications`,
`company_verifications`, `verifications`, `content_pages`, `content_page_versions`,
`site_announcements`, `app_settings`, `scheduled_notifications`, `admin_ip_blocks`,
`reviews` delete, `app_error_events` update, `admin_*_paid_ad` RPCs — all gated by
`is_admin()`, excluding `super_admin`) are joined by many more found this pass,
including `account_deletion_requests`, `blog_videos`, `business_subscriptions`,
`businesses`, `categories`, `cities`, `contact_requests`, `deletion_logs`,
`featured_slot_packs`, `job_credit_packs`, `job_credit_spends`, `listings`,
`notifications`, `paynow_payments`, `play_purchases`, `play_recruiter_subscriptions`,
`play_subscriptions`, `provinces`, `recruiter_profiles`, `recruiter_subscriptions`,
`role_audit_log`, `shop_order_items`, `shop_order_status_history`, `shop_orders`, and
14 `rental_*` tables — all on `is_admin()` (excludes `super_admin`); the 38
`is_admin_team()` policies (which admit any of the five roles equally) span every
`amos_*` table plus `admin_sessions`, `admin_saved_views`, `admin_login_attempts`
(read), `job_runs`, `moderation_appeals`, `notifications`, `profiles` (the admin
UPDATE policy), `recruitment_candidate_refs`, `recruitment_conversation_context`,
`search_logs`, `support_tickets`, `support_ticket_messages`; the 5 `is_moderator()`
policies are `applications`, `moderation_settings`, `profiles` (owner-or-staff read),
`reports` (×2).

**Edge Functions** (source-inspected, this stage):

| Function | Check | Excludes `super_admin`? |
| --- | --- | --- |
| `admin-sentry-issues` | `profile?.role !== 'admin'` | yes |
| `get-r2-upload-url` | `profile?.role === 'admin'` (×2: `ads/`/`amos/` upload gate, `verification/` admin-read gate) | yes |
| `process-account-deletion` | `callerProfile.role !== 'admin'` | yes |
| `get-cv-url` | `['admin','moderator'].includes(role)` | yes |
| `amos-tiktok-oauth-callback`, `_shared/amos-publishers/tiktok.ts` | comments only, explaining why they intentionally bypass `is_admin_team()` via `service_role` in that server context — no actual role check present | n/a |

**Views:** `profiles_public` references `role` (it selects the column, does not
gate on it) — already tracked as H9 (SECURITY DEFINER view, out of scope for C2B).

None of the above was changed. This is the classification the task's item 6 asked
for; the full per-object list is reproducible from the queries recorded in this
stage's session (not re-pasted here to keep this document reviewable).

## 7. Which checks require later migration

**All of the above except `amos_set_integration_credential`.** Every `is_admin()`
policy/function that should admit `super_admin` (66 policies + 16 functions + 3 Edge
Functions), every `is_admin_team()` object that should be narrowed away from
treating `support`/`finance`/`moderator` as equals to `admin`/`super_admin` (38
policies + 11 functions), the `is_moderator()` objects that exclude `super_admin`
(5 policies + 8 functions), and the 17 policies + 5 functions using an inline role
literal instead of any helper — all deferred to **Stage C2F** (grants/RLS cleanup,
per table family, per `c2-hardening-plan.md`). Rewriting any of it in C2B would be
exactly the "broad grant or RLS cleanup" this stage's boundaries forbid. The new
`has_admin_privilege()` / `is_super_admin()` helpers exist specifically so C2F can
migrate these objects incrementally, one table family at a time, without another
flag-day rewrite of the legacy helpers themselves.

## 8. Exact changes to `amos_set_integration_credential`

Signature unchanged: `public.amos_set_integration_credential(p_provider text,
p_secret_name text, p_secret_value text)`. `SECURITY DEFINER`, `SET search_path =
'public', 'vault'`, return type `void`, and EXECUTE grants (`authenticated`,
`service_role` — no `anon`/`PUBLIC`, unchanged from before C2B) are all identical.
The **only** change is the guard condition and its error message:

```diff
- IF NOT is_admin_team() THEN
-   RAISE EXCEPTION 'Only admin-team members can connect AMOS integrations';
+ IF NOT public.is_super_admin() THEN
+   RAISE EXCEPTION 'Only super_admin can connect AMOS integrations';
```

Everything else in the function body (Vault secret create/update, the
`amos_integrations` status update) is byte-for-byte unchanged.

## 9. All test results

`supabase/tests/c2b_privileged_column_guard.test.sql` applies the full forward
migration's DDL **in-transaction**, runs 17 assertions (covering all 15 required
test categories — a few are split into sub-checks for precision — plus 2 extra
positive/negative AMOS-credential checks), then unconditionally `ROLLBACK`s. Run
live against `gxgytumhknmnwspxjzxw` twice (first run found a test-harness ordering
bug — the trigger, once created, also guarded the test's own setup writes, exactly
as designed — fixed by attributing setup writes to a simulated `service_role`
caller; not a defect in the migration itself). Final run: **17 / 17 passed.**

| # | Test | Expected | Actual | Passed |
| --- | --- | --- | --- | --- |
| 1 | normal user cannot self-verify (`verified`) | unchanged | unchanged | ✅ |
| 2 | normal user cannot self-verify (`company_verified`) | unchanged | unchanged | ✅ |
| 3 | normal user cannot change `status`/`ban_reason`/`ban_until` | unchanged | unchanged | ✅ |
| 4 | normal user cannot change `verification_pending` | unchanged | unchanged | ✅ |
| 5 | normal user cannot change `admin_notes` | unchanged | unchanged | ✅ |
| 6 | normal user **can** still edit a legitimate field (`bio`) | CHANGED | CHANGED | ✅ |
| 7 | normal user cannot promote own `role` | `user` | `user` | ✅ |
| 8 | banned user cannot unban self | still banned | still banned | ✅ |
| 9 | authenticated admin can still verify another user | 1 row updated | 1 row updated | ✅ |
| 10 | `super_admin` passes hierarchy checks | true/true/true | true/true/true | ✅ |
| 11 | `admin` cannot pass super-admin checks / cannot set AMOS credentials | false/false/rejected | false/false/rejected | ✅ |
| 12 | `moderator` lacks admin-level privilege + rejected by AMOS-credential RPC | false/rejected | false/rejected | ✅ |
| 13 | `support` lacks admin-level privilege + rejected by AMOS-credential RPC | false/rejected | false/rejected | ✅ |
| 14 | `finance` lacks admin-level privilege + rejected by AMOS-credential RPC | false/rejected | false/rejected | ✅ |
| 15 | ordinary user rejected by AMOS-credential RPC; error message carries no secret/value | rejected, generic message | `rejected: Only super_admin can connect AMOS integrations` | ✅ |
| 16 | `super_admin` **is** accepted by the AMOS-credential RPC (positive case) | accepted | accepted | ✅ |
| 17 | `service_role` backend path still functional (bypasses guard independent of `is_admin_team()`) | 1 row updated | 1 row updated | ✅ |

**Post-run verification that nothing persisted** (separate read-only queries,
outside the test transaction):
- `select role, count(*) from profiles group by role` → still exactly `user: 97,
  admin: 1` — zero `super_admin`/`moderator`/`support`/`finance` rows exist.
- `is_super_admin`, `has_admin_privilege`, `role_rank`, `profiles_guard_privileged`
  → **do not exist** in the live database.
- `public.profiles` triggers → still exactly the original two
  (`profiles_set_updated_at`, `trg_log_role_change`); no `trg_profiles_guard_privileged`.
- `amos_set_integration_credential` body → still contains `is_admin_team()`, not
  `is_super_admin()`.
- `vault.secrets` / `amos_integrations` → zero rows named/provider `c2b_test_probe*`.

## 10. Advisor and lint results

Re-ran `supabase db advisors --linked` after the test run. **Identical to the C2A
post-apply baseline** (706 total findings; `anon_security_definer_function_executable`
= 87; `security_definer_view` = 1; `authenticated_security_definer_function_executable`
= 116; `function_search_path_mutable` = 3; `extension_in_public` = 1;
`auth_leaked_password_protection` = 1; `auth_rls_initplan` = 124;
`multiple_permissive_policies` = 356; `duplicate_index` = 17). **Zero new findings**
— expected, since nothing was actually applied and the rolled-back test transaction
left no trace.

## 11. Compatibility findings

- **`www/admin.html`**: not modified; not read for this stage beyond the caller
  inventory already established in C2A. The trigger's admin-team bypass
  (`is_admin_team()`) is a superset of both existing admin `UPDATE` policies, so
  every admin.html verify/ban/promote/role-change action that works today would
  continue to work unchanged once applied (test 9 exercises exactly this path).
- **Mobile / public website**: not modified. Neither reads or writes the 8 guarded
  columns directly (per C2-VERIFY's function/table caller inventory); the only
  functions that touch `profiles` via `UPDATE … SET` (`apply_listing_boost`,
  `run_personalized_recommendations`, `run_verification_nudge`, `touch_last_active`)
  write only `wallet_usd`, `last_recommendation_at`, `last_verification_nudge_at`,
  `last_active_at` respectively — none of the 8 guarded columns — confirmed by
  reading each function's live body before writing this migration.
- **Service-role / trusted backend paths**: confirmed functional (test 17) via the
  `auth.role() = 'service_role'` bypass, independent of `is_admin_team()`.
- **No Edge Function was changed**, so no Edge Function compatibility risk was
  introduced by this stage.

## 12. Exact rollback behaviour

`supabase/migrations/20260911090000_profiles_privileged_column_guard_and_role_hierarchy_ROLLBACK.sql`:
drops `trg_profiles_guard_privileged` and `profiles_guard_privileged()`; restores
`amos_set_integration_credential` to its exact pre-C2B body (`is_admin_team()`
guard, original error message), re-asserting its unchanged grants; drops
`has_admin_privilege(text)`, `is_super_admin()`, `role_rank(text)` (nothing else in
the schema would reference them, since this migration is the only thing that would
have created them). `NOTIFY pgrst, 'reload schema'`. Restores the exact prior
definitions/grants/trigger state — nothing else on `profiles` or any other object is
touched by either direction.

## 13. Exact production apply command

**Not run in this stage.** When approved:

```
npx supabase db query --linked -f supabase/migrations/20260911090000_profiles_privileged_column_guard_and_role_hierarchy.sql
```

Consistent with C2A's application method — this repo's `supabase_migrations`
ledger is known-incomplete (`c2-verify-results.md` §3); do not run
`supabase db push` against this project without reconciling that ledger first.
Post-apply, re-run `supabase/tests/c2b_privileged_column_guard.test.sql` against
the now-live functions/trigger (it is self-contained and still rolls back — safe to
run again post-apply as a smoke test) and re-run `supabase db advisors --linked` to
confirm the same zero-new-findings result against the real objects.

## 14. Administrator-promotion step — NOT EXECUTED

`supabase/migrations/20260911090000_c2b_promote_admin_to_super_admin_APPROVAL_REQUIRED.sql`
— deliberately **not bundled into, and not run as part of**, the forward migration.
It promotes exactly one account (id `e79039a4-2216-4526-81e1-c8c25e688834`,
currently `role = 'admin'`) to `role = 'super_admin'`, guarded to affect exactly one
row and to no-op with a `NOTICE` if already promoted or if the account no longer
matches. **Requires**: (a) the forward C2B migration already applied and verified
live, (b) separate explicit human approval. Its own rollback is documented inline
(`UPDATE … SET role = 'admin' WHERE id = … AND role = 'super_admin'`). **This file
has not been executed against any environment**, including the rolled-back test
transaction (the test suite simulates a *different*, disposable account as
`super_admin` for the duration of its own transaction — see test setup in §9 — and
never touches the real admin account's role).

## 15. Remaining risks

- Everything in §6/§7 — 66+38+5+17 = 126 policies and 16+11+8+5 = 40 functions plus
  4 Edge Functions still gate on the legacy helpers/inline literals, most still
  excluding `super_admin` or over-admitting `support`/`finance`/`moderator`. Deferred
  to C2F, table family by table family.
- H3 (legacy MFA secret columns, no native MFA, no `aal2`) — untouched, deferred to C2C.
- H5/H8 (`admin_audit_logs` browser-forgeable; broad `anon` table grants) — untouched,
  deferred to C2D/C2F.
- H9 (`profiles_public` view still `SECURITY DEFINER`) — untouched, explicitly out of
  scope for this stage.
- Until the promotion step (§14) is separately approved and run, **zero**
  `super_admin` accounts exist — `amos_set_integration_credential` becomes
  unusable by anyone (including the current sole `admin`) the moment C2B's forward
  migration is applied, until promotion happens. This is intentional (fail-closed)
  but is an operational gap between "apply C2B" and "promote the admin" that should
  be closed promptly once approved, not left open indefinitely.
- `company_verification_pending` and any other columns structurally similar to the
  8 guarded ones but not named in this stage's brief are **not** guarded by this
  trigger — noted as a candidate for the same treatment in a later pass, not added
  here to stay within the stage's exact scope.
- The trigger's `is_admin_team()` bypass means `support`/`finance`/`moderator` (once
  such accounts exist) can still edit **any** user's privileged profile columns via
  the existing `profiles: admin update` policy — this is unchanged pre-existing
  behaviour (H2), not introduced or worsened by C2B, and is explicitly deferred to
  C2F/C2B-follow-on role-permission narrowing.

## 16. Is C2B safe to approve and apply?

**Yes, with the promotion step handled as its own separate approval per §14.** The
forward migration is narrowly scoped (2 tables' worth of objects: a new trigger +
its function on `profiles`, three new additive helper functions, one guard-line
change in one existing function), has a tested and verified paired rollback, was
validated end-to-end via 17/17 passing assertions in a real rolled-back transaction
against the actual production schema and data (not a synthetic copy), introduces
zero new Supabase advisor findings, and every known legitimate writer of the 8
guarded columns (the two admin RLS policies, and the four functions that write
other `profiles` columns) was individually confirmed compatible. The one
operational consequence to plan for is the fail-closed gap in §15 (no
`super_admin` until promotion is separately approved) — recommend applying the
forward migration and running the promotion approval in the same maintenance
window so that gap is not left open.

---

## Addendum — live apply, verify, promote (2026-09-11)

C2B was applied to production, the admin account was promoted, and everything was
verified live. This addendum records what actually happened, including two things
discovered only during live execution that this document's original preparation
could not have found (the rolled-back dry-run test used a *simulated* super_admin
on a disposable account and never exercised the real account's other-table access).

### Forward migration — applied

`20260911090000_profiles_privileged_column_guard_and_role_hierarchy.sql` applied via
`supabase db query --linked`. Preflight passed; all four new objects
(`role_rank`, `is_super_admin`, `has_admin_privilege`, `profiles_guard_privileged`
+ `trg_profiles_guard_privileged`) verified present; `amos_set_integration_credential`
verified to now require `is_super_admin()`.

### Promotion script — fixed during execution, then applied

The first run of `20260911090000_c2b_promote_admin_to_super_admin_APPROVAL_REQUIRED.sql`
**silently no-op'd**: run as plain `postgres` with no JWT claims set, the brand-new
`trg_profiles_guard_privileged` trigger (which fires for *every* caller, including
`postgres` — that is its entire purpose) saw `is_admin_team() = false` and
`auth.role() = NULL`, and re-pinned `role` back to `'admin'` before the row was
written. `GET DIAGNOSTICS row_count` still reported 1 (a row was matched and an
UPDATE was attempted), so the script's original check could not detect the failure.
The file was corrected in place (not a new file) to: (a) set
`request.jwt.claim.role = 'service_role'` before the `UPDATE`, matching the
trigger's own trusted-backend bypass, (b) set `request.jwt.claim.sub` to the target
account (there is no separate operator identity to attribute the change to, and the
pre-existing `trg_log_role_change` trigger requires a non-null `actor_id`), and
(c) re-read the persisted `role` after the `UPDATE` and raise if it is not
`super_admin`, instead of trusting `row_count` alone. Re-run: succeeded. Verified:
`id e79039a4-2216-4526-81e1-c8c25e688834` is now `role = 'super_admin'`; role
counts are `user: 97, super_admin: 1` (zero remaining `admin` rows — a clean
transition, not a duplicate); `public.role_audit_log` recorded the change
(`admin -> super_admin`, attributed to the promoted account itself, per (b) above).

### Critical finding — `is_moderator()` and `is_admin()` exclude `super_admin` (pre-existing, now activated)

Live verification (required test "existing admin or super_admin can still update
guarded profile fields where admin UI needs it") **failed** the first time it was
run against the real, now-promoted account: `UPDATE public.profiles SET verified =
true WHERE id = <other user>`, run as the authenticated `super_admin`, affected
**0 rows** — not because of anything C2B added, but because PostgreSQL RLS requires
a row to be visible under an applicable **SELECT** policy for an `UPDATE ... WHERE`
to find it at all, and `profiles`' only SELECT policy
(`profiles: owner or staff read`) is `auth.uid() = id OR is_moderator()` —
and `is_moderator()`'s body is `role IN ('admin','moderator')`, which has
**never** included `super_admin`. This is not new: C2-VERIFY documented it back on
2026-09-10 (H7) as one of many objects where `super_admin` is excluded. What is new
is that **no `super_admin` account existed until this stage's promotion**, so the
gap was latent and untested until today.

The practical, live, production impact is broader than just this one column:
`is_admin()` (66 policies + 16 functions + 3 Edge Functions —
`admin-sentry-issues`, `get-r2-upload-url`, `process-account-deletion`) and
`is_moderator()` (5 policies + 8 functions + `get-cv-url`) all exclude
`super_admin` by the same mechanism. As of this promotion, **the platform's sole
administrator account can no longer read or moderate other users' `profiles` rows,
manage verifications/content/announcements/settings/paid ads through the objects
gated by `is_admin()`, or use the Sentry/CV/upload Edge Functions gated the same
way — all via `www/admin.html`, unmodified, exactly as before.** C2B's own new
objects (`is_super_admin()`, `has_admin_privilege()`, the guard trigger,
`amos_set_integration_credential`) all work exactly as designed and tested — this
is a *different*, pre-existing set of objects that C2B was explicitly scoped not to
touch, now exposed by the very promotion this stage was asked to perform.

**No code was changed to address this.** Modifying `is_moderator()`, `is_admin()`,
or the `profiles` SELECT policy is exactly the "broad grant or RLS cleanup"
C2B's own boundaries — and this stage's boundaries — reserve for Stage C2F, and
this stage's instructions explicitly forbid starting C2C–C2F. This is reported as
the top item under Remaining Risks below and needs an urgent, separately-approved
decision (see the session's final report for options).

### Post-apply advisor delta

`anon_security_definer_function_executable`: 87 → **89** (+2: `is_super_admin`,
`has_admin_privilege` — both newly anon-granted by design, matching the existing
`is_admin()`/`is_admin_team()`/`is_moderator()` pattern so they compose safely
inside any future `FOR ALL`/`roles=public` policy; both are `auth.uid()`-scoped and
return `false`/raise for an unauthenticated caller, the same risk class as the three
pre-existing entries). `authenticated_security_definer_function_executable`: 116 →
**118** (+2, same two functions). No other advisor category changed. This is a
correction to this document's earlier §10, which (accurately, at the time) reported
"no new findings" for the *rolled-back test*, which never persisted the grants —
applying the real migration does persist them, and the advisor count reflects that.

### Rollback — dry-run validated, not executed

The paired rollback was validated by running its body inside its own
`BEGIN … ROLLBACK` against the *real, now-applied* production state (not a copy):
all four new objects removed, `trg_profiles_guard_privileged` removed,
`amos_set_integration_credential` guard reverted to `is_admin_team()`, exactly 2
triggers remain on `profiles` — then rolled back, so production kept the applied
C2B state throughout. Rollback was **not executed for real** — verification did not
fail in a way that warrants it (the C2B objects themselves are correct; the finding
above is a gap in different, untouched objects).

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
