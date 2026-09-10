# Deployed Supabase authorization verification

Read-only checks were run against project `gxgytumhknmnwspxjzxw` on 10 September 2026. Stage C made no Supabase changes and invoked no Edge Function.

## Observed model

- `public.profiles` currently contains 97 `user` accounts and one `admin` account. No account currently uses `super_admin`, `moderator`, `support`, or `finance`.
- `is_admin()` recognizes only `admin`. `is_admin_team()` recognizes all five intended role names. `is_moderator()` recognizes `admin` and `moderator`, excluding `super_admin`. Existing policies and functions therefore do not implement one consistent hierarchy.
- RLS is enabled on the reviewed admin, audit, support, AMOS, rental, error, job, and profile tables. It is not forced for table owners.
- Many policies authorize all five admin-team roles uniformly. Examples include all-row access to `admin_sessions`, `support_tickets`, AMOS audit/publish tables, and broad read access to job and audit records. The deployed policy set does not enforce the narrower Stage C role matrix.
- `admin_sessions` exists, but its `FOR ALL` policy allows any admin-team role to modify any session row. The legacy session table is not evidence that a Supabase JWT was revoked.
- `admin_audit_logs` exists. Its insert policy checks only admin-team membership and permits browser-supplied nullable actor fields and JSON state, so it is not trustworthy server attribution.

## Grants and privileged functions

Reviewed admin tables commonly grant `anon` and `authenticated` broad table privileges, including mutation privileges, then rely on RLS to reject rows. This is wider than least privilege and increases the consequence of a future policy mistake.

The public schema contains 173 `SECURITY DEFINER` functions. Eighty are executable by `PUBLIC`; 94 are executable by `anon` (including inherited public access). Thirty-eight anon-executable functions are ordinary callable RPCs rather than trigger functions. The Supabase security advisor reports this as an exposed attack surface.

Admin analytics RPCs such as `admin_revenue_summary`, `admin_category_breakdown`, and related cohort/growth functions are executable by `PUBLIC` and `anon`. Their current definitions include an `is_admin_team()` guard, but anonymous execute rights are unnecessary. `get_my_mfa_secret()` is also `SECURITY DEFINER` and anon/public executable; it scopes the returned row to `auth.uid()`, yet the grant remains unnecessarily broad.

Paid-ad mutation RPCs are restricted to `authenticated` and contain internal `is_admin()` checks. This excludes all target roles except `admin`, including `super_admin`. AMOS credential RPC execution is not granted to anon/public, but the deployed/source role checks still need alignment to the exclusive `super_admin` rule before migration.

## MFA and profile fields

Supabase native MFA tables are present (`auth.mfa_factors`, challenges, AMR claims, and sessions). The sole current admin has no verified native factor. Legacy custom fields `mfa_secret`, `mfa_enabled`, `two_factor_secret`, and `two_factor_enabled` remain on `profiles`.

No public RLS policy references the JWT `aal` claim, so the database does not currently require `aal2` for privileged operations. Stage C observes the current assurance level only; it does not claim to enforce MFA.

Authenticated users have effective direct `SELECT` and `UPDATE` privilege on all four legacy MFA columns. The source migration's column-level `REVOKE SELECT` does not override the table-level `SELECT` grant. Anon also retains direct select on `two_factor_secret` where a row policy permits a row. This needs a separately approved schema correction and retirement of custom browser-managed MFA.

## Edge Functions

Twenty-nine deployed Edge Functions were listed. Admin-related functions include `admin-login-guard` (`verify_jwt=false`), `admin-sentry-issues` (`true`), `send-push` (`true`), `get-r2-upload-url` (`true`), and multiple AMOS runners/dispatchers (`false`).

The deployed `admin-login-guard` intentionally accepts pre-auth login checks, while authenticated mutation paths validate a JWT with `getUser`; those paths do not also confirm the profile role. `admin-sentry-issues` validates a JWT and then requires the exact `admin` role, which conflicts with the five-role target and excludes `super_admin`. AMOS functions with gateway JWT verification disabled support automation-secret paths and perform their own request checks; each must receive endpoint-specific review before the new client calls it.

Stage C's wrapper performs no calls. Future invocations require the current session JWT and include cancellation, a timeout, and normalized errors. A browser route guard cannot make an Edge Function safe.

## Source and deployment differences

- `ADMIN_ENTERPRISE_V2.sql` defines a `profiles_guard_privileged` trigger, but the deployed `profiles` table has only update-timestamp and role-audit triggers. The source guard is absent live.
- The repository's MFA lockdown migration claims direct authenticated secret reads are revoked, while deployed effective privileges still allow them because table-level grants remain.
- Numerous live objects came from manually run SQL files and are not represented by a complete ordered migration ledger. Only a small subset of searched admin/security/AMOS migration names appears in `supabase_migrations.schema_migrations`, so file presence is not proof of deployment.
- Role helpers, policies, RPCs, and Edge Functions disagree on whether `super_admin` and the specialist roles count as authorized.

## Advisor findings and blockers

The current security advisor also flags the `profiles_public` view as security-definer, 94 anon-callable security-definer functions, three mutable function search paths, five RLS tables with no policy, `pg_trgm` in `public`, and leaked-password protection disabled.

Before Stage D enables production reads or mutations, approve a separate Supabase hardening change: define server-enforced permissions, enforce native MFA `aal2` for high-risk operations, remove effective access to legacy MFA secrets, install the missing privileged-profile protection or an equivalent safer design, narrow grants and function execution, repair the security-definer view, make audit/session enforcement server-owned, and align every relevant Edge Function with the target roles.

That hardening should also add the server-owned, append-only security evidence design in `audit-plan.md`: admin/super-admin read access, super-admin-only export, explicit retention and legal holds, and failure isolation for normal customer-facing requests.
