-- ─────────────────────────────────────────────────────────────
-- MODULE 1 — BUSINESS ONBOARDING
-- businesses + business_subscriptions tables
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Scope: takes a signed-in user from "Create Business" through to an
-- ACTIVE business with a chosen subscription plan. Listings, leads,
-- analytics, etc. are owned by their own modules and reference
-- businesses.id — this file only creates the onboarding surface.
-- ─────────────────────────────────────────────────────────────

-- ── businesses ───────────────────────────────────────────────
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.profiles(id) on delete cascade,

  -- Business Identity
  name            text not null default '',
  logo            text,
  cover           text,
  description     text,

  -- Business Type (Individual / Registered Company / Agency)
  biz_type        text not null default 'individual'
                    check (biz_type in ('individual','company','agency')),

  -- Category (matches H.CATEGORIES id used by listings)
  category        text,

  -- Contact Information
  phone           text,
  whatsapp        text,
  email           text,

  -- Location
  province        text,
  city            text,
  suburb          text,

  -- Lifecycle status (onboarding → live)
  status          text not null default 'draft'
                    check (status in ('draft','pending_activation','active','suspended')),

  -- Resumable onboarding progress
  onboarding_step text not null default 'details'
                    check (onboarding_step in ('details','category','plan','activate','done')),

  -- Verification level (0 = none; raised by Module 4 Verification System)
  verification_level int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists businesses_owner_idx    on public.businesses (owner_user_id);
create index if not exists businesses_status_idx   on public.businesses (status);
create index if not exists businesses_category_idx on public.businesses (category);

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ── business_subscriptions ───────────────────────────────────
-- One ACTIVE row per business is the current plan. The full Subscription
-- System (Module 3) governs billing/renewal; onboarding only records the
-- plan the owner explicitly selected to activate the account.
create table if not exists public.business_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  plan_id         text not null
                    check (plan_id in ('free','starter','pro','premium')),
  billing_cycle   text not null default 'monthly'
                    check (billing_cycle in ('monthly','yearly')),
  status          text not null default 'active'
                    check (status in ('active','expired','downgraded','scheduled')),
  current_period_end timestamptz,
  auto_renew      boolean not null default true,
  selected_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists biz_subs_business_idx on public.business_subscriptions (business_id);

-- One business cannot hold two active subscriptions at once.
create unique index if not exists biz_subs_one_active_idx
  on public.business_subscriptions (business_id)
  where status = 'active';

-- ── business_staff (MODULE 2 — Business Profiles) ────────────
-- Join table linking PaMarket users to a business as staff. The owner is NOT a
-- row here (ownership lives on businesses.owner_user_id); this is additive staff.
create table if not exists public.business_staff (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)  on delete cascade,
  role          text not null default 'staff'
                  check (role in ('manager','staff')),
  invited_by    uuid references public.profiles(id),
  status        text not null default 'invited'
                  check (status in ('invited','active','removed')),
  created_at    timestamptz not null default now()
);

-- A user can hold only one membership row per business.
create unique index if not exists business_staff_unique
  on public.business_staff (business_id, user_id);
create index if not exists business_staff_user_idx on public.business_staff (user_id);

-- ── business_verifications (MODULE 4 — Verification System) ──
-- A submission raising a business's verification_level. Approved by Admin
-- (Module 12), which writes businesses.verification_level. Levels:
--   1 = phone verified, 2 = owner ID verified, 3 = business document verified.
create table if not exists public.business_verifications (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  level_requested int  not null check (level_requested between 1 and 3),
  id_doc_path     text,
  reg_doc_path    text,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  admin_note      text,
  submitted_at    timestamptz not null default now()
);
create index if not exists business_verif_business_idx on public.business_verifications (business_id);

-- ── Row Level Security ───────────────────────────────────────
alter table public.businesses            enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.business_staff         enable row level security;
alter table public.business_verifications enable row level security;

drop policy if exists "business_verif: owner rw" on public.business_verifications;
create policy "business_verif: owner rw"
  on public.business_verifications for all
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.businesses b
                      where b.id = business_id and b.owner_user_id = auth.uid()));

