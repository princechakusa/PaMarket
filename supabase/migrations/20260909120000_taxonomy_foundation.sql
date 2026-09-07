-- ============================================================
-- PaMarket — Content Management Stage 4: canonical marketplace taxonomy
-- (categories, provinces, cities). Reuses the same admin-authorization
-- (is_admin()) and audit-log (admin_audit_logs) patterns as the content
-- tables from Stages 1-3. listings.category/province/city stay plain TEXT
-- (per Phase 3: no FK conversion this stage) — these tables are a
-- read/reference layer the admin panel and clients read from; they do not
-- change how listings themselves are stored.
-- Safe to run more than once.
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  legacy_key text not null,
  slug text not null,
  name text not null,
  description text,
  icon text,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  country_code text not null default 'ZW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint categories_legacy_key_country_unique unique (legacy_key, country_code),
  constraint categories_slug_country_unique unique (slug, country_code),
  constraint categories_legacy_key_format check (legacy_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_name_not_blank check (length(trim(name)) > 0)
);
create index if not exists categories_active_sort_idx on public.categories (country_code, is_active, sort_order);

create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  country_code text not null default 'ZW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint provinces_code_country_unique unique (code, country_code),
  constraint provinces_code_format check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint provinces_name_not_blank check (length(trim(name)) > 0)
);
create index if not exists provinces_active_sort_idx on public.provinces (country_code, is_active, sort_order);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  province_id uuid not null references public.provinces(id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  country_code text not null default 'ZW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint cities_province_slug_unique unique (province_id, slug),
  constraint cities_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint cities_name_not_blank check (length(trim(name)) > 0)
);
create index if not exists cities_active_sort_idx on public.cities (country_code, is_active, sort_order);
create index if not exists cities_province_idx on public.cities (province_id);

alter table public.categories enable row level security;
alter table public.provinces enable row level security;
alter table public.cities enable row level security;

drop policy if exists "categories: public read active" on public.categories;
create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active = true);
drop policy if exists "categories: admin write" on public.categories;
create policy "categories: admin write" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "provinces: public read active" on public.provinces;
create policy "provinces: public read active" on public.provinces
  for select to anon, authenticated using (is_active = true);
drop policy if exists "provinces: admin write" on public.provinces;
create policy "provinces: admin write" on public.provinces
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cities: public read active" on public.cities;
create policy "cities: public read active" on public.cities
  for select to anon, authenticated using (is_active = true);
drop policy if exists "cities: admin write" on public.cities;
create policy "cities: admin write" on public.cities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.categories, public.provinces, public.cities to anon, authenticated;
grant insert, update, delete on public.categories, public.provinces, public.cities to authenticated;

comment on table public.categories is 'Canonical listing categories (Stage 4). listings.category remains free TEXT and stores legacy_key values unchanged — this table is a read/reference + admin-editable label layer, not a foreign key target.';
comment on table public.provinces is 'Canonical Zimbabwe provinces (Stage 4). listings.province remains free TEXT and stores the name values unchanged.';
comment on table public.cities is 'Canonical Zimbabwe cities/suburbs per province (Stage 4). listings.city remains free TEXT and stores the name values unchanged.';

