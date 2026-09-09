-- ─────────────────────────────────────────────────────────────
-- CREATE business_verifications + businesses.verification_pending — 2026-09-09
--
-- Neither has ever existed on the live database. The mobile app's
-- business-verify/[id].tsx submit() has always written to both
-- unconditionally, with no error handling — every submission has silently
-- failed at both writes since the screen was built, so no business owner's
-- ID/registration documents were ever actually recorded anywhere, and
-- admins have only ever been able to set verification_level manually with
-- no document to review. admin.html's own comments already documented both
-- gaps (see doBizVerify's comment on verification_pending, and
-- business_admin_visibility_2026_06.sql's "may not exist in all
-- deployments" defensive check on this exact table) but neither was ever
-- actually created. This migration completes the feature.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.business_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  level_requested int not null,
  id_doc_path text,
  reg_doc_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists business_verifications_business_id_idx
  on public.business_verifications(business_id);
create index if not exists business_verifications_status_idx
  on public.business_verifications(status);

alter table public.business_verifications enable row level security;

-- Owner can submit and read their own business's verification requests.
drop policy if exists "biz_verif: owner insert own" on public.business_verifications;
create policy "biz_verif: owner insert own" on public.business_verifications for insert
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid())
  );

drop policy if exists "biz_verif: owner select own" on public.business_verifications;
create policy "biz_verif: owner select own" on public.business_verifications for select
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid())
  );

-- Admin can do everything (review, approve, reject) — reuses is_admin(),
-- already defined by business_admin_visibility_2026_06.sql. This mirrors
-- that migration's own already-written (but previously no-op, since the
-- table didn't exist) "biz_verif: admin all" policy intent.
drop policy if exists "biz_verif: admin all" on public.business_verifications;
create policy "biz_verif: admin all" on public.business_verifications for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert on public.business_verifications to authenticated;
grant all on public.business_verifications to service_role;

-- businesses.verification_pending: the flag business-verify/[id].tsx's
-- submit() has always tried (and failed) to set, and that its own
-- pendingReview banner already reads. Boolean, defaults false so existing
-- rows are unaffected.
alter table public.businesses
  add column if not exists verification_pending boolean not null default false;

notify pgrst, 'reload schema';
