-- =============================================================
-- Standalone, idempotent creation of rental_reports — extracted from
-- rental_marketplace_schema.sql (TABLE 13), which is safe to re-run in
-- full for `create table if not exists`/`create index if not exists`
-- but is NOT safe to re-run for its ~49 unguarded `create policy`
-- statements (no `drop policy if exists` precedes them there). This file
-- adds that guard so it can be run standalone without touching any other
-- already-existing rental table.
--
-- Root cause this fixes: POST .../rest/v1/rental_reports returning 404 —
-- the table was never created on this project (rental companies/listings
-- exist, so most of rental_marketplace_schema.sql clearly ran, but this
-- specific table section did not, or predates it).
-- =============================================================

create table if not exists public.rental_reports (
  id              uuid  primary key default gen_random_uuid(),
  listing_id      uuid  not null
                    references public.rental_vehicle_listings(id) on delete cascade,
  reporter_id     uuid  not null
                    references public.profiles(id) on delete cascade,
  reason          text  not null
                    check (reason in (
                      'fraudulent','wrong_category','offensive',
                      'unavailable','duplicate','other'
                    )),
  detail          text,

  -- Admin resolution
  status          text  not null default 'open'
                    check (status in ('open','reviewing','resolved','dismissed')),
  resolved_by     uuid  references public.profiles(id) on delete set null,
  resolved_at     timestamptz,
  admin_note      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One report per user per listing per reason
  unique (listing_id, reporter_id, reason)
);

create index if not exists rrep_listing_idx    on public.rental_reports (listing_id);
create index if not exists rrep_status_idx     on public.rental_reports (status, created_at desc);
create index if not exists rrep_reporter_idx   on public.rental_reports (reporter_id);

-- Partial index for admin open queue
create index if not exists rrep_open_queue_idx
  on public.rental_reports (created_at desc)
  where status = 'open';

drop trigger if exists rental_reports_updated_at on public.rental_reports;
create trigger rental_reports_updated_at
  before update on public.rental_reports
  for each row execute function public.set_updated_at();

alter table public.rental_reports enable row level security;

drop policy if exists "rental_reports: auth insert" on public.rental_reports;
create policy "rental_reports: auth insert"
  on public.rental_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "rental_reports: own read" on public.rental_reports;
create policy "rental_reports: own read"
  on public.rental_reports for select
  using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists "rental_reports: admin all" on public.rental_reports;
create policy "rental_reports: admin all"
  on public.rental_reports for all
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
