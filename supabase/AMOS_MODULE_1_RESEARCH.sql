-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 1: Market Intelligence / Research (foundation)
--
-- Run manually in the Supabase SQL Editor, after AMOS_MODULE_0_FOUNDATION.sql.
-- Idempotent + additive.
--
-- Adds a small Zimbabwe calendar reference table that the
-- amos-research-runner edge function reads to generate upcoming-event
-- signals into amos_market_intelligence (already exists from Module 0 —
-- no changes needed there). No external API calls are introduced by this
-- module: the two signal sources it ships are internal search_logs
-- zero-result gaps (already collected by both the website and the RN app)
-- and this static/recurring calendar.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS amos_zw_calendar (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     text NOT NULL CHECK (event_type IN ('public_holiday','school_term_start','school_term_end','salary_period')),
  event_date     date NOT NULL,
  label          text NOT NULL,
  category_hint  text,             -- free-text nudge for the content generator, e.g. 'apparel,gifts'
  recurs_yearly  boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_calendar_date ON amos_zw_calendar (event_date);
ALTER TABLE amos_zw_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_calendar team" ON amos_zw_calendar;
CREATE POLICY "amos_calendar team" ON amos_zw_calendar FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- Seed: 2026 Zimbabwe public holidays. recurs_yearly=true means the research
-- runner treats event_date's month/day as repeating every year, so this
-- seed keeps working in 2027+ without re-seeding (it only needs new rows
-- for holidays whose date genuinely moves year to year, e.g. Easter).
INSERT INTO amos_zw_calendar (event_type, event_date, label, category_hint, recurs_yearly) VALUES
  ('public_holiday','2026-01-01','New Year''s Day','gifts,electronics,apparel', true),
  ('public_holiday','2026-02-21','Robert Gabriel Mugabe National Youth Day','apparel,electronics', true),
  ('public_holiday','2026-04-03','Good Friday','travel,groceries', false),
  ('public_holiday','2026-04-06','Easter Monday','travel,groceries', false),
  ('public_holiday','2026-04-18','Independence Day','flags,decor,apparel', true),
  ('public_holiday','2026-05-01','Workers'' Day','leisure,electronics', true),
  ('public_holiday','2026-05-25','Africa Day','apparel,decor', true),
  ('public_holiday','2026-08-10','Heroes'' Day','apparel,decor', true),
  ('public_holiday','2026-08-11','Defence Forces Day','apparel,decor', true),
  ('public_holiday','2026-12-22','Unity Day','apparel,decor', true),
  ('public_holiday','2026-12-25','Christmas Day','gifts,electronics,apparel,groceries', true),
  ('public_holiday','2026-12-26','Boxing Day','gifts,electronics,apparel', true)
ON CONFLICT DO NOTHING;

-- Seed: approximate 2026 Zimbabwe school term boundaries (three-term year).
-- Actual Ministry of Education dates shift slightly year to year — treat
-- these as a reasonable default, adjustable by hand in this table.
INSERT INTO amos_zw_calendar (event_type, event_date, label, category_hint, recurs_yearly) VALUES
  ('school_term_start','2026-01-13','Term 1 opens','school supplies,uniforms,stationery', false),
  ('school_term_end','2026-04-09','Term 1 closes','', false),
  ('school_term_start','2026-05-05','Term 2 opens','school supplies,uniforms,stationery', false),
  ('school_term_end','2026-08-14','Term 2 closes','', false),
  ('school_term_start','2026-09-08','Term 3 opens','school supplies,uniforms,stationery', false),
  ('school_term_end','2026-12-04','Term 3 closes','', false)
ON CONFLICT DO NOTHING;

-- Seed: typical Zimbabwe salary/payday windows — most formal-sector pay
-- lands month-end, with a secondary mid-month (25th) cluster for some
-- employers/pensions. Recurs monthly in spirit; modeled here as the 25th
-- and last-day-of-month for every month of 2026 so the runner's "within N
-- days" lookahead has concrete dates to compare against without needing
-- date-math for month-end in the query itself.
INSERT INTO amos_zw_calendar (event_type, event_date, label, category_hint, recurs_yearly)
SELECT 'salary_period', d::date, 'Mid-month payday window', 'electronics,apparel,groceries', true
FROM generate_series('2026-01-25'::date, '2026-12-25'::date, interval '1 month') AS d
ON CONFLICT DO NOTHING;

INSERT INTO amos_zw_calendar (event_type, event_date, label, category_hint, recurs_yearly)
SELECT 'salary_period', (date_trunc('month', d) + interval '1 month' - interval '1 day')::date, 'Month-end payday window', 'electronics,apparel,groceries', true
FROM generate_series('2026-01-01'::date, '2026-12-01'::date, interval '1 month') AS d
ON CONFLICT DO NOTHING;
