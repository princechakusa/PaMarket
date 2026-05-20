-- ══════════════════════════════════════════════════════════════
-- PaMarket Supabase migrations
-- Run this once in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gxgytumhknmnwspxjzxw/sql
-- ══════════════════════════════════════════════════════════════

-- ── 1. Paid Ads (ads stored server-side so ALL users see them) ──
create table if not exists paid_ads (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check(type in ('banner','spotlight')),
  business_name text,
  headline      text,
  tagline       text,
  image_url     text,
  bg_color      text default '#1A3A8F',
  link_url      text,
  target_cat    text,
  starts_at     timestamptz default now(),
  ends_at       timestamptz,
  active        boolean default true,
  priority      integer default 0,
  -- Client / billing
  client_name   text,
  client_phone  text,
  client_email  text,
  price_paid    numeric(10,2) default 0,
  payment_method text,
  payment_ref   text,
  -- Performance metrics
  impressions   integer default 0,
  clicks        integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table paid_ads enable row level security;
drop policy if exists "anon read paid_ads"   on paid_ads;
drop policy if exists "anon write paid_ads"  on paid_ads;
create policy "anon read paid_ads"  on paid_ads for select using (true);
create policy "anon write paid_ads" on paid_ads for all    using (true);

-- ── 2. App Settings (single-row config read by the PWA on boot) ──
create table if not exists app_settings (
  id         integer primary key default 1,
  settings   jsonb not null default '{}',
  updated_at timestamptz default now()
);
insert into app_settings(id, settings)
values(1, '{"requireListingApproval":false,"autoApproveVerified":true,"allowImageUploads":true,"signupPaused":false,"requirePhoneVerification":false,"enablePremiumListings":false,"freeOnly":false}')
on conflict(id) do nothing;

alter table app_settings enable row level security;
drop policy if exists "anon read settings"  on app_settings;
drop policy if exists "anon write settings" on app_settings;
create policy "anon read settings"  on app_settings for select using (true);
create policy "anon write settings" on app_settings for all    using (true);
