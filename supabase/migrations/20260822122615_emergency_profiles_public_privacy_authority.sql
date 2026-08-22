-- Emergency public-profile privacy and public API authority hardening.
-- No production rows are modified by this migration.

create or replace view public.profiles_public
with (security_barrier = true)
as
select
  id,
  name,
  avatar,
  verified,
  role,
  created_at,
  updated_at,
  bio,
  city,
  last_seen,
  privacy,
  language,
  status,
  null::text as phone
from public.profiles;

alter view public.profiles_public owner to postgres;
revoke all on public.profiles_public from public, anon, authenticated;
grant select on public.profiles_public to anon, authenticated, service_role;

comment on view public.profiles_public is
  'Public identity projection. Private profile contact fields are never exposed.';

-- Business owners need exact phone/email lookup to invite an existing user.
-- The contact supplied by the owner is used only as an exact-match predicate;
-- contact data is never returned.
create or replace function public.find_business_staff_candidate(
  p_business_id uuid,
  p_contact text
)
returns table(id uuid, name text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_user_id = auth.uid()
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if nullif(btrim(p_contact), '') is null then
    return;
  end if;

  return query
  select p.id, p.name
  from public.profiles p
  where lower(p.email) = lower(btrim(p_contact))
     or p.phone = btrim(p_contact)
  order by p.created_at
  limit 1;
end;
$function$;

revoke all on function public.find_business_staff_candidate(uuid, text)
  from public, anon;
grant execute on function public.find_business_staff_candidate(uuid, text)
  to authenticated;

comment on function public.find_business_staff_candidate(uuid, text) is
  'Owner-authorized exact contact lookup for business staff invitations; returns identity only.';

-- These routines are cron/maintenance internals. Their previous PUBLIC execute
-- privilege allowed anonymous Data API callers to invoke privileged mutations.
revoke execute on function public.cleanup_inactive_chat_data()
  from public, anon, authenticated;
revoke execute on function public.job_expire_ads()
  from public, anon, authenticated;
revoke execute on function public.job_expire_subscriptions()
  from public, anon, authenticated;
revoke execute on function public.job_purge_notifications()
  from public, anon, authenticated;
revoke execute on function public.job_purge_scheduled_notifications()
  from public, anon, authenticated;
revoke execute on function public.job_unban_expired()
  from public, anon, authenticated;
revoke execute on function public.log_job_run(text, boolean, text, integer)
  from public, anon, authenticated;
