-- ============================================================
-- PaMarket — Stage C2B: profiles privileged-column protection +
-- super-admin role hierarchy helpers
--
-- Source of truth for scope + evidence:
--   admin/docs/c2-hardening-plan.md    (Stage C2 plan, section 9 / C2B)
--   admin/docs/c2-verify-results.md    (live verification: H1b, H7)
--   admin/docs/c2a-results.md          (prior stage, applied 2026-09-10)
--
-- WHAT / WHY
--   C2-VERIFY confirmed live that public.profiles has exactly ONE UPDATE
--   guard for a caller's own row ("profiles: own update"), and that guard's
--   WITH CHECK pins only the `role` column via a subquery. It leaves
--   `verified`, `company_verified`, `status`, `ban_reason`, `ban_until`,
--   `verification_pending`, and `admin_notes` completely unpinned, and the
--   `profiles_guard_privileged` trigger described in the (never-deployed)
--   ADMIN_ENTERPRISE_V2.sql script does not exist on the live database.
--   C2-VERIFY also found that column-level REVOKE alone is unreliable here:
--   `authenticated` still holds an effective table-level UPDATE grant on
--   every column of `profiles`, so a REVOKE at the column level is exactly
--   the kind of protection this project has already seen silently overridden
--   (see admin_mfa_secret_column_lockdown.sql's REVOKE on mfa_secret /
--   two_factor_secret, which C2-VERIFY found still effectively readable).
--   This migration therefore uses a BEFORE UPDATE trigger — a mechanism that
--   cannot be bypassed by a table-level grant — instead of relying on
--   REVOKE.
--
--   It also adds a small, additive role-hierarchy layer
--   (public.role_rank, public.is_super_admin, public.has_admin_privilege)
--   so a future migration can start expressing "super_admin only" and
--   "admin-team or higher" checks without redefining is_admin() /
--   is_admin_team() / is_moderator(), whose current behaviour every RLS
--   policy, SECURITY DEFINER function, and Edge Function on this project
--   still depends on. Those three legacy helpers are NOT touched by this
--   migration — see the inspection appendix at the bottom of this file for
--   the full inventory of what currently calls them.
--
--   Finally, amos_set_integration_credential(text, text, text) is
--   re-guarded from the admin-team-wide is_admin_team() check to the new
--   is_super_admin() check, per the target model in
--   admin/docs/permissions.md ("integrations.manage ... belongs only to
--   super_admin"). Its signature, SECURITY DEFINER status, search_path, and
--   EXECUTE grants (authenticated, service_role — no anon/PUBLIC, unchanged
--   since before this migration) are not altered.
--
-- SCOPE GUARANTEE
--   Touches ONLY:
--     - public.profiles     (one new BEFORE UPDATE trigger; no column, no
--                             existing policy, no existing grant changed)
--     - three NEW functions: public.role_rank, public.is_super_admin,
--                             public.has_admin_privilege
--     - one NEW trigger function: public.profiles_guard_privileged
--     - public.amos_set_integration_credential (internal guard line only;
--                             signature/SECURITY DEFINER/search_path/grants
--                             unchanged)
--   Does NOT touch: is_admin(), is_admin_team(), is_moderator(), any other
--   table's RLS policy or grant, any Edge Function, MFA/TOTP storage, the
--   profiles_public view, any account's role.
--
-- IDEMPOTENCY
--   CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS + CREATE TRIGGER are
--   safe to re-run. Preconditions abort the whole transaction (no partial
--   application) if the live schema has drifted from what C2-VERIFY and this
--   file's own fresh introspection recorded.
--
-- APPLICATION
--   NOT applied in this stage. When approved, apply the same way as C2A —
--   manually via `supabase db query --linked -f <this file>` (this repo's
--   migration ledger is known-incomplete; do not run `supabase db push`
--   without reconciling it first — see c2-verify-results.md section 3).
--
-- ROLLBACK
--   supabase/migrations/20260911090000_profiles_privileged_column_guard_and_role_hierarchy_ROLLBACK.sql
--
-- TEST
--   supabase/tests/c2b_privileged_column_guard.test.sql
--   (self-contained BEGIN ... ROLLBACK script; applies this file's DDL
--   in-transaction, runs 15 assertions, then rolls back — never persists)
-- ============================================================

begin;

-- ── Preconditions — abort the whole migration if the live schema has
--    drifted from what this file assumes. ─────────────────────────────
do $preflight$
declare
  missing_cols text[];
  expected_cols text[] := array[
    'role','verified','company_verified','status',
    'ban_reason','ban_until','verification_pending','admin_notes'
  ];
begin
  if to_regclass('public.profiles') is null then
    raise exception 'C2B abort: public.profiles does not exist';
  end if;

  select array_agg(c) into missing_cols
  from unnest(expected_cols) c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = c
  );
  if missing_cols is not null then
    raise exception 'C2B abort: public.profiles missing expected column(s): %',
      array_to_string(missing_cols, ', ');
  end if;

  if to_regprocedure('public.is_admin_team()') is null then
    raise exception 'C2B abort: public.is_admin_team() does not exist (legacy helper required)';
  end if;

  if to_regprocedure('public.amos_set_integration_credential(text, text, text)') is null then
    raise exception 'C2B abort: public.amos_set_integration_credential(text,text,text) does not exist / signature drift';
  end if;

  -- Do not silently widen an already-modified guard: only proceed if the
  -- live function body still contains the is_admin_team() check this
  -- migration expects to replace.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'amos_set_integration_credential'
      and p.prosrc ~ 'is_admin_team\(\)'
  ) then
    raise exception 'C2B abort: amos_set_integration_credential body does not match the expected pre-C2B guard (is_admin_team()) — inspect before proceeding';
  end if;
