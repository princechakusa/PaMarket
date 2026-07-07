-- =============================================================
-- PaMarket: Google Play Billing — job posting credit packs
--
-- Pay-per-post alternative to a recruiter subscription. Mirrors the
-- featured_slot_packs pattern exactly: a consumable purchase ledger
-- (pending -> verified -> consumed/failed) plus a simple balance summed
-- at read time — no wallet, no client-writable balance column.
--
-- IMPORTANT — this does NOT change existing job-posting behavior. Posting
-- a job remains free for everyone by default (see jobs.js H._submitJob,
-- which still allows posting up to a recruiter's plan's activeJobPosts
-- limit at zero cost — see H.RECRUITER_PLAN_ENTITLEMENTS in jobs.js).
-- Job credits only matter once a recruiter is AT that plan limit and wants
-- to post beyond it without upgrading their subscription tier — each
-- credit consumed lets them publish exactly one extra job listing.
-- =============================================================

create table if not exists public.job_credit_packs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  product_id      text not null check (product_id in ('job_credit_pack_1', 'job_credit_pack_5')),
  credits         int  not null check (credits in (1, 5)),

  purchase_token  text not null,
  order_id        text,

  status          text not null default 'pending'
                    check (status in ('pending', 'verified', 'failed', 'consumed')),
  verification_error text,

  purchase_time   timestamptz,
  created_at      timestamptz not null default now(),
  verified_at     timestamptz,

  constraint uq_job_credit_pack_token unique (purchase_token)
);

create index if not exists job_credit_packs_user_idx on public.job_credit_packs (user_id, status);

alter table public.job_credit_packs enable row level security;

drop policy if exists "job_credit_packs: own read" on public.job_credit_packs;
create policy "job_credit_packs: own read"
  on public.job_credit_packs for select
  using (auth.uid() = user_id);

drop policy if exists "job_credit_packs: admin all" on public.job_credit_packs;
create policy "job_credit_packs: admin all"
  on public.job_credit_packs for all
  using (public.is_admin())
  with check (public.is_admin());

