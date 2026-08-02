-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 9 — Rollback
--
-- Drops amos_countries and the country_code columns added to
-- amos_zw_calendar/amos_competitor_watchlist. Safe: both columns default
-- to 'ZW' and nothing outside this module reads them yet, so dropping
-- them just returns those two tables to their pre-Module-9 shape. Does
-- NOT touch the amos_settings rows seeded for future markets (harmless
-- to leave — every function still only ever operates on country_code=
-- 'ZW' unless explicitly changed).
-- ════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS amos_countries CASCADE;

ALTER TABLE amos_zw_calendar DROP COLUMN IF EXISTS country_code;
ALTER TABLE amos_competitor_watchlist DROP COLUMN IF EXISTS country_code;

-- To also remove the seeded future-market settings rows (optional, NOT
-- run automatically):
--   delete from amos_settings where country_code != 'ZW';