-- Active businesses are publicly readable (so buyers can see the storefront);
-- the owner can always read their own, even while still in draft.
drop policy if exists "businesses: public read active" on public.businesses;
create policy "businesses: public read active"
  on public.businesses for select
  using (status = 'active' or owner_user_id = auth.uid());

-- Owner can create their own business (owner_user_id must be themselves)
drop policy if exists "businesses: owner insert" on public.businesses;
create policy "businesses: owner insert"
  on public.businesses for insert
  with check (owner_user_id = auth.uid());

-- Owner can update only their own business
drop policy if exists "businesses: owner update" on public.businesses;
create policy "businesses: owner update"
  on public.businesses for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Subscriptions: readable/writable only by the owning business's owner
drop policy if exists "biz_subs: owner read" on public.business_subscriptions;
create policy "biz_subs: owner read"
  on public.business_subscriptions for select
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_user_id = auth.uid()
  ));

drop policy if exists "biz_subs: owner write" on public.business_subscriptions;
create policy "biz_subs: owner write"
  on public.business_subscriptions for insert
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_user_id = auth.uid()
  ));

drop policy if exists "biz_subs: owner update" on public.business_subscriptions;
create policy "biz_subs: owner update"
  on public.business_subscriptions for update
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_user_id = auth.uid()
  ));

-- ── business_staff policies ──────────────────────────────────
-- A staff row is visible to: the business owner, or the staff member themselves.
drop policy if exists "business_staff: visible to owner or member" on public.business_staff;
create policy "business_staff: visible to owner or member"
  on public.business_staff for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b
               where b.id = business_id and b.owner_user_id = auth.uid())
  );

-- Only the business owner can add staff.
drop policy if exists "business_staff: owner invites" on public.business_staff;
create policy "business_staff: owner invites"
  on public.business_staff for insert
  with check (exists (select 1 from public.businesses b
                      where b.id = business_id and b.owner_user_id = auth.uid()));

-- Owner can change role/remove; a staff member can update their OWN row
-- (e.g. accept/decline an invite by moving invited → active/removed).
drop policy if exists "business_staff: owner or self update" on public.business_staff;
create policy "business_staff: owner or self update"
  on public.business_staff for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b
               where b.id = business_id and b.owner_user_id = auth.uid())
  );

-- Owner can delete staff rows outright.
drop policy if exists "business_staff: owner delete" on public.business_staff;
create policy "business_staff: owner delete"
  on public.business_staff for delete
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.owner_user_id = auth.uid()));

-- ── MODULE 5: link listings to a business ──────────────────
alter table public.listings add column if not exists business_id uuid references public.businesses(id) on delete set null;
create index if not exists listings_business_idx on public.listings (business_id);

-- ── business_leads (MODULE 6 — Lead System, no payments) ─────
create table if not exists public.business_leads (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  listing_id   uuid references public.listings(id) on delete set null,
  user_id      uuid references public.profiles(id) on delete set null,
  user_name    text,
  type         text not null check (type in ('whatsapp','call','chat')),
  status       text not null default 'new' check (status in ('new','active','closed')),
  created_at   timestamptz not null default now()
);
create index if not exists business_leads_business_idx on public.business_leads (business_id);
alter table public.business_leads enable row level security;

drop policy if exists "business_leads: owner reads" on public.business_leads;
create policy "business_leads: owner reads"
  on public.business_leads for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid()));

drop policy if exists "business_leads: anyone inserts" on public.business_leads;
create policy "business_leads: anyone inserts"
  on public.business_leads for insert to authenticated with check (true);

drop policy if exists "business_leads: owner updates" on public.business_leads;
create policy "business_leads: owner updates"
  on public.business_leads for update
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid()));

-- ── business_quick_replies (MODULE 7 — Messaging) ────────────
create table if not exists public.business_quick_replies (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists business_qr_business_idx on public.business_quick_replies (business_id);
alter table public.business_quick_replies enable row level security;
drop policy if exists "business_qr: owner rw" on public.business_quick_replies;
create policy "business_qr: owner rw"
  on public.business_quick_replies for all
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid()));
