-- ============================================================
-- ROLLBACK for 20260910120000_lock_down_admin_rpc_execute_grants.sql
--
-- Restores the pre-C2A EXECUTE grants for the 7 target functions ONLY:
--   PUBLIC, anon, authenticated, service_role all regain EXECUTE — i.e. the
--   exact ACL captured live before C2A:
--       =X/postgres ; postgres=X/postgres ; anon=X/postgres ;
--       authenticated=X/postgres ; service_role=X/postgres
--
-- Apply ONLY if C2A must be reverted (e.g. an unexpected anon/PUBLIC caller
-- surfaces). Touches nothing else. Idempotent. Same manual application path as
-- the forward migration (`supabase db query --linked`).
-- ============================================================

begin;

-- admin_revenue_summary(days integer)
grant execute on function public.admin_revenue_summary(integer) to public;
grant execute on function public.admin_revenue_summary(integer) to anon;
grant execute on function public.admin_revenue_summary(integer) to authenticated;
grant execute on function public.admin_revenue_summary(integer) to service_role;

-- admin_category_breakdown()
grant execute on function public.admin_category_breakdown() to public;
grant execute on function public.admin_category_breakdown() to anon;
grant execute on function public.admin_category_breakdown() to authenticated;
grant execute on function public.admin_category_breakdown() to service_role;

-- admin_province_breakdown()
grant execute on function public.admin_province_breakdown() to public;
grant execute on function public.admin_province_breakdown() to anon;
grant execute on function public.admin_province_breakdown() to authenticated;
grant execute on function public.admin_province_breakdown() to service_role;

-- admin_daily_growth(days integer)
grant execute on function public.admin_daily_growth(integer) to public;
grant execute on function public.admin_daily_growth(integer) to anon;
grant execute on function public.admin_daily_growth(integer) to authenticated;
grant execute on function public.admin_daily_growth(integer) to service_role;

-- admin_cohorts(weeks integer)
grant execute on function public.admin_cohorts(integer) to public;
grant execute on function public.admin_cohorts(integer) to anon;
grant execute on function public.admin_cohorts(integer) to authenticated;
grant execute on function public.admin_cohorts(integer) to service_role;

-- admin_top_payers(days integer, lim integer)
grant execute on function public.admin_top_payers(integer, integer) to public;
grant execute on function public.admin_top_payers(integer, integer) to anon;
grant execute on function public.admin_top_payers(integer, integer) to authenticated;
grant execute on function public.admin_top_payers(integer, integer) to service_role;

-- get_my_mfa_secret()
grant execute on function public.get_my_mfa_secret() to public;
grant execute on function public.get_my_mfa_secret() to anon;
grant execute on function public.get_my_mfa_secret() to authenticated;
grant execute on function public.get_my_mfa_secret() to service_role;

notify pgrst, 'reload schema';

commit;
