-- ============================================================================
-- Phase D — website moderation support (read-only)
--
-- The public website is the anon PostgREST client. RLS on public.listings
-- already restricts anonymous SELECT to active rows only
-- (`using (status = 'active' or seller_id = auth.uid())`), so hidden listings
-- (flagged / under_review / removed / deleted / pending) are never returned to
-- the website — that stays the source of truth and is NOT changed here.
--
-- The only gap this migration fills is item 2 of Phase D: when a visitor opens
-- an OLD /detail?id=… URL for a listing that is no longer public, the website
-- needs to show the correct message ("under review" vs "removed" vs generic
-- unavailable). Because RLS (correctly) hides the row, the anon client cannot
-- read its status. This function exposes ONLY a coarse moderation state — no
-- title, price, seller, photos or any other field — so the public page can pick
-- the right message without leaking private data or bypassing row visibility.
--
-- This adds no moderation *rules*; it only reads state the Phase A backend owns.
-- ============================================================================

create or replace function public.listing_public_state(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when l.status = 'active'                                  then 'active'
        when l.status in ('flagged', 'under_review', 'pending')   then 'review'
        when l.status = 'removed'                                 then 'removed'
        when l.status = 'sold'                                    then 'sold'
        else 'unavailable'          -- deleted or any other non-public state
      end
      from public.listings l
      where l.id = (
        -- Guard against a non-uuid id string so a bad URL just returns 'unavailable'.
        case when p_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then p_id::uuid end
      )
    ),
    'unavailable'                    -- no row (deleted / never existed)
  );
$$;

comment on function public.listing_public_state(text) is
  'Phase D: returns only a coarse public moderation state (active/review/removed/sold/unavailable) for a listing id so the website can show the right message for old URLs without exposing any private listing data.';

-- Read-only helper: safe to call from the anon website client.
grant execute on function public.listing_public_state(text) to anon, authenticated;
