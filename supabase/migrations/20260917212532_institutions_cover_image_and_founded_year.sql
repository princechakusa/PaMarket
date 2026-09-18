alter table public.institutions
  add column if not exists cover_image text,
  add column if not exists founded_year smallint;

comment on column public.institutions.cover_image is 'Full-width hero banner photo shown on the institution detail screen (distinct from logo_url, the small square badge).';
comment on column public.institutions.founded_year is 'Optional founding year shown under the logo badge on the institution detail screen.';
