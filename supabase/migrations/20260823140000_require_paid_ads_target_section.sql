-- Reject incomplete paid-ad placement input at the server-authorized boundary.
-- The original authority migration used `NOT IN`, whose SQL NULL result did
-- not enter the validation branch while paid_ads.target_section is nullable.

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
  if p_target_section is null or p_target_section not in ('home', 'category') then
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

revoke all on function public.admin_create_paid_ad(text, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz, numeric) from public, anon, service_role;
grant execute on function public.admin_create_paid_ad(text, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz, timestamptz, numeric) to authenticated;

commit;