end
$preflight$;

-- ── 1. Role rank — a pure lookup, no table access, immutable, empty
--       search_path (no schema resolution needed at all). ─────────────
create or replace function public.role_rank(p_role text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'super_admin' then 4
    when 'admin'        then 3
    when 'moderator'    then 2
    when 'support'      then 2
    when 'finance'      then 2
    when 'user'         then 1
    else null
  end;
$$;

comment on function public.role_rank(text) is
  'C2B: pure role->rank lookup used by has_admin_privilege(). super_admin=4, admin=3, moderator/support/finance=2 (equal tier — no ordering implied between them), user=1, unknown=NULL. Not itself an authorization check.';

revoke execute on function public.role_rank(text) from public;
grant  execute on function public.role_rank(text) to public;
grant  execute on function public.role_rank(text) to service_role;

-- ── 2. is_super_admin() — same shape/grants/search_path pattern as the
--       existing is_admin()/is_admin_team()/is_moderator() helpers, so it
--       is safe to reference from any future RLS policy the same way. ──
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

comment on function public.is_super_admin() is
  'C2B: true only for role = super_admin. Mirrors is_admin()/is_admin_team()/is_moderator() in shape (SECURITY DEFINER, fixed search_path, auth.uid()-scoped) so it composes safely with them. Used to restrict amos_set_integration_credential and, later, admin-role/security/MFA-policy/integration/audit-export actions per admin/docs/permissions.md.';

revoke execute on function public.is_super_admin() from public;
grant  execute on function public.is_super_admin() to public;
grant  execute on function public.is_super_admin() to service_role;

-- ── 3. has_admin_privilege(min_role) — coarse hierarchy check. Floors at
--       rank 2 (moderator/support/finance) so a caller can never satisfy
--       it by virtue of being an ordinary 'user', even if min_role is
--       mistyped as 'user'. Raises on an unrecognised min_role rather than
--       failing open. ─────────────────────────────────────────────────
create or replace function public.has_admin_privilege(min_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_min_rank     smallint := public.role_rank(min_role);
  v_caller_rank  smallint;
begin
  if v_min_rank is null then
    raise exception 'has_admin_privilege: unknown role %', min_role
      using errcode = '22023';
  end if;

  select public.role_rank(p.role) into v_caller_rank
  from public.profiles p
  where p.id = auth.uid();

  if v_caller_rank is null then
    return false;
  end if;

  -- Floor at rank 2 (the admin-team tier) so this can never return true
  -- for an ordinary user, regardless of what min_role was requested.
  return v_caller_rank >= greatest(v_min_rank, 2);
end;
$$;

comment on function public.has_admin_privilege(text) is
  'C2B: true iff the caller''s role rank is >= greatest(rank(min_role), 2) — i.e. it never returns true for role=''user'' even if called with min_role=''user''. Accepts super_admin/admin/moderator/support/finance/user; raises on anything else. has_admin_privilege(''admin'') ~ is_admin() widened to include super_admin; has_admin_privilege(''moderator'') ~ is_admin_team(). Existing is_admin()/is_admin_team()/is_moderator() are unchanged and remain authoritative for the objects that already use them; new work should prefer this function or is_super_admin().';

revoke execute on function public.has_admin_privilege(text) from public;
grant  execute on function public.has_admin_privilege(text) to public;
grant  execute on function public.has_admin_privilege(text) to service_role;

-- ── 4. profiles_guard_privileged() — the actual enforcement mechanism.
--       BEFORE UPDATE ROW trigger, not a column REVOKE: a table-level
--       grant cannot override a trigger the way C2-VERIFY found one
--       overriding admin_mfa_secret_column_lockdown.sql's column REVOKE.
--       SECURITY INVOKER (no DEFINER — it never reads anything beyond
--       NEW/OLD and calls two already-elevated helpers), fixed
--       search_path. Silently re-pins each privileged column to its prior
--       value for any caller that is not admin-team and not the
--       server-side service_role — it does not reject the statement, so
--       an update that also touches legitimate fields (e.g. "bio" and
--       "verified" in the same request) still succeeds for the legitimate
--       fields. This mirrors the (never-deployed) design in
--       ADMIN_ENTERPRISE_V2.sql, widened from is_admin() to is_admin_team()
--       to match the broader set of roles the two existing profiles UPDATE
--       policies already allow, and extended to service_role since RLS
--       bypass (rolbypassrls) does not exempt a caller from a trigger. ──
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
security invoker
set search_path = 'public'
as $$
begin
  if public.is_admin_team() or auth.role() = 'service_role' then
    return new;
  end if;

  new.role                 := old.role;
  new.verified              := old.verified;
  new.company_verified      := old.company_verified;
  new.status                := old.status;
  new.ban_reason             := old.ban_reason;
  new.ban_until              := old.ban_until;
  new.verification_pending  := old.verification_pending;
  new.admin_notes           := old.admin_notes;

  return new;
end;
$$;

comment on function public.profiles_guard_privileged() is
  'C2B: BEFORE UPDATE trigger on public.profiles. Re-pins role, verified, company_verified, status, ban_reason, ban_until, verification_pending, admin_notes to their prior value unless the caller is admin-team (is_admin_team()) or the trusted service_role. Trigger-only — cannot be invoked directly (return type is trigger) and is not directly EXECUTE-granted.';

drop trigger if exists trg_profiles_guard_privileged on public.profiles;
create trigger trg_profiles_guard_privileged
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged();

-- ── 5. amos_set_integration_credential — restrict to super_admin only.
--       Signature, SECURITY DEFINER, search_path('public','vault'), body
--       structure and error-message style unchanged apart from the guard
--       condition and the message naming the narrower requirement. ─────
create or replace function public.amos_set_integration_credential(
  p_provider     text,
  p_secret_name  text,
  p_secret_value text
)
returns void
language plpgsql
security definer
set search_path = 'public', 'vault'
as $$
declare
  v_secret_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only super_admin can connect AMOS integrations';
  end if;

  select id into v_secret_id from vault.secrets where name = p_secret_name;
  if v_secret_id is null then
    perform vault.create_secret(p_secret_value, p_secret_name, 'AMOS integration credential: ' || p_provider);
  else
    perform vault.update_secret(v_secret_id, p_secret_value);
  end if;

  update public.amos_integrations
  set status = 'connected', credentials_ref = p_secret_name, consecutive_failures = 0, auto_disabled = false, updated_at = now()
  where provider = p_provider;
end;
$$;

comment on function public.amos_set_integration_credential(text, text, text) is
  'C2B: guard narrowed from is_admin_team() to is_super_admin() per admin/docs/permissions.md ("integrations.manage ... belongs only to super_admin"). Signature, SECURITY DEFINER, search_path, and EXECUTE grants unchanged.';

-- Re-assert the known-good ACL explicitly (CREATE OR REPLACE preserves
-- existing grants automatically, but this keeps the migration
-- self-describing and idempotent regardless of prior drift).
revoke execute on function public.amos_set_integration_credential(text, text, text) from public;
revoke execute on function public.amos_set_integration_credential(text, text, text) from anon;
grant  execute on function public.amos_set_integration_credential(text, text, text) to authenticated;
grant  execute on function public.amos_set_integration_credential(text, text, text) to service_role;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- INSPECTION APPENDIX (documentation only — no SQL below this line runs)
--
-- Every live occurrence of role='admin' / role IN (...) / is_admin() /
-- is_admin_team() / is_moderator() was enumerated by fresh introspection
-- before writing this migration. NONE of it is changed by this file. Full
-- classification is in admin/docs/c2b-results.md section 6; the raw counts:
--
--   is_admin()      referenced by 16 other functions, 65 RLS policies
--   is_admin_team() referenced by 11 other functions, 38 RLS policies
--   is_moderator()  referenced by  8 other functions,  5 RLS policies
--   inline role='admin' / role = ANY(array[...]) (no helper call):
--                    5 functions, 16 RLS policies
--
-- All of it is deferred to Stage C2F (grants/RLS cleanup, per table
-- family) per admin/docs/c2-hardening-plan.md. Rewriting any of it now
-- would be exactly the "broad grant or RLS cleanup" this stage is
-- explicitly scoped to avoid.
-- ============================================================
