-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 8: Advanced Market Intelligence
--
-- Run manually in the Supabase SQL Editor, after Modules 0-7. Additive
-- only.
--
-- Two real, buildable-today capabilities, deepening Module 1's research
-- rather than just relabeling it:
--   1. Trending-search detection — not just zero-result gaps (Module 1),
--      but genuine velocity: a term whose search volume this week is
--      meaningfully higher than its own recent baseline, REGARDLESS of
--      whether it currently has results. A rising term with results is
--      still a real signal (a category worth a content push); Module 1
--      only ever looked at zero/low-result terms.
--   2. Supply-gap detection — categories where recent search demand
--      clearly outstrips active listing supply, a sharper, ratio-based
--      version of Module 7's blunt "fewer than 3 listings" thin-category
--      check.
--
-- Explicitly NOT built in this module, and flagged rather than faked:
-- Google Trends (no official API), Reddit/news scraping (no scraping
-- infrastructure or credential in this project), automated competitor
-- monitoring (no defined target list — competitor identity is business
-- knowledge only a human has). For competitors, this migration adds a
-- simple admin-maintained watchlist table instead: the admin names real
-- competitors once, and amos-competitor-tracker (Module 8's second
-- function) turns that into structured amos_market_intelligence rows on
-- a schedule, rather than AMOS guessing who PaMarket's competitors are.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS amos_competitor_watchlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  website_url  text,
  notes        text,          -- free text: what they do differently, pricing, etc. — admin-maintained
  active       boolean NOT NULL DEFAULT true,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amos_competitor_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_competitor_watchlist team" ON amos_competitor_watchlist;
CREATE POLICY "amos_competitor_watchlist team" ON amos_competitor_watchlist FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- No amos_market_intelligence schema changes needed — 'competitor' is
-- already a valid signal_type from Module 0.

-- ── Scheduling ────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_secret_id uuid;
begin
  select id into v_secret_id from vault.secrets where name = 'automation_secret';
  if v_secret_id is null then
    perform vault.create_secret('REPLACE_WITH_YOUR_AUTOMATION_SECRET', 'automation_secret', 'Shared secret for automation-runner and amos-* edge functions');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'amos-advanced-intelligence-daily';
select cron.unschedule(jobid) from cron.job where jobname = 'amos-competitor-tracker-weekly';

-- Daily 06:15 UTC — between the research runner (06:00) and content
-- generator, so trending/supply-gap signals are fresh before generation
-- picks a topic.
select cron.schedule(
  'amos-advanced-intelligence-daily',
  '15 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-advanced-intelligence',
    headers := jsonb_build_object('Content-Type','application/json','x-automation-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')),
    body := '{}'::jsonb
  );
  $cron$
);

-- Weekly (Mondays 07:15 UTC, alongside the SEO runner) — competitor
-- pricing/positioning doesn't change hour to hour.
select cron.schedule(
  'amos-competitor-tracker-weekly',
  '15 7 * * 1',
  $cron$
  select net.http_post(
    url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-competitor-tracker',
    headers := jsonb_build_object('Content-Type','application/json','x-automation-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'automation_secret')),
    body := '{}'::jsonb
  );
  $cron$
);

-- Verification (run manually):
--   select jobid, jobname, schedule, active from cron.job where jobname like 'amos-advanced%' or jobname like 'amos-competitor%';
--   select * from public.job_runs where job in ('amos_advanced_intelligence','amos_competitor_tracker') order by created_at desc limit 10;
