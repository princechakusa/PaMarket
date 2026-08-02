-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 1 — Rollback
--
-- Safe at any point: amos_zw_calendar is new and Module-1-only. Rows this
-- module's edge function wrote into amos_market_intelligence (Module 0)
-- are also cleaned up, but amos_market_intelligence itself is NOT dropped
-- (it belongs to Module 0). Run manually in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

DELETE FROM amos_market_intelligence
  WHERE signal_type IN ('internal_search_gap','public_holiday','school_term','salary_period');

DROP TABLE IF EXISTS amos_zw_calendar CASCADE;
