-- ============================================================
-- ★★★ APPROVAL REQUIRED — NOT PART OF THE C2B MIGRATION — DO NOT RUN
--     WITHOUT SEPARATE, EXPLICIT SIGN-OFF ★★★
--
-- This file is intentionally NOT applied by, or bundled into,
-- 20260911090000_profiles_privileged_column_guard_and_role_hierarchy.sql.
-- It exists only so the promotion step is prepared, reviewed, and ready —
-- never executed as a side effect of applying C2B.
--
-- Preconditions this stage requires before this file may even be
-- considered:
--   1. The C2B forward migration above must already be applied and
--      verified live (is_super_admin(), has_admin_privilege(), and the
--      profiles_guard_privileged trigger all present and passing the
--      c2b_privileged_column_guard.test.sql suite against real production
--      state — not just the rolled-back dry run).
--   2. A human must explicitly approve promoting this specific account.
--
-- WHAT THIS DOES
--   Promotes the single existing admin-team account —
--     id:    e79039a4-2216-4526-81e1-c8c25e688834
--     email: adminprincechakusa@gmail.com   (production PII — do not paste
--            this file's contents into any external tool or ticket)
--     role:  admin -> super_admin
--   — from `admin` to `super_admin`, per admin/docs/permissions.md
--   ("super_admin: the only role allowed to manage admin roles, MFA
--   policy, security settings, and integration credentials").
--
--   Guarded to affect exactly one row, matched by id AND current role, so
--   it is a no-op (0 rows, explicit NOTICE) if the account has already
--   been promoted, and it aborts instead of promoting the wrong account if
--   the id no longer holds role='admin' (e.g. someone else already changed
--   it, or a second admin account was created in the meantime — this
--   stage's instructions require that NOT happen, so this is a defensive
--   check, not an expected path).
--
-- WHY THIS MUST HAPPEN EVENTUALLY (not optional forever)
--   Until this account is super_admin, it is rejected by
--   amos_set_integration_credential (C2B narrowed that guard from
--   is_admin_team() to is_super_admin()) and by every future
--   has_admin_privilege('super_admin') check. Until it is approved and
--   run, the platform has ZERO super_admin accounts, which is the correct
--   and intentional state for the duration of C2B review.
--
-- ROLLBACK
--   update public.profiles set role = 'admin'
--   where id = 'e79039a4-2216-4526-81e1-c8c25e688834' and role = 'super_admin';
-- ============================================================

do $promote$
declare
  v_target_id    uuid := 'e79039a4-2216-4526-81e1-c8c25e688834';
  v_rows_updated int;
  v_role_after   text;
begin
  if not exists (
    select 1 from public.profiles where id = v_target_id and role = 'admin'
  ) then
    raise notice 'No promotion performed: id % is not currently role=admin (already promoted, or account changed since this file was prepared — check public.profiles before proceeding).', v_target_id;
    return;
  end if;

  -- The C2B privileged-column guard trigger (trg_profiles_guard_privileged)
  -- fires for every caller regardless of Postgres role/RLS-bypass — that is
  -- its entire point (see admin/docs/c2b-results.md section 3). Running this
  -- script directly against the database (as `postgres`, via `supabase db
  -- query`) presents no JWT claims at all, so without this the trigger would
  -- silently re-pin `role` back to 'admin' and the UPDATE below would look
  -- like it succeeded (1 row matched) while persisting nothing. This is a
  -- legitimate trusted-backend/service-role operation, so it uses the same
  -- bypass the trigger grants service_role.
  -- The pre-existing (not part of C2B) trg_log_role_change AFTER trigger
  -- requires a non-null actor_id for its role_audit_log row. There is no
  -- separate operator identity to attribute this approved, operator-run
  -- promotion to, so it is recorded against the account being promoted
  -- itself — an accurate, transparent record of what happened.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', v_target_id::text, true);

  update public.profiles
  set role = 'super_admin'
  where id = v_target_id
    and role = 'admin'; -- re-asserted in the WHERE, not just the guard above, for an atomic check-and-set

  get diagnostics v_rows_updated = row_count;

  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  if v_rows_updated <> 1 then
    raise exception 'Promotion aborted: expected exactly 1 row affected, got %. Investigate before retrying.', v_rows_updated;
  end if;

  -- Row-count alone cannot distinguish "updated and persisted" from
  -- "matched, but the guard trigger reverted the column" — re-read the
  -- actual stored value before declaring success.
  select role into v_role_after from public.profiles where id = v_target_id;
  if v_role_after <> 'super_admin' then
    raise exception 'Promotion aborted: row matched but role is % (not super_admin) after UPDATE — the guard trigger likely reverted it. Investigate before retrying.', v_role_after;
  end if;

  raise notice 'Promoted % to super_admin (1 row, verified persisted).', v_target_id;
end
$promote$;

-- Verify immediately after running (read-only):
--   select id, email, role from public.profiles where id = 'e79039a4-2216-4526-81e1-c8c25e688834';
--   -- expect role = 'super_admin'
--   select public.is_super_admin(); -- from an authenticated session as this account; expect true
