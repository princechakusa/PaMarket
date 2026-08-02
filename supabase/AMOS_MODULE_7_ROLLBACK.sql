-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 7 — Rollback
--
-- Unschedules the weekly SEO run. Does NOT delete existing
-- amos_seo_recommendations rows (Module 0's table, may still be useful
-- to review even after this module is rolled back). Run manually in the
-- Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

select cron.unschedule(jobid) from cron.job where jobname = 'amos-seo-runner-weekly';

-- To also clear open recommendations (optional, NOT run automatically):
--   delete from amos_seo_recommendations where status = 'open';
