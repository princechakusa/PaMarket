-- Server-authorized paid-ad administration and client tracking.
-- Browser/mobile clients retain read access but no direct table writes.

begin;

create or replace function public.admin_create_paid_ad(
  p_business_name text,
  p_advertiser_id uuid,
  p_headline text,
  p_tagline text,
  p_image_url text,
  p_bg_color text,
  p_type text,
  p_target_section text,
  p_target_cat text,
  p_listing_id uuid,
  p_link_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_price_paid numeric
)
returns table (
  id uuid,
  status text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if nullif(btrim(p_business_name), '') is null then
    raise exception 'Business name is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_headline), '') is null then
    raise exception 'Headline is required' using errcode = '22023';
  end if;
  if p_type not in ('banner', 'spotlight', 'announcement', 'halfscreen') then
    raise exception 'Invalid ad type' using errcode = '22023';
  end if;
  if p_target_section not in ('home', 'category') then
    raise exception 'Invalid target section' using errcode = '22023';
  end if;
  if p_target_cat is not null and p_target_cat not in (
    'electronics', 'vehicles', 'property', 'furniture', 'fashion', 'jobs',
    'agriculture', 'services', 'rooms', 'pets', 'kids', 'other'
  ) then
    raise exception 'Invalid target category' using errcode = '22023';
  end if;
  if p_bg_color is not null and p_bg_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid background colour' using errcode = '22023';
  end if;
  if p_image_url is not null and p_image_url like 'data:image%' then
    raise exception 'Inline ad images are not allowed' using errcode = '22023';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'End date must be after start date' using errcode = '22023';
  end if;
  if coalesce(p_price_paid, 0) < 0 then
    raise exception 'Price paid cannot be negative' using errcode = '22023';
  end if;

  return query
  insert into public.paid_ads (
    business_name, advertiser_id, headline, tagline, image_url, bg_color,
    type, target_section, target_cat, listing_id, link_url, starts_at,
    ends_at, price_paid, status, active, impressions, clicks,
    created_at, updated_at
  ) values (
    btrim(p_business_name), p_advertiser_id, btrim(p_headline), p_tagline,
    p_image_url, coalesce(p_bg_color, '#1A3A8F'), p_type, p_target_section,
    p_target_cat, p_listing_id, p_link_url, p_starts_at, p_ends_at,
    coalesce(p_price_paid, 0),
    case when p_starts_at is not null and p_starts_at > now() then 'scheduled' else 'active' end,
    not (p_starts_at is not null and p_starts_at > now()),
    0, 0, now(), now()
  )
  returning paid_ads.id, paid_ads.status, paid_ads.active,
    paid_ads.created_at, paid_ads.updated_at;
end;
$$;

create or replace function public.admin_set_paid_ad_active(
  p_ad_id uuid,
  p_active boolean
)
returns table (id uuid, active boolean, status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_ad_id is null or p_active is null then
    raise exception 'Ad ID and active state are required' using errcode = '22023';
  end if;

  return query
  update public.paid_ads as a
  set active = p_active, updated_at = now()
  where a.id = p_ad_id
  returning a.id, a.active, a.status;
  if not found then
    raise exception 'Paid ad not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_pause_scheduled_paid_ad(p_ad_id uuid)
returns table (id uuid, active boolean, status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_ad_id is null then
    raise exception 'Ad ID is required' using errcode = '22023';
  end if;

  return query
  update public.paid_ads as a
  set status = 'paused', active = false, updated_at = now()
  where a.id = p_ad_id and a.status = 'scheduled'
  returning a.id, a.active, a.status;
  if not found then
    raise exception 'Scheduled paid ad not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_expire_due_paid_ads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.paid_ads
  set active = false, updated_at = now()
  where active = true and ends_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_delete_paid_ad(p_ad_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_ad_id is null then
    raise exception 'Ad ID is required' using errcode = '22023';
  end if;

  delete from public.paid_ads as a
  where a.id = p_ad_id
  returning a.id into v_id;
  if v_id is null then
    raise exception 'Paid ad not found' using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

revoke all on function public.admin_create_paid_ad(text, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz, numeric) from public, anon, service_role;
revoke all on function public.admin_set_paid_ad_active(uuid, boolean) from public, anon, service_role;
revoke all on function public.admin_pause_scheduled_paid_ad(uuid) from public, anon, service_role;
revoke all on function public.admin_expire_due_paid_ads() from public, anon, service_role;
revoke all on function public.admin_delete_paid_ad(uuid) from public, anon, service_role;

grant execute on function public.admin_create_paid_ad(text, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz, numeric) to authenticated;
grant execute on function public.admin_set_paid_ad_active(uuid, boolean) to authenticated;
grant execute on function public.admin_pause_scheduled_paid_ad(uuid) to authenticated;
grant execute on function public.admin_expire_due_paid_ads() to authenticated;
grant execute on function public.admin_delete_paid_ad(uuid) to authenticated;

-- Keep public tracking atomic and column-specific. Invalid identifiers fail
-- closed at the UUID cast and inactive ads are never incremented.
create or replace function public.track_ad_impression(p_ad_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.paid_ads
  set impressions = coalesce(impressions, 0) + 1
  where id = p_ad_id::uuid and active = true;
end;
$$;

create or replace function public.track_ad_click(p_ad_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.paid_ads
  set clicks = coalesce(clicks, 0) + 1
  where id = p_ad_id::uuid and active = true;
end;
$$;

revoke all on function public.track_ad_impression(text) from public;
revoke all on function public.track_ad_click(text) from public;
grant execute on function public.track_ad_impression(text) to anon, authenticated;
grant execute on function public.track_ad_click(text) to anon, authenticated;

alter table public.paid_ads enable row level security;
revoke all on table public.paid_ads from anon, authenticated;
grant select on table public.paid_ads to anon, authenticated;

drop policy if exists "admin_all" on public.paid_ads;
drop policy if exists "anon read paid_ads" on public.paid_ads;
drop policy if exists "anon write paid_ads" on public.paid_ads;
drop policy if exists "paid_ads admin write" on public.paid_ads;
drop policy if exists "public can view active ads" on public.paid_ads;
drop policy if exists "public_read_active" on public.paid_ads;
drop policy if exists "paid_ads public read active" on public.paid_ads;

create policy "paid_ads public read active"
on public.paid_ads
for select
to anon, authenticated
using (active = true);

commit;
