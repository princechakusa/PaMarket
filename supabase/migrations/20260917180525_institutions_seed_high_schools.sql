-- ============================================================
-- PaMarket Institutions -- initial high school seed, mirroring
-- 20260916170000_institutions_seed_universities.sql exactly (same table,
-- same column set, same idempotent on-conflict pattern, same audit log
-- entry). Populates public.institutions with 20 well-known, currently
-- operating Zimbabwe high schools so the High School side of the
-- Institutions feature isn't empty until an admin adds schools by hand.
-- INITIAL DATA only -- every field seeded here stays fully editable in the
-- Admin Institutions page afterwards, exactly like the university seed.
--
-- Selection: 20 nationally well-known secondary schools spread across
-- provinces (9 Harare, 4 Bulawayo, 2 Manicaland, 2 Mashonaland East, 1
-- Mashonaland West, 1 Masvingo, 1 Midlands), a mix of government and
-- private/church/boarding schools.
--
-- Locations: every row uses an existing provinces/cities row already
-- seeded by 20260909120000_taxonomy_foundation.sql (looked up by
-- code/slug, never invented). `suburb` is free text (not a FK) and is
-- filled in only where a specific, well-known campus suburb/area is
-- confidently known; left null otherwise -- no street addresses or GPS
-- coordinates are invented anywhere in this file, matching the university
-- seed's own rule.
--
-- Idempotent: `on conflict` targets the existing
-- institutions_official_name_city_unique_idx unique index, so re-running
-- this migration is a safe no-op for rows that already exist.
-- ============================================================

insert into public.institutions (type, official_name, short_name, search_aliases, province_id, city_id, suburb, sort_order)
select 'high_school', v.official_name, v.short_name, v.aliases, p.id, c.id, v.suburb, v.sort_order
from (values
  -- Harare
  ('Prince Edward School', 'PE', array['Prince Edward', 'PE School'], 'harare', 'milton-park', null, 0),
  ('Churchill Boys High School', 'Churchill', array['Churchill', 'Churchill High'], 'harare', 'alexandra-park', null, 1),
  ('Girls High School', 'GHS', array['GHS', 'Girls High'], 'harare', 'milton-park', null, 2),
  ('Chisipite Senior School', 'Chisipite', array['Chisipite'], 'harare', 'chisipite', null, 3),
  ('St George''s College', 'SGC', array['St George''s', 'SGC'], 'harare', 'milton-park', null, 4),
  ('Dominican Convent High School', 'Dominican Convent', array['Dominican Convent', 'DC'], 'harare', 'belgravia', null, 5),
  ('Gateway High School', 'Gateway', array['Gateway'], 'harare', 'borrowdale', null, 6),
  ('Allan Wilson High School', 'Allan Wilson', array['Allan Wilson'], 'harare', 'harare-cbd', null, 7),
  ('Mount Pleasant High School', 'Mount Pleasant High', array['Mount Pleasant High'], 'harare', 'mount-pleasant', null, 8),
  -- Bulawayo
  ('Founders High School', 'Founders', array['Founders'], 'bulawayo', 'bulawayo-cbd', null, 9),
  ('Milton High School', 'Milton', array['Milton'], 'bulawayo', 'bulawayo-cbd', null, 10),
  ('Girls'' College', 'Girls College', array['Girls College', 'Girls'' College Bulawayo'], 'bulawayo', 'bulawayo-cbd', null, 11),
  ('Christian Brothers College', 'CBC', array['CBC', 'CBC Bulawayo'], 'bulawayo', 'bulawayo-cbd', null, 12),
  -- Midlands
  ('Chaplin High School', 'Chaplin', array['Chaplin'], 'midlands', 'gweru-cbd', null, 13),
  -- Manicaland
  ('Mutare Boys'' High School', 'Mutare Boys High', array['Mutare Boys High', 'MBHS'], 'manicaland', 'mutare-cbd', null, 14),
  ('Hartzell High School', 'Hartzell', array['Hartzell'], 'manicaland', 'mutare-cbd', 'Old Mutare', 15),
  -- Masvingo
  ('Victoria High School', 'Victoria High', array['Victoria High'], 'masvingo', 'masvingo-cbd', null, 16),
  -- Mashonaland West
  ('Kutama College', 'Kutama', array['Kutama'], 'mashonaland-west', 'zvimba', null, 17),
  -- Mashonaland East
  ('Peterhouse Boys'' School', 'Peterhouse', array['Peterhouse', 'Peterhouse Boys'], 'mashonaland-east', 'marondera', null, 18),
  ('Watershed College', 'Watershed', array['Watershed'], 'mashonaland-east', 'marondera', null, 19)
) as v(official_name, short_name, aliases, province_code, city_slug, suburb, sort_order)
join public.provinces p on p.code = v.province_code and p.country_code = 'ZW'
join public.cities c on c.slug = v.city_slug and c.province_id = p.id
on conflict ((lower(official_name)), city_id) do nothing;

insert into public.admin_audit_logs (action, entity, entity_id, after_state, reason)
select 'seed_institutions', 'institutions', null,
  jsonb_build_object('institutions', (select count(*) from public.institutions)),
  'Institutions: seeded 20 well-known, currently operating Zimbabwe high schools (9 Harare, 4 Bulawayo, 2 Manicaland, 2 Mashonaland East, 1 each Mashonaland West/Masvingo/Midlands) so the High School side of the Institutions feature has real data. All fields remain fully editable in the Admin Institutions page afterwards; this is initial data only, mirroring the existing university seed (20260916170000).'
where exists (select 1 from public.institutions limit 1);