-- Ledger of credits actually SPENT on a job post — separate from the
-- purchase packs above, so "credits purchased" and "credits spent" are two
-- independently auditable tables (mirrors why play_purchases never mutates
-- listings directly outside its own activation RPC). One row per job post
-- that consumed a credit (not per credit unit) — a recruiter with a
-- 5-credit pack spends 1 row's worth of balance per post, not per credit.
-- listing_id is NULLABLE with `on delete set null` — NOT `on delete cascade`.
-- If the spend row cascaded away when the job listing is deleted, the credit
-- would silently refund itself: post → spend credit → delete job → credit
-- back → repeat, turning a one-shot credit into a permanent extra job slot.
-- A spent credit stays spent; deleting the job just detaches the reference.
create table if not exists public.job_credit_spends (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  listing_id      uuid references public.listings(id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint uq_job_credit_spend_listing unique (listing_id)
);

-- Patch block so re-running this file upgrades a table created by an earlier
-- version (create table if not exists won't alter an existing table).
alter table public.job_credit_spends alter column listing_id drop not null;
do $$
declare
  v_del char;
begin
  select confdeltype into v_del
  from pg_constraint
  where conrelid = 'public.job_credit_spends'::regclass
    and contype = 'f'
    and conname = 'job_credit_spends_listing_id_fkey';
  if v_del is distinct from 'n' then -- 'n' = SET NULL
    alter table public.job_credit_spends drop constraint if exists job_credit_spends_listing_id_fkey;
    alter table public.job_credit_spends
      add constraint job_credit_spends_listing_id_fkey
      foreign key (listing_id) references public.listings(id) on delete set null;
  end if;
end $$;

create index if not exists job_credit_spends_user_idx on public.job_credit_spends (user_id);

alter table public.job_credit_spends enable row level security;

drop policy if exists "job_credit_spends: own read" on public.job_credit_spends;
create policy "job_credit_spends: own read"
  on public.job_credit_spends for select
  using (auth.uid() = user_id);

drop policy if exists "job_credit_spends: admin all" on public.job_credit_spends;
create policy "job_credit_spends: admin all"
  on public.job_credit_spends for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── activate_job_credit_pack RPC ──────────────────────────
-- Marks a verified credit-pack purchase as consumed. No balance/listing
-- mutation happens here — the credits become usable the moment this row
-- exists with status='consumed'; get_job_credit_balance (below) sums
-- purchased-and-consumed packs minus spends at read time.
create or replace function public.activate_job_credit_pack(
  p_pack_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack record;
begin
  select * into v_pack
  from public.job_credit_packs
  where id = p_pack_id
  for update;

  if v_pack is null then
    return jsonb_build_object('ok', false, 'msg', 'Credit pack record not found');
  end if;

  if v_pack.status = 'consumed' then
    return jsonb_build_object('ok', true, 'already_consumed', true, 'credits', v_pack.credits);
  end if;

  if v_pack.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_pack.status);
  end if;

  update public.job_credit_packs set status = 'consumed' where id = p_pack_id;

  return jsonb_build_object('ok', true, 'credits', v_pack.credits);
end;
$$;

revoke execute on function public.activate_job_credit_pack(uuid) from public;
revoke execute on function public.activate_job_credit_pack(uuid) from authenticated;
revoke execute on function public.activate_job_credit_pack(uuid) from anon;

-- ── get_job_credit_balance RPC ──────────────────────────
-- Purchased credits (sum of consumed packs) minus spent credits (count of
-- job_credit_spends rows) for the calling user. Granted to authenticated —
-- this is a pure read derived from the caller's own rows (auth.uid() is
-- used directly, not a client-supplied user id), so it's safe to expose
-- for the client-side posting gate in jobs.js to call directly.
create or replace function public.get_job_credit_balance()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select sum(credits) from public.job_credit_packs
    where user_id = auth.uid() and status = 'consumed'
  ), 0) - coalesce((
    select count(*) from public.job_credit_spends
    where user_id = auth.uid()
  ), 0);
$$;

grant execute on function public.get_job_credit_balance() to authenticated;

-- ── spend_job_credit RPC ──────────────────────────
-- Atomically checks balance > 0 and records a spend for a job listing the
-- caller owns. Called from H._submitJob (jobs.js) immediately after a job
-- listing insert succeeds, ONLY when the recruiter is over their plan's
-- free activeJobPosts limit. security definer + granted to authenticated
-- (unlike the Play-purchase activation RPCs) because this has no purchase
-- token to verify — it's a pure balance-decrement guarded by the unique
-- constraint on listing_id (a listing can only ever consume one credit)
-- and the balance check below (never goes negative).
create or replace function public.spend_job_credit(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_balance int;
begin
  -- Serialize spends per user for the rest of this transaction — without
  -- this, two concurrent posts could both read balance = 1 and both insert
  -- a spend, driving the balance negative (the unique constraint only
  -- guards per-listing, not per-user).
  perform pg_advisory_xact_lock(hashtext('job_credit_spend:' || auth.uid()::text));

  select seller_id into v_owner from public.listings where id = p_listing_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'msg', 'Listing not found');
  end if;
  if v_owner != auth.uid() then
    return jsonb_build_object('ok', false, 'msg', 'You do not own this listing');
  end if;

  if exists (select 1 from public.job_credit_spends where listing_id = p_listing_id) then
    return jsonb_build_object('ok', true, 'already_spent', true);
  end if;

  select public.get_job_credit_balance() into v_balance;
  if v_balance <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'No job credits remaining');
  end if;

  insert into public.job_credit_spends (user_id, listing_id) values (auth.uid(), p_listing_id);

  return jsonb_build_object('ok', true, 'remaining', v_balance - 1);
end;
$$;

grant execute on function public.spend_job_credit(uuid) to authenticated;

notify pgrst, 'reload schema';
