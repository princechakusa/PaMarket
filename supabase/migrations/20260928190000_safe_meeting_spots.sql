-- ============================================================================
-- Safe meeting spots, shown to buyers on a listing in the same city
-- ("Meet safely in Harare: …"). Managed in Admin → Taxonomy → Safe meeting
-- spots; public read, admin write.
--
-- Seeded with a few very well-known, busy public places. Admins should
-- review and extend the list per city.
--
-- Idempotent — safe to re-run.
-- ============================================================================
create table if not exists public.safe_meeting_spots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  name text not null,
  area text,
  note text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city, name)
);
create index if not exists safe_meeting_spots_city_idx on public.safe_meeting_spots (lower(city)) where is_active;

alter table public.safe_meeting_spots enable row level security;

drop policy if exists "safe spots: public read" on public.safe_meeting_spots;
create policy "safe spots: public read" on public.safe_meeting_spots
  for select to anon, authenticated using (is_active or public.is_admin());

drop policy if exists "safe spots: admin write" on public.safe_meeting_spots;
create policy "safe spots: admin write" on public.safe_meeting_spots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.safe_meeting_spots to anon, authenticated;
grant insert, update, delete on public.safe_meeting_spots to authenticated;

insert into public.safe_meeting_spots (city, name, area, note, sort_order) values
  ('Harare', 'Sam Levy''s Village', 'Borrowdale', 'Busy shopping village with security guards and parking.', 10),
  ('Harare', 'Eastgate Mall', 'City Centre', 'Meet inside near the main entrance during shop hours.', 20),
  ('Harare', 'Joina City', 'City Centre', 'Large mall with security at the entrances.', 30),
  ('Harare', 'Westgate Shopping Centre', 'Westgate', 'Busy car park and food court.', 40),
  ('Harare', 'Avondale Shopping Centre', 'Avondale', 'Open, busy centre with banks and cafes.', 50),
  ('Bulawayo', 'Bulawayo Centre', 'City Centre', 'Central mall with security staff.', 10),
  ('Bulawayo', 'Ascot Shopping Centre', 'Ascot', 'Busy shopping centre with parking.', 20)
on conflict (city, name) do nothing;
