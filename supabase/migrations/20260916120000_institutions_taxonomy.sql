-- ============================================================
-- PaMarket Institutions — Phase 1 Database Foundation.
-- public.institutions: a reference/taxonomy table (Universities, High
-- Schools, Organizations), following the exact same pattern as
-- public.categories/provinces/cities (20260909120000_taxonomy_foundation.sql):
-- public-read-when-active, admin-write-only, reusing province_id/city_id
-- FKs into the existing provinces/cities tables rather than inventing a
-- parallel location system. listings gains one nullable institution_id FK
-- in a companion migration -- listings themselves are never duplicated.
-- Safe to run more than once.
-- ============================================================

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  official_name text not null,
  short_name text,
  search_aliases text[] not null default '{}',
  province_id uuid not null references public.provinces(id) on delete restrict,
  city_id uuid not null references public.cities(id) on delete restrict,
  suburb text,
  logo_url text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint institutions_type_check check (type in ('university', 'high_school', 'organization')),
  constraint institutions_official_name_not_blank check (length(trim(official_name)) > 0)
);

-- Justified indexes only (province/city browse query, name search, and a
-- unique index for the duplicate-protection constraint -- Postgres UNIQUE
-- table constraints can't take an expression like lower(), only a plain
-- unique index can).
create index if not exists institutions_province_city_idx on public.institutions (province_id, city_id);
create unique index if not exists institutions_official_name_city_unique_idx on public.institutions (lower(official_name), city_id);

create extension if not exists pg_trgm;
create index if not exists institutions_official_name_trgm_idx on public.institutions using gin (official_name gin_trgm_ops);

alter table public.institutions enable row level security;

drop policy if exists "institutions: public read active" on public.institutions;
create policy "institutions: public read active" on public.institutions
  for select to anon, authenticated using (is_active = true);
drop policy if exists "institutions: admin write" on public.institutions;
create policy "institutions: admin write" on public.institutions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.institutions to anon, authenticated;
grant insert, update, delete on public.institutions to authenticated;

comment on table public.institutions is
  'Institutions taxonomy (Universities/High Schools/Organizations), Phase 1. province_id/city_id reuse the existing provinces/cities tables -- no parallel location system. Admin-managed only; listings.institution_id (companion migration) is the only link to public.listings, which is never duplicated.';

-- updated_at bump trigger, reusing the exact function already created by
-- 20260909120000_taxonomy_foundation.sql for categories/provinces/cities.
drop trigger if exists trg_institutions_touch on public.institutions;
create trigger trg_institutions_touch before update on public.institutions
  for each row execute function public.taxonomy_touch_updated_at();

-- No seed data in this stage -- institutions are not manually added yet
-- per the implementation brief.
