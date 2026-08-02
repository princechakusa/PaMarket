-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 8 — Rollback
--
-- Unschedules both Module 8 crons and drops the new watchlist table.
-- amos_market_intelligence rows this module wrote are cleared too, since
-- they're clearly attributable by signal_type; amos_market_intelligence
-- itself (Module 0) is NOT dropped.
-- ════════════════════════════════════════════════════════════════════════

select cron.unschedule(jobid) from cron.job where jobname in ('amos-trending-search-runner-daily','amos-competitor-tracker-weekly');

DELETE FROM amos_market_intelligence WHERE signal_type IN ('competitor') AND raw->>'source' = 'amos_module_8';
DELETE FROM amos_market_intelligence WHERE signal_type = 'internal_search_gap' AND raw->>'source' = 'amos_module_8_trending';

DROP TABLE IF EXISTS amos_competitor_watchlist CASCADE;
