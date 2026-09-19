-- Real gap found 2026-09-19: businesses have never been linkable to an
-- institution at the row level -- only listings carry institution_id. An
-- approved business/org had no way to appear on its institution's hub page
-- except by posting a listing there. This column lets an owner tag their
-- business itself to an institution, so it can be surfaced as an
-- "Organization" on that institution's page independent of listings.
alter table public.businesses
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;

create index if not exists businesses_institution_id_idx on public.businesses (institution_id) where institution_id is not null;

-- No RLS change needed: "businesses: public read active" already allows
-- public/anon select of any status='active' row regardless of column
-- values, so an institution page can query active businesses by
-- institution_id directly.
