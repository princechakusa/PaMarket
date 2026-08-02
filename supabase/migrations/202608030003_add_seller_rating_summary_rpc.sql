-- Profile screens (own profile, other users' profiles, listing detail's
-- seller card) each fetched up to 200 raw review rows just to compute a
-- count and an average rating client-side. A seller who has actually
-- accumulated more than 200 reviews got a silently wrong (truncated)
-- average, and every screen paid for shipping rows it never displayed.
-- reviews_seller_idx (seller_id, created_at desc) already covers this
-- aggregate efficiently.
create or replace function public.get_seller_rating_summary(seller uuid)
returns table (review_count integer, avg_rating numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int, coalesce(avg(rating), 0)::numeric
  from public.reviews
  where seller_id = seller
$$;

revoke all on function public.get_seller_rating_summary(uuid) from public, anon;
grant execute on function public.get_seller_rating_summary(uuid) to authenticated, anon;
