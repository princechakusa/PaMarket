-- ============================================================
-- ROLLBACK for 20260911090000_profiles_privileged_column_guard_and_role_hierarchy.sql
--
-- Restores the exact pre-C2B state:
--   - drops the trigger and its trigger function from public.profiles
--     (profiles reverts to exactly the two pre-C2B triggers:
--      profiles_set_updated_at, trg_log_role_change)
--   - drops the three new helper functions (role_rank, is_super_admin,
--     has_admin_privilege) — nothing else in the schema references them,
--     since this migration is the only thing that created them
--   - restores amos_set_integration_credential's guard to is_admin_team(),
--     with the exact pre-C2B body, signature, SECURITY DEFINER status,
--     search_path, and EXECUTE grants
--
-- Touches nothing else. Idempotent. Apply the same way as the forward
-- migration (`supabase db query --linked -f <this file>`) only if C2B must
-- be reverted after being applied.
-- ============================================================

begin;

-- ── 1. Remove the privileged-column guard trigger ───────────────────
drop trigger if exists trg_profiles_guard_privileged on public.profiles;
drop function if exists public.profiles_guard_privileged();

-- ── 2. Restore amos_set_integration_credential to its pre-C2B body ──
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
DECLARE
  v_secret_id uuid;
BEGIN
  IF NOT is_admin_team() THEN
    RAISE EXCEPTION 'Only admin-team members can connect AMOS integrations';
  END IF;

  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = p_secret_name;
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(p_secret_value, p_secret_name, 'AMOS integration credential: ' || p_provider);
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_secret_value);
  END IF;

  UPDATE amos_integrations
  SET status = 'connected', credentials_ref = p_secret_name, consecutive_failures = 0, auto_disabled = false, updated_at = now()
  WHERE provider = p_provider;
END;
$$;

comment on function public.amos_set_integration_credential(text, text, text) is null;

revoke execute on function public.amos_set_integration_credential(text, text, text) from public;
revoke execute on function public.amos_set_integration_credential(text, text, text) from anon;
grant  execute on function public.amos_set_integration_credential(text, text, text) to authenticated;
grant  execute on function public.amos_set_integration_credential(text, text, text) to service_role;

-- ── 3. Drop the new role-hierarchy helpers (C2B-only, nothing else
--       references them) ────────────────────────────────────────────
drop function if exists public.has_admin_privilege(text);
drop function if exists public.is_super_admin();
drop function if exists public.role_rank(text);

notify pgrst, 'reload schema';

commit;
