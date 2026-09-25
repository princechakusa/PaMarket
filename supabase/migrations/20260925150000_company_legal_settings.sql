-- ============================================================
-- PaMarket — Company / Legal / Government Settings
-- Extends the existing app_settings.settings.content JSONB block (the same
-- record already used for supportEmail/whatsappNumber/socialLinks, read by
-- js/site-content.js's fetchSiteSettings() and apps/mobile/lib/content.ts's
-- fetchPublicSettings()) with a nested "company" object, instead of
-- creating a new table. RLS for app_settings already enforces public-read /
-- admin-write (see 20260907120000_content_management_foundation.sql: "anon
-- read settings" for anon+authenticated select, "app_settings admin write"
-- gated by public.is_admin() for all writes) — nothing new to add there,
-- this migration only seeds data under the existing policy.
--
-- Fields:
--   legalName            - registered company/trading name shown in footer
--                           and About screens.
--   registrationNumber   - company registration number (Companies and
--                           Other Business Entities Act registration).
--   registeredAddress    - registered business address.
--   regulatoryInfo       - free-text regulatory/compliance statement (e.g.
--                           which authority the platform operates under).
--   legalNotice          - short additional legal notice/disclaimer text,
--                           shown on the About/Legal Hub screens.
--   copyrightHolder      - name used in the "(c) <year> <holder>" line;
--                           defaults to legalName if empty.
--   copyrightStartYear   - the year the copyright notice should start
--                           counting from. Renderers (website footer,
--                           mobile About screen) compute the display value
--                           at runtime: startYear alone if the current year
--                           equals it, otherwise "startYear-currentYear" --
--                           no code change is ever needed to advance the
--                           year.
--
-- Safe to run more than once (guarded by "not already present").
-- ============================================================

update public.app_settings
set settings = jsonb_set(
  settings,
  '{content,company}',
  '{
    "legalName": "PaMarket Zimbabwe (Pvt) Ltd.",
    "registrationNumber": "",
    "registeredAddress": "",
    "regulatoryInfo": "",
    "legalNotice": "",
    "copyrightHolder": "PaMarket Zimbabwe (Pvt) Ltd.",
    "copyrightStartYear": 2026
  }'::jsonb,
  true
),
updated_at = now()
where id = 1
  and not (coalesce(settings->'content', '{}'::jsonb) ? 'company');
