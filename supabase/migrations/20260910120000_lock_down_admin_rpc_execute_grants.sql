-- ============================================================
-- PaMarket — Stage C2A: lock down EXECUTE on admin-only SECURITY DEFINER RPCs
--
-- Source of truth for scope + evidence:
--   admin/docs/c2-hardening-plan.md   (Stage C2 plan, section 5 / C2A)
--   admin/docs/c2-verify-results.md   (Stage C2-VERIFY live verification, sections 6/7/14)
--
-- WHAT / WHY
--   C2-VERIFY confirmed (live, project gxgytumhknmnwspxjzxw, 2026-09-10) that the
--   public schema has 173 SECURITY DEFINER functions, 94 of them executable by the
--   anon role and 80 by PUBLIC. This migration is the smallest safe first step: it
--   removes direct anon / PUBLIC EXECUTE from a 7-function subset that
--     (a) is admin-only by intent,
--     (b) already carries an internal authorization guard
--         (is_admin_team() for the analytics RPCs; auth.uid() row-scope for
--          get_my_mfa_secret()), so revoking the grant cannot expose anything that
--          was reachable before, and
--     (c) has exactly ONE caller in the entire repo — www/admin.html — which
--         invokes them only through an authenticated admin Supabase session, after
--         its role gate. No apps/mobile, other www/*.html, or supabase/functions
--         code references any of them (verified by grep, C2-VERIFY section 7).
--
--   Each function's current ACL (live) is:
--       =X/postgres            -> PUBLIC has EXECUTE
--       postgres=X/postgres
--       anon=X/postgres
--       authenticated=X/postgres
--       service_role=X/postgres
--
--   After this migration:
--       PUBLIC          -> no EXECUTE
--       anon            -> no EXECUTE
--       authenticated   -> EXECUTE   (kept; www/admin.html depends on it)
--       service_role    -> EXECUTE   (kept; server/back-office use)
--       postgres/owner  -> EXECUTE   (implicit; unchanged)
--
-- SCOPE GUARANTEE
--   Touches ONLY the 7 functions listed below, and ONLY their EXECUTE grants.
--   No function body, signature, search_path, volatility, RLS policy, table grant,
--   role helper, Edge Function, or app code is changed by this file.
--
-- IDEMPOTENCY
--   REVOKE of an absent grant and GRANT of an existing grant are both no-ops in
--   PostgreSQL, so this file is safe to run more than once. A pre-check aborts the
--   whole transaction (no partial application) if any target function is missing
--   or its signature has drifted from what C2-VERIFY recorded.
--
-- APPLICATION
--   Applied manually against the linked project via `supabase db query --linked`,
--   consistent with this repo's existing hand-run SQL files (the ordered
--   supabase_migrations ledger is known to be incomplete — see c2-verify-results.md
--   section 3). This file is NOT recorded in supabase_migrations.schema_migrations.
--   Do NOT run `supabase db push` against this project without first reconciling
--   that ledger.
--
-- ROLLBACK
--   supabase/migrations/20260910120000_lock_down_admin_rpc_execute_grants_ROLLBACK.sql
-- ============================================================

begin;

-- ── Pre-check: every target function must exist with the exact signature
--    C2-VERIFY recorded. Abort the entire migration otherwise. ──────────
do $preflight$
declare
  missing text[] := array[]::text[];
  targets text[] := array[
    'admin_revenue_summary(integer)',
    'admin_category_breakdown()',
    'admin_province_breakdown()',
    'admin_daily_growth(integer)',
    'admin_cohorts(integer)',
    'admin_top_payers(integer, integer)',
    'get_my_mfa_secret()'
  ];
  t text;
begin
  foreach t in array targets loop
    if to_regprocedure('public.' || t) is null then
      missing := array_append(missing, t);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'C2A abort: target function(s) missing or signature drift: %',
      array_to_string(missing, ', ');
  end if;
end
$preflight$;

-- ── 1. admin_revenue_summary(days integer) — SECURITY DEFINER, internal
--       `IF NOT is_admin_team() THEN RAISE` guard. Admin revenue dashboard. ──
revoke execute on function public.admin_revenue_summary(integer) from public;
revoke execute on function public.admin_revenue_summary(integer) from anon;
grant  execute on function public.admin_revenue_summary(integer) to authenticated;
grant  execute on function public.admin_revenue_summary(integer) to service_role;

-- ── 2. admin_category_breakdown() — SECURITY DEFINER, admin analytics RPC. ──
revoke execute on function public.admin_category_breakdown() from public;
revoke execute on function public.admin_category_breakdown() from anon;
grant  execute on function public.admin_category_breakdown() to authenticated;
grant  execute on function public.admin_category_breakdown() to service_role;

-- ── 3. admin_province_breakdown() — SECURITY DEFINER, admin analytics RPC. ──
revoke execute on function public.admin_province_breakdown() from public;
revoke execute on function public.admin_province_breakdown() from anon;
grant  execute on function public.admin_province_breakdown() to authenticated;
grant  execute on function public.admin_province_breakdown() to service_role;

-- ── 4. admin_daily_growth(days integer) — SECURITY DEFINER, admin analytics RPC. ──
revoke execute on function public.admin_daily_growth(integer) from public;
revoke execute on function public.admin_daily_growth(integer) from anon;
grant  execute on function public.admin_daily_growth(integer) to authenticated;
grant  execute on function public.admin_daily_growth(integer) to service_role;

-- ── 5. admin_cohorts(weeks integer) — SECURITY DEFINER, cohort retention RPC
--       (www/admin.html Analytics Center). ──
revoke execute on function public.admin_cohorts(integer) from public;
revoke execute on function public.admin_cohorts(integer) from anon;
grant  execute on function public.admin_cohorts(integer) to authenticated;
grant  execute on function public.admin_cohorts(integer) to service_role;

-- ── 6. admin_top_payers(days integer, lim integer) — SECURITY DEFINER,
--       top-payers ranking (www/admin.html Finance/Analytics). ──
revoke execute on function public.admin_top_payers(integer, integer) from public;
revoke execute on function public.admin_top_payers(integer, integer) from anon;
grant  execute on function public.admin_top_payers(integer, integer) to authenticated;
grant  execute on function public.admin_top_payers(integer, integer) to service_role;

-- ── 7. get_my_mfa_secret() — SECURITY DEFINER, body is
--       `select mfa_secret from public.profiles where id = auth.uid()`
--       (row-scoped to the caller). anon/PUBLIC can never get a row, so the grant
--       is pure unnecessary surface. www/admin.html calls it post-auth-gate. ──
revoke execute on function public.get_my_mfa_secret() from public;
revoke execute on function public.get_my_mfa_secret() from anon;
grant  execute on function public.get_my_mfa_secret() to authenticated;
grant  execute on function public.get_my_mfa_secret() to service_role;

-- PostgREST caches the function catalogue; tell it to reload so the removed
-- anon grant takes effect for REST RPC calls immediately.
notify pgrst, 'reload schema';

commit;

-- ── Post-apply verification (run separately, read-only) ──────────────────
--   select p.proname,
--          pg_get_function_identity_arguments(p.oid) as args,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_exec,
--          has_function_privilege('public',        p.oid, 'EXECUTE') as public_exec,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') as service_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('admin_revenue_summary','admin_category_breakdown',
--                       'admin_province_breakdown','admin_daily_growth',
--                       'admin_cohorts','admin_top_payers','get_my_mfa_secret')
--   order by p.proname;
--   -- expect: anon_exec = f, public_exec = f, auth_exec = t, service_exec = t
