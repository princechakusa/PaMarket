create or replace function public.list_public_indexable_profiles_page(
  p_after_id uuid default null,
  p_limit integer default 1000
)
returns table (id uuid, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.updated_at
  from public.profiles as p
  join auth.users as u on u.id = p.id
  where p.status = 'active'
    and (p.ban_until is null or p.ban_until <= now())
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and not coalesce(u.is_anonymous, false)
    and nullif(btrim(p.name), '') is not null
    and (p_after_id is null or p.id > p_after_id)
  order by p.id asc
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
$$;
revoke all on function public.list_public_indexable_profiles_page(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_public_indexable_profiles_page(uuid, integer) to anon, service_role;
comment on function public.list_public_indexable_profiles_page(uuid, integer) is 'Returns one bounded, ascending keyset page of sitemap-safe public profile IDs and timestamps.';;
