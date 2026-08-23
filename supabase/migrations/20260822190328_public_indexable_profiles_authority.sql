-- Server-authorized, sitemap-safe public profile eligibility.
-- Intentionally exposes only profile IDs and update timestamps.

create or replace function public.list_public_indexable_profiles()
returns table (
  id uuid,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.updated_at
  from public.profiles as p
  join auth.users as u
    on u.id = p.id
  where p.status = 'active'
    and (p.ban_until is null or p.ban_until <= now())
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and not coalesce(u.is_anonymous, false)
    and nullif(btrim(p.name), '') is not null;
$$;

revoke all on function public.list_public_indexable_profiles()
from public, anon, authenticated;

grant execute on function public.list_public_indexable_profiles()
to anon, service_role;

comment on function public.list_public_indexable_profiles()
is 'Returns only sitemap-safe IDs and timestamps for active, non-banned, non-deleted, non-anonymous public profiles.';;