-- updated_at bump trigger (mirrors content_pages' pattern from Stage 1, minus
-- version history — a simple lookup table doesn't need per-edit snapshots).
create or replace function public.taxonomy_touch_updated_at()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_categories_touch on public.categories;
create trigger trg_categories_touch before update on public.categories
  for each row execute function public.taxonomy_touch_updated_at();
drop trigger if exists trg_provinces_touch on public.provinces;
create trigger trg_provinces_touch before update on public.provinces
  for each row execute function public.taxonomy_touch_updated_at();
drop trigger if exists trg_cities_touch on public.cities;
create trigger trg_cities_touch before update on public.cities
  for each row execute function public.taxonomy_touch_updated_at();

revoke execute on function public.taxonomy_touch_updated_at() from public, anon, authenticated;

-- ── Seed: categories (verbatim from apps/mobile/lib/constants.ts) ──────
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('property', 'property', 'Property', '#1E88E5', 0)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('vehicles', 'vehicles', 'Vehicles', '#e53935', 1)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('rooms', 'rooms', 'Rooms', '#00838F', 2)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('electronics', 'electronics', 'Electronics', '#8E24AA', 3)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('jobs', 'jobs', 'Jobs', '#F5A623', 4)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('furniture', 'furniture', 'Furniture', '#6D4C41', 5)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('fashion', 'fashion', 'Fashion', '#F06292', 6)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('services', 'services', 'Services', '#00897B', 7)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('agriculture', 'agriculture', 'Agriculture', '#558B2F', 8)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('pets', 'pets', 'Pets', '#FB8C00', 9)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('kids', 'kids', 'Baby & Kids', '#E91E63', 10)
on conflict (legacy_key, country_code) do nothing;
insert into public.categories (legacy_key, slug, name, color, sort_order)
values ('other', 'other', 'Other', '#546E7A', 11)
on conflict (legacy_key, country_code) do nothing;

-- ── Seed: provinces (verbatim from apps/mobile/lib/constants.ts) ───
insert into public.provinces (code, name, sort_order)
values ('harare', 'Harare', 0)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('bulawayo', 'Bulawayo', 1)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('manicaland', 'Manicaland', 2)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('mashonaland-west', 'Mashonaland West', 3)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('mashonaland-east', 'Mashonaland East', 4)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('mashonaland-central', 'Mashonaland Central', 5)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('midlands', 'Midlands', 6)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('masvingo', 'Masvingo', 7)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('matabeleland-north', 'Matabeleland North', 8)
on conflict (code, country_code) do nothing;
insert into public.provinces (code, name, sort_order)
values ('matabeleland-south', 'Matabeleland South', 9)
on conflict (code, country_code) do nothing;

-- ── Seed: cities (verbatim from apps/mobile/lib/cities-by-province.json, 324 total) ──
insert into public.cities (slug, name, province_id, sort_order)
select v.slug, v.name, p.id, v.sort_order
from (values
  ('harare', 'harare-cbd', 'Harare CBD', 0),
  ('harare', 'the-avenues', 'The Avenues', 1),
  ('harare', 'kopje', 'Kopje', 2),
  ('harare', 'graniteside', 'Graniteside', 3),
  ('harare', 'workington', 'Workington', 4),
  ('harare', 'southerton', 'Southerton', 5),
  ('harare', 'ardbennie', 'Ardbennie', 6),
  ('harare', 'willowvale', 'Willowvale', 7),
  ('harare', 'alexandra-park', 'Alexandra Park', 8),
  ('harare', 'arcadia', 'Arcadia', 9),
  ('harare', 'arundel', 'Arundel', 10),
  ('harare', 'ashdown-park', 'Ashdown Park', 11),
  ('harare', 'athlone', 'Athlone', 12),
  ('harare', 'avondale', 'Avondale', 13),
  ('harare', 'avondale-west', 'Avondale West', 14),
  ('harare', 'avonlea', 'Avonlea', 15),
  ('harare', 'ballantyne-park', 'Ballantyne Park', 16),
  ('harare', 'belgravia', 'Belgravia', 17),
  ('harare', 'belvedere', 'Belvedere', 18),
  ('harare', 'beverley', 'Beverley', 19),
  ('harare', 'bloomingdale', 'Bloomingdale', 20),
  ('harare', 'bluff-hill', 'Bluff Hill', 21),
  ('harare', 'borrowdale', 'Borrowdale', 22),
  ('harare', 'borrowdale-brooke', 'Borrowdale Brooke', 23),
  ('harare', 'borrowdale-west', 'Borrowdale West', 24),
  ('harare', 'braeside', 'Braeside', 25),
  ('harare', 'budiriro', 'Budiriro', 26),
  ('harare', 'budiriro-2', 'Budiriro 2', 27),
  ('harare', 'budiriro-4', 'Budiriro 4', 28),
  ('harare', 'budiriro-5', 'Budiriro 5', 29),
  ('harare', 'chadcombe', 'Chadcombe', 30),
  ('harare', 'chisipite', 'Chisipite', 31),
  ('harare', 'churchill', 'Churchill', 32),
  ('harare', 'cold-comfort', 'Cold Comfort', 33),
  ('harare', 'colne-valley', 'Colne Valley', 34),
  ('harare', 'cranborne', 'Cranborne', 35),
  ('harare', 'crowborough', 'Crowborough', 36),
  ('harare', 'dawn-hill', 'Dawn Hill', 37),
  ('harare', 'donnybrook', 'Donnybrook', 38),
  ('harare', 'dzivarasekwa', 'Dzivarasekwa', 39),
  ('harare', 'dzivarasekwa-extension', 'Dzivarasekwa Extension', 40),
  ('harare', 'eastlea', 'Eastlea', 41),
  ('harare', 'eastlea-south', 'Eastlea South', 42),
  ('harare', 'emerald-hill', 'Emerald Hill', 43),
  ('harare', 'epworth', 'Epworth', 44),
  ('harare', 'forestvale', 'Forestvale', 45),
  ('harare', 'glen-lorne', 'Glen Lorne', 46),
  ('harare', 'glen-norah', 'Glen Norah', 47),
  ('harare', 'glen-view', 'Glen View', 48),
  ('harare', 'glenora', 'Glenora', 49),
  ('harare', 'graniteside', 'Graniteside', 50),
  ('harare', 'greencroft', 'Greencroft', 51),
  ('harare', 'greendale', 'Greendale', 52),
  ('harare', 'greenspan', 'Greenspan', 53),
  ('harare', 'greystone-park', 'Greystone Park', 54),
  ('harare', 'gun-hill', 'Gun Hill', 55),
  ('harare', 'handsworth', 'Handsworth', 56),
  ('harare', 'harare-north', 'Harare North', 57),
  ('harare', 'hatcliffe', 'Hatcliffe', 58),
  ('harare', 'hatfield', 'Hatfield', 59),
  ('harare', 'helensvale', 'Helensvale', 60),
  ('harare', 'highfield', 'Highfield', 61),
  ('harare', 'highlands', 'Highlands', 62),
  ('harare', 'homefield', 'Homefield', 63),
  ('harare', 'hopley', 'Hopley', 64),
  ('harare', 'houghton-park', 'Houghton Park', 65),
  ('harare', 'kambuzuma', 'Kambuzuma', 66),
  ('harare', 'kopje', 'Kopje', 67),
  ('harare', 'kuwadzana', 'Kuwadzana', 68),
  ('harare', 'kuwadzana-extension', 'Kuwadzana Extension', 69),
  ('harare', 'kuwadzana-3', 'Kuwadzana 3', 70),
  ('harare', 'kuwadzana-4', 'Kuwadzana 4', 71),
  ('harare', 'kuwadzana-5', 'Kuwadzana 5', 72),
  ('harare', 'lakeside', 'Lakeside', 73),
  ('harare', 'lochinvar', 'Lochinvar', 74),
  ('harare', 'mabelreign', 'Mabelreign', 75),
  ('harare', 'mabvuku', 'Mabvuku', 76),
  ('harare', 'mandara', 'Mandara', 77),
  ('harare', 'marimba-park', 'Marimba Park', 78),
  ('harare', 'marlborough', 'Marlborough', 79),
  ('harare', 'mbare', 'Mbare', 80),
  ('harare', 'meyrick-park', 'Meyrick Park', 81),
  ('harare', 'milton-park', 'Milton Park', 82),
  ('harare', 'monovale', 'Monovale', 83),
  ('harare', 'mount-hampden', 'Mount Hampden', 84),
  ('harare', 'mount-pleasant', 'Mount Pleasant', 85),
  ('harare', 'msasa', 'Msasa', 86),
  ('harare', 'msasa-park', 'Msasa Park', 87),
  ('harare', 'mufakose', 'Mufakose', 88),
  ('harare', 'new-marlborough', 'New Marlborough', 89),
  ('harare', 'norton', 'Norton', 90),
  ('harare', 'pomona', 'Pomona', 91),
  ('harare', 'prospect', 'Prospect', 92),
  ('harare', 'queensdale', 'Queensdale', 93),
  ('harare', 'rhodesville', 'Rhodesville', 94),
  ('harare', 'rolf-valley', 'Rolf Valley', 95),
  ('harare', 'rugare', 'Rugare', 96),
  ('harare', 'ruwa', 'Ruwa', 97),
  ('harare', 'southerton', 'Southerton', 98),
  ('harare', 'strathaven', 'Strathaven', 99),
  ('harare', 'sunningdale', 'Sunningdale', 100),
  ('harare', 'tafara', 'Tafara', 101),
  ('harare', 'tynwald', 'Tynwald', 102),
  ('harare', 'tynwald-south', 'Tynwald South', 103),
  ('harare', 'vainona', 'Vainona', 104),
  ('harare', 'warren-park', 'Warren Park', 105),
  ('harare', 'warren-park-d', 'Warren Park D', 106),
  ('harare', 'warren-park-north', 'Warren Park North', 107),
  ('harare', 'waterfalls', 'Waterfalls', 108),
  ('harare', 'waterford', 'Waterford', 109),
  ('harare', 'waterlea', 'Waterlea', 110),
  ('harare', 'willowvale', 'Willowvale', 111),
  ('harare', 'workington', 'Workington', 112),
  ('harare', 'zimre-park', 'Zimre Park', 113),
  ('harare', 'chitungwiza-unit-a', 'Chitungwiza - Unit A', 114),
  ('harare', 'chitungwiza-unit-b', 'Chitungwiza - Unit B', 115),
  ('harare', 'chitungwiza-unit-c', 'Chitungwiza - Unit C', 116),
  ('harare', 'chitungwiza-unit-d', 'Chitungwiza - Unit D', 117),
  ('harare', 'chitungwiza-unit-e', 'Chitungwiza - Unit E', 118),
  ('harare', 'chitungwiza-unit-f', 'Chitungwiza - Unit F', 119),
  ('harare', 'chitungwiza-unit-g', 'Chitungwiza - Unit G', 120),
  ('harare', 'chitungwiza-unit-h', 'Chitungwiza - Unit H', 121),
  ('harare', 'chitungwiza-unit-j', 'Chitungwiza - Unit J', 122),
  ('harare', 'chitungwiza-unit-k', 'Chitungwiza - Unit K', 123),
  ('harare', 'chitungwiza-st-marys', 'Chitungwiza - St Marys', 124),
  ('harare', 'chitungwiza-zengeza-1', 'Chitungwiza - Zengeza 1', 125),
  ('harare', 'chitungwiza-zengeza-2', 'Chitungwiza - Zengeza 2', 126),
  ('harare', 'chitungwiza-zengeza-3', 'Chitungwiza - Zengeza 3', 127),
  ('harare', 'chitungwiza-zengeza-4', 'Chitungwiza - Zengeza 4', 128),
  ('harare', 'chitungwiza-makoni', 'Chitungwiza - Makoni', 129),
  ('harare', 'chitungwiza-seke', 'Chitungwiza - Seke', 130),
  ('bulawayo', 'bulawayo-cbd', 'Bulawayo CBD', 0),
  ('bulawayo', 'civic-centre', 'Civic Centre', 1),
  ('bulawayo', 'north-end', 'North End', 2),
  ('bulawayo', 'ascot', 'Ascot', 3),
  ('bulawayo', 'bellevue', 'Bellevue', 4),
  ('bulawayo', 'belmont', 'Belmont', 5),
  ('bulawayo', 'belmont-east', 'Belmont East', 6),
  ('bulawayo', 'burnside', 'Burnside', 7),
  ('bulawayo', 'cowdray-park', 'Cowdray Park', 8),
  ('bulawayo', 'donnington', 'Donnington', 9),
  ('bulawayo', 'emakhandeni', 'Emakhandeni', 10),
  ('bulawayo', 'emganwini', 'Emganwini', 11),
  ('bulawayo', 'enqameni', 'Enqameni', 12),
  ('bulawayo', 'entumbane', 'Entumbane', 13),
  ('bulawayo', 'famona', 'Famona', 14),
  ('bulawayo', 'gwabalanda', 'Gwabalanda', 15),
  ('bulawayo', 'hillcrest', 'Hillcrest', 16),
  ('bulawayo', 'hillside', 'Hillside', 17),
  ('bulawayo', 'hillside-east', 'Hillside East', 18),
  ('bulawayo', 'hillside-south', 'Hillside South', 19),
  ('bulawayo', 'hyde-park', 'Hyde Park', 20),
  ('bulawayo', 'ilanda', 'Ilanda', 21),
  ('bulawayo', 'iminyela', 'Iminyela', 22),
  ('bulawayo', 'induna', 'Induna', 23),
  ('bulawayo', 'kelvin', 'Kelvin', 24),
  ('bulawayo', 'kelvin-east', 'Kelvin East', 25),
  ('bulawayo', 'kelvin-north', 'Kelvin North', 26),
  ('bulawayo', 'khumalo', 'Khumalo', 27),
  ('bulawayo', 'killarney', 'Killarney', 28),
  ('bulawayo', 'kumalo', 'Kumalo', 29),
  ('bulawayo', 'kumalo-north', 'Kumalo North', 30),
  ('bulawayo', 'lobengula', 'Lobengula', 31),
  ('bulawayo', 'lobenvale', 'Lobenvale', 32),
  ('bulawayo', 'luveve', 'Luveve', 33),
  ('bulawayo', 'mabutweni', 'Mabutweni', 34),
  ('bulawayo', 'magwegwe', 'Magwegwe', 35),
  ('bulawayo', 'makokoba', 'Makokoba', 36),
  ('bulawayo', 'malindela', 'Malindela', 37),
  ('bulawayo', 'malvern', 'Malvern', 38),
  ('bulawayo', 'manningdale', 'Manningdale', 39),
  ('bulawayo', 'matsheumhlope', 'Matsheumhlope', 40),
  ('bulawayo', 'matshobana', 'Matshobana', 41),
  ('bulawayo', 'montrose', 'Montrose', 42),
  ('bulawayo', 'mpopoma', 'Mpopoma', 43),
  ('bulawayo', 'mzilikazi', 'Mzilikazi', 44),
  ('bulawayo', 'newlands', 'Newlands', 45),
  ('bulawayo', 'newton', 'Newton', 46),
  ('bulawayo', 'newton-west', 'Newton West', 47),
  ('bulawayo', 'nketa', 'Nketa', 48),
  ('bulawayo', 'njube', 'Njube', 49),
  ('bulawayo', 'nkulumane', 'Nkulumane', 50),
  ('bulawayo', 'orange-grove', 'Orange Grove', 51),
  ('bulawayo', 'paddonhurst', 'Paddonhurst', 52),
  ('bulawayo', 'parklands', 'Parklands', 53),
  ('bulawayo', 'parktown', 'Parktown', 54),
  ('bulawayo', 'parkview', 'Parkview', 55),
  ('bulawayo', 'pelandaba', 'Pelandaba', 56),
  ('bulawayo', 'pumula', 'Pumula', 57),
  ('bulawayo', 'pumula-south', 'Pumula South', 58),
  ('bulawayo', 'queenspark', 'Queenspark', 59),
  ('bulawayo', 'raylton', 'Raylton', 60),
  ('bulawayo', 'richmond', 'Richmond', 61),
  ('bulawayo', 'riverside', 'Riverside', 62),
  ('bulawayo', 'runnivale', 'Runnivale', 63),
  ('bulawayo', 'sauerstown', 'Sauerstown', 64),
  ('bulawayo', 'selborne', 'Selborne', 65),
  ('bulawayo', 'sizinda', 'Sizinda', 66),
  ('bulawayo', 'southdale', 'Southdale', 67),
  ('bulawayo', 'southwold', 'Southwold', 68),
  ('bulawayo', 'steeldale', 'Steeldale', 69),
  ('bulawayo', 'suburbs', 'Suburbs', 70),
  ('bulawayo', 'sunninghill', 'Sunninghill', 71),
  ('bulawayo', 'sunnyside', 'Sunnyside', 72),
  ('bulawayo', 'thorngrove', 'Thorngrove', 73),
  ('bulawayo', 'trenance', 'Trenance', 74),
  ('bulawayo', 'tshabalala', 'Tshabalala', 75),
  ('bulawayo', 'umguza', 'Umguza', 76),
  ('bulawayo', 'umwinsidale', 'Umwinsidale', 77),
  ('bulawayo', 'westwood', 'Westwood', 78),
  ('bulawayo', 'woodville', 'Woodville', 79),
  ('bulawayo', 'plumtree', 'Plumtree', 80),
  ('manicaland', 'mutare-cbd', 'Mutare CBD', 0),
  ('manicaland', 'dangamvura', 'Dangamvura', 1),
  ('manicaland', 'sakubva', 'Sakubva', 2),
  ('manicaland', 'chikanga', 'Chikanga', 3),
  ('manicaland', 'hobhouse', 'Hobhouse', 4),
  ('manicaland', 'yeovil', 'Yeovil', 5),
  ('manicaland', 'chipinge', 'Chipinge', 6),
  ('manicaland', 'chimanimani', 'Chimanimani', 7),
  ('manicaland', 'rusape', 'Rusape', 8),
  ('manicaland', 'odzi', 'Odzi', 9),
  ('manicaland', 'nyazura', 'Nyazura', 10),
  ('manicaland', 'nyanga', 'Nyanga', 11),
  ('manicaland', 'juliasdale', 'Juliasdale', 12),
  ('manicaland', 'birchenough-bridge', 'Birchenough Bridge', 13),
  ('manicaland', 'headlands', 'Headlands', 14),
  ('manicaland', 'penhalonga', 'Penhalonga', 15),
  ('manicaland', 'mutasa', 'Mutasa', 16),
  ('manicaland', 'buhera', 'Buhera', 17),
  ('manicaland', 'hauna', 'Hauna', 18),
  ('manicaland', 'manica', 'Manica', 19),
  ('manicaland', 'mutambara', 'Mutambara', 20),
  ('mashonaland-west', 'chinhoyi', 'Chinhoyi', 0),
  ('mashonaland-west', 'chegutu', 'Chegutu', 1),
  ('mashonaland-west', 'chakari', 'Chakari', 2),
  ('mashonaland-west', 'kadoma', 'Kadoma', 3),
  ('mashonaland-west', 'ngezi', 'Ngezi', 4),
  ('mashonaland-west', 'karoi', 'Karoi', 5),
  ('mashonaland-west', 'kariba', 'Kariba', 6),
  ('mashonaland-west', 'norton', 'Norton', 7),
  ('mashonaland-west', 'banket', 'Banket', 8),
  ('mashonaland-west', 'glendale', 'Glendale', 9),
  ('mashonaland-west', 'mhangura', 'Mhangura', 10),
  ('mashonaland-west', 'murombedzi', 'Murombedzi', 11),
  ('mashonaland-west', 'makonde', 'Makonde', 12),
  ('mashonaland-west', 'zvimba', 'Zvimba', 13),
  ('mashonaland-west', 'raffingora', 'Raffingora', 14),
  ('mashonaland-west', 'sanyati', 'Sanyati', 15),
  ('mashonaland-east', 'marondera', 'Marondera', 0),
  ('mashonaland-east', 'murewa', 'Murewa', 1),
  ('mashonaland-east', 'mutoko', 'Mutoko', 2),
  ('mashonaland-east', 'wedza', 'Wedza', 3),
  ('mashonaland-east', 'hwedza', 'Hwedza', 4),
  ('mashonaland-east', 'chivhu', 'Chivhu', 5),
  ('mashonaland-east', 'goromonzi', 'Goromonzi', 6),
  ('mashonaland-east', 'chikomba', 'Chikomba', 7),
  ('mashonaland-east', 'ruwa', 'Ruwa', 8),
  ('mashonaland-east', 'macheke', 'Macheke', 9),
  ('mashonaland-east', 'seke', 'Seke', 10),
  ('mashonaland-east', 'mudzi', 'Mudzi', 11),
  ('mashonaland-east', 'sadza', 'Sadza', 12),
  ('mashonaland-central', 'bindura', 'Bindura', 0),
  ('mashonaland-central', 'concession', 'Concession', 1),
  ('mashonaland-central', 'shamva', 'Shamva', 2),
  ('mashonaland-central', 'glendale', 'Glendale', 3),
  ('mashonaland-central', 'mt-darwin', 'Mt Darwin', 4),
  ('mashonaland-central', 'dotito', 'Dotito', 5),
  ('mashonaland-central', 'mvurwi', 'Mvurwi', 6),
  ('mashonaland-central', 'guruve', 'Guruve', 7),
  ('mashonaland-central', 'centenary', 'Centenary', 8),
  ('mashonaland-central', 'rushinga', 'Rushinga', 9),
  ('mashonaland-central', 'mazowe', 'Mazowe', 10),
  ('midlands', 'gweru-cbd', 'Gweru CBD', 0),
  ('midlands', 'gweru-mkoba', 'Gweru Mkoba', 1),
  ('midlands', 'gweru-mambo', 'Gweru Mambo', 2),
  ('midlands', 'gweru-ascot', 'Gweru Ascot', 3),
  ('midlands', 'kwekwe', 'Kwekwe', 4),
  ('midlands', 'redcliff', 'Redcliff', 5),
  ('midlands', 'zvishavane', 'Zvishavane', 6),
  ('midlands', 'shurugwi', 'Shurugwi', 7),
  ('midlands', 'gokwe', 'Gokwe', 8),
  ('midlands', 'gokwe-south', 'Gokwe South', 9),
  ('midlands', 'lalapanzi', 'Lalapanzi', 10),
  ('midlands', 'mvuma', 'Mvuma', 11),
  ('midlands', 'shangani', 'Shangani', 12),
  ('midlands', 'mberengwa', 'Mberengwa', 13),
  ('midlands', 'silobela', 'Silobela', 14),
  ('midlands', 'chirumanzu', 'Chirumanzu', 15),
  ('masvingo', 'masvingo-cbd', 'Masvingo CBD', 0),
  ('masvingo', 'rujeko', 'Rujeko', 1),
  ('masvingo', 'mucheke', 'Mucheke', 2),
  ('masvingo', 'chiredzi', 'Chiredzi', 3),
  ('masvingo', 'triangle', 'Triangle', 4),
  ('masvingo', 'gutu', 'Gutu', 5),
  ('masvingo', 'bikita', 'Bikita', 6),
  ('masvingo', 'zaka', 'Zaka', 7),
  ('masvingo', 'mwenezi', 'Mwenezi', 8),
  ('masvingo', 'ngundu', 'Ngundu', 9),
  ('masvingo', 'mashava', 'Mashava', 10),
  ('masvingo', 'buchwa', 'Buchwa', 11),
  ('matabeleland-north', 'hwange-cbd', 'Hwange CBD', 0),
  ('matabeleland-north', 'hwange-colliery', 'Hwange Colliery', 1),
  ('matabeleland-north', 'chinotimba', 'Chinotimba', 2),
  ('matabeleland-north', 'victoria-falls', 'Victoria Falls', 3),
  ('matabeleland-north', 'lupane', 'Lupane', 4),
  ('matabeleland-north', 'nkayi', 'Nkayi', 5),
  ('matabeleland-north', 'binga', 'Binga', 6),
  ('matabeleland-north', 'dete', 'Dete', 7),
  ('matabeleland-north', 'kamativi', 'Kamativi', 8),
  ('matabeleland-north', 'tsholotsho', 'Tsholotsho', 9),
  ('matabeleland-north', 'umguza', 'Umguza', 10),
  ('matabeleland-north', 'inyati', 'Inyati', 11),
  ('matabeleland-south', 'gwanda', 'Gwanda', 0),
  ('matabeleland-south', 'filabusi', 'Filabusi', 1),
  ('matabeleland-south', 'beitbridge', 'Beitbridge', 2),
  ('matabeleland-south', 'plumtree', 'Plumtree', 3),
  ('matabeleland-south', 'insiza', 'Insiza', 4),
  ('matabeleland-south', 'matobo', 'Matobo', 5),
  ('matabeleland-south', 'kezi', 'Kezi', 6),
  ('matabeleland-south', 'esigodini', 'Esigodini', 7),
  ('matabeleland-south', 'west-nicholson', 'West Nicholson', 8),
  ('matabeleland-south', 'colleen-bawn', 'Colleen Bawn', 9),
  ('matabeleland-south', 'umzingwane', 'Umzingwane', 10)
) as v(province_code, slug, name, sort_order)
join public.provinces p on p.code = v.province_code and p.country_code = 'ZW'
on conflict (province_id, slug) do nothing;

insert into public.admin_audit_logs (action, entity, entity_id, after_state, reason)
select 'seed_taxonomy', 'categories', null,
  jsonb_build_object('categories', (select count(*) from public.categories),
                      'provinces', (select count(*) from public.provinces),
                      'cities', (select count(*) from public.cities)),
  'Stage 4: seeded canonical categories/provinces/cities tables verbatim from apps/mobile/lib/constants.ts and cities-by-province.json — the existing, most complete source. listings.category/province/city are unchanged (still free text). No new categories, provinces or cities were invented.'
where exists (select 1 from public.categories limit 1);
