-- ============================================================================
-- Job-seeker preference columns were unusable: 20260925140400 added them to
-- profiles, but profiles uses column-level grants (20260914180000) and these
-- five were never granted, so every read/save from Jobs → CV Profile returned
-- 403 and preferences never saved (recommend_jobs_for_me had nothing to use).
--
-- Safe to expose to authenticated: RLS still limits SELECT to the owner (or
-- staff) and UPDATE to the owner's own row.
--
-- Idempotent — safe to re-run.
-- ============================================================================

grant select, update (
  preferred_job_type_ids,
  preferred_industry_ids,
  preferred_remote_type,
  salary_expectation_min,
  salary_expectation_max
) on public.profiles to authenticated;

notify pgrst, 'reload schema';
