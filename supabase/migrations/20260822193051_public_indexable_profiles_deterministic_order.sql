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
    and nullif(btrim(p.name), '') is not null
  order by p.id asc;
$$;;
