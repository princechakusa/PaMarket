-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 9: Multi-Country Expansion Support
--
-- Run manually in the Supabase SQL Editor, after Modules 0-8. Additive
-- only.
--
-- Audit performed before writing this file: checked every real amos_*
-- table (15 across Modules 0-8) for country_code. Most tables that lack
-- it are fine as-is — they link back to amos_content_items or
-- amos_schedule (both already country-aware) via foreign key, so country
-- is always inferable through a join; duplicating the column onto every
-- child table would just be redundant denormalization. amos_integrations
-- and amos_manual_trigger_log are correctly global (a Facebook Page
-- connection or a rate-limit counter isn't per-country).
--
-- Two tables were a genuine gap, found during this audit:
--   - amos_zw_calendar: literally named for Zimbabwe, no country
--     dimension at all — cannot represent a second market's holidays/
--     school terms/salary periods without this fix.
--   - amos_competitor_watchlist: competitors are inherently
--     country-specific (a Zambian competitor isn't relevant to
--     Zimbabwe operations) but nothing distinguished them.
--
-- This migration is schema-only. It does NOT populate real Zambia/
-- Malawi/Botswana/Namibia/Mozambique/South Africa data — that's real
-- business/calendar/competitor knowledge only a human has for each
-- market, exactly the same "don't fabricate" principle applied to every
-- other external-data gap so far. What this DOES do: make the schema
-- capable of holding a second country's data the moment it's provided,
-- and add the admin panel's country selector so switching between
-- markets is a filter, not a rebuild.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE amos_zw_calendar ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'ZW';
CREATE INDEX IF NOT EXISTS idx_amos_calendar_country ON amos_zw_calendar (country_code, event_date);

ALTER TABLE amos_competitor_watchlist ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'ZW';
CREATE INDEX IF NOT EXISTS idx_amos_competitor_country ON amos_competitor_watchlist (country_code, active);

-- Registry of markets AMOS is aware of, driving the admin panel's country
-- selector. Seeded with Zimbabwe (active) and the architecture's stated
-- future markets (inactive — a market only becomes selectable once an
-- admin explicitly activates it, which should only happen once that
-- market actually has calendar/settings data, not by default).
CREATE TABLE IF NOT EXISTS amos_countries (
  country_code text PRIMARY KEY,
  name         text NOT NULL,
  active       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amos_countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_countries team" ON amos_countries;
CREATE POLICY "amos_countries team" ON amos_countries FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

INSERT INTO amos_countries (country_code, name, active) VALUES
  ('ZW', 'Zimbabwe', true),
  ('ZM', 'Zambia', false),
  ('MW', 'Malawi', false),
  ('BW', 'Botswana', false),
  ('NA', 'Namibia', false),
  ('MZ', 'Mozambique', false),
  ('ZA', 'South Africa', false)
ON CONFLICT (country_code) DO NOTHING;

-- amos_settings is already keyed by country_code (Module 0's PRIMARY KEY
-- IS country_code) — seed a row for each future market too, inactive
-- settings that simply won't be used by any function until that
-- country's amos_countries row is flipped active. No code change needed
-- for this: every amos-* function already scopes its work by
-- country_code='ZW' explicitly today; expanding to a second market is
-- swapping that literal for a loop/parameter, not a schema change.
INSERT INTO amos_settings (country_code) VALUES ('ZM'), ('MW'), ('BW'), ('NA'), ('MZ'), ('ZA')
  ON CONFLICT (country_code) DO NOTHING;
