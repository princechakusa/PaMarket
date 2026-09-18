-- Institution detail screen: real Sort and Price dropdowns (previously
-- decorative buttons in the Stitch mockup with no backend). Extends
-- get_institution_listings with p_sort/p_min_price/p_max_price rather than
-- sorting/filtering client-side, since client-side would only affect the
-- already-loaded page and desync from "load more" pagination.
create or replace function public.get_institution_listings(
  p_institution_id uuid,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'newest',
  p_min_price numeric default null,
  p_max_price numeric default null
)
returns setof listings
language sql
stable security definer
set search_path to 'public'
as $function$
  select l.* from public.listings l
  where l.institution_id = p_institution_id
    and exists (select 1 from public.institutions i where i.id = p_institution_id and i.is_active = true)
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and (p_min_price is null or l.price >= p_min_price)
    and (p_max_price is null or l.price <= p_max_price)
  order by
    case when p_sort = 'price_asc' then l.price end asc nulls last,
    case when p_sort = 'price_desc' then l.price end desc nulls last,
    l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;
