-- ============================================================================
-- Duplicate-photo scam check.
--
-- The app records an md5 fingerprint of each original photo file in
-- listings.attributes._photo_hashes (no schema change, so posting works
-- before this migration runs). When a NEW listing reuses a photo that a
-- DIFFERENT account posted in the last 180 days, the new listing is held
-- for review ('under_review' → Admin → Listings moderation queue) instead of
-- going live. Same-seller reposts are never affected.
--
-- Idempotent — safe to re-run.
-- ============================================================================
create index if not exists listings_photo_hashes_gin
  on public.listings using gin ((attributes -> '_photo_hashes'));

create or replace function public.listing_duplicate_photo_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hashes text[];
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if coalesce(new.status, 'active') not in ('active', 'pending') then return new; end if;
  if exists (select 1 from public.listings where id = new.id) then return new; end if; -- upsert-edit
  if jsonb_typeof(new.attributes -> '_photo_hashes') is distinct from 'array' then return new; end if;

  select array_agg(h) into v_hashes
  from jsonb_array_elements_text(new.attributes -> '_photo_hashes') as h
  where h ~ '^[0-9a-f]{32}$';
  if v_hashes is null then return new; end if;

  if exists (
    select 1 from public.listings l
    where l.attributes -> '_photo_hashes' ?| v_hashes
      and l.seller_id is distinct from new.seller_id
      and l.created_at > now() - interval '180 days'
  ) then
    new.status := 'under_review';
    new.attributes := new.attributes || jsonb_build_object('_review_reason', 'duplicate_photo');
  end if;
  return new;
exception when others then
  return new; -- a failed check must never block posting
end;
$$;

drop trigger if exists trg_listing_duplicate_photo_check on public.listings;
create trigger trg_listing_duplicate_photo_check
  before insert on public.listings
  for each row execute function public.listing_duplicate_photo_check();
