-- ============================================================
-- PaMarket Institutions — Production Readiness: initial university seed.
-- Populates public.institutions (Phase 1, 20260916120000) with Zimbabwe's
-- ZIMCHE-registered, currently operating universities, so the feature is
-- immediately usable by students without an admin manually creating every
-- institution by hand first. This is INITIAL DATA only -- the Admin
-- Institutions page (Phase 2) remains the ongoing source of truth; every
-- field seeded here (name, province, city, suburb, active status, logo)
-- stays fully editable there afterwards, exactly like any admin-created row.
--
-- Source: Zimbabwe Council for Higher Education (ZIMCHE, https://zimche.ac.zw/)
-- registered-institutions listing, cross-checked against the Ministry of
-- Higher and Tertiary Education's published state-university list and
-- Wikipedia's "List of universities in Zimbabwe". 20 universities seeded:
-- 13 public/state + 7 private/church-run, all confirmed as currently
-- registered and operating (i.e. actively enrolling/teaching students).
--
-- Explicitly EXCLUDED from this seed (documented, not silently dropped):
--   - University of Matopo / University of Matopos -- ZIMCHE provisional
--     registration only, not a fully operating university.
--   - Kemet University / "St. Keene University" -- provisional / awaiting
--     registration per ZIMCHE, not confirmed operating.
--   - The Pan African University of Mineral Processing (PAUMP) -- appears
--     on ZIMCHE's registered list, but independent sources (Herald: "Minerals
--     varsity takes shape") describe its campus as still under construction
--     with no confirmed student intake; excluded pending confirmation it is
--     actually enrolling. Flagged as a follow-up, not a guess.
--   - "Regent Crest University" -- surfaced once during source-checking but
--     could not be corroborated by any second independent source (ZIMCHE's
--     own site, Ministry list, or Wikipedia); excluded rather than guessed.
--
-- Locations: every row uses an existing provinces/cities row already seeded
-- by 20260909120000_taxonomy_foundation.sql (looked up by code/slug, never
-- invented). `suburb` is free text (not a FK) and is filled in only where a
-- specific, well-sourced campus suburb is known; no street addresses or GPS
-- coordinates are invented anywhere in this file, per the implementation
-- brief. Universities with multiple campuses use their main/primary campus.
--
-- Idempotent: `on conflict` targets the existing
-- institutions_official_name_city_unique_idx unique index, so re-running
-- this migration is a safe no-op for rows that already exist.
-- ============================================================

insert into public.institutions (type, official_name, short_name, search_aliases, province_id, city_id, suburb, sort_order)
select 'university', v.official_name, v.short_name, v.aliases, p.id, c.id, v.suburb, v.sort_order
from (values
  -- Harare (public)
  ('University of Zimbabwe', 'UZ', array['UZ', 'Uni of Zim'], 'harare', 'mount-pleasant', null, 0),
  ('Harare Institute of Technology', 'HIT', array['HIT'], 'harare', 'belvedere', null, 1),
  ('Zimbabwe Open University', 'ZOU', array['ZOU'], 'harare', 'harare-cbd', null, 2),
  ('Zimbabwe National Defence University', 'ZNDU', array['ZNDU'], 'harare', 'harare-cbd', 'Old Mazowe Road', 3),
  -- Harare (private)
  ('Catholic University of Zimbabwe', 'CUZ', array['CUZ'], 'harare', 'hatfield', null, 4),
  ('Arrupe Jesuit University', 'AJU', array['AJU'], 'harare', 'mount-pleasant', null, 5),
  ('Women''s University in Africa', 'WUA', array['WUA'], 'harare', 'avondale', null, 6),
  -- Bulawayo / Matabeleland
  ('National University of Science and Technology', 'NUST', array['NUST'], 'bulawayo', 'bulawayo-cbd', null, 7),
  ('Solusi University', 'Solusi', array['Solusi'], 'matabeleland-north', 'umguza', '~50km west of Bulawayo', 8),
  ('Lupane State University', 'LSU', array['LSU'], 'matabeleland-north', 'lupane', null, 9),
  ('Gwanda State University', 'GSU', array['GSU'], 'matabeleland-south', 'gwanda', null, 10),
  -- Midlands
  ('Midlands State University', 'MSU', array['MSU'], 'midlands', 'gweru-cbd', null, 11),
  -- Mashonaland West
  ('Chinhoyi University of Technology', 'CUT', array['CUT'], 'mashonaland-west', 'chinhoyi', null, 12),
  -- Mashonaland Central
  ('Bindura University of Science Education', 'BUSE', array['BUSE'], 'mashonaland-central', 'bindura', null, 13),
  ('Zimbabwe Ezekiel Guti University', 'ZEGU', array['ZEGU'], 'mashonaland-central', 'bindura', 'Barrassie Road', 14),
  -- Masvingo
  ('Great Zimbabwe University', 'GZU', array['GZU'], 'masvingo', 'masvingo-cbd', null, 15),
  ('Reformed Church University', 'RCU', array['RCU'], 'masvingo', 'masvingo-cbd', 'Riebeek Farm, Bulawayo Road', 16),
  -- Mashonaland East
  ('Marondera University of Agricultural Sciences and Technology', 'MUAST', array['MUAST'], 'mashonaland-east', 'marondera', null, 17),
  -- Manicaland
  ('Manicaland State University of Applied Sciences', 'MSUAS', array['MSUAS'], 'manicaland', 'mutare-cbd', 'Fern Hill', 18),
  ('Africa University', 'AU', array['AU'], 'manicaland', 'mutare-cbd', 'Old Mutare', 19)
) as v(official_name, short_name, aliases, province_code, city_slug, suburb, sort_order)
join public.provinces p on p.code = v.province_code and p.country_code = 'ZW'
join public.cities c on c.slug = v.city_slug and c.province_id = p.id
on conflict ((lower(official_name)), city_id) do nothing;

insert into public.admin_audit_logs (action, entity, entity_id, after_state, reason)
select 'seed_institutions', 'institutions', null,
  jsonb_build_object('institutions', (select count(*) from public.institutions)),
  'Institutions Production Readiness: seeded 20 ZIMCHE-registered, currently operating Zimbabwe universities (13 public + 7 private), cross-checked against the Ministry of Higher and Tertiary Education list and Wikipedia. Provisional/non-operating institutions (University of Matopo, Kemet/St. Keene University, PAUMP under construction) and one unverifiable name (Regent Crest University) were deliberately excluded -- see migration header. All fields remain fully editable in the Admin Institutions page afterwards; this is initial data only, not a locked/special record type.'
where exists (select 1 from public.institutions limit 1);
