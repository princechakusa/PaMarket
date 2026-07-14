-- Allow listing owners to temporarily hide an ad without marking it sold or
-- deleting it. Public queries already select status = 'active', so paused rows
-- remain owner-visible through RLS and disappear from marketplace browsing.

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in (
    'pending', 'active', 'paused', 'under_review', 'flagged',
    'sold', 'removed', 'deleted'
  ));

notify pgrst, 'reload schema';
