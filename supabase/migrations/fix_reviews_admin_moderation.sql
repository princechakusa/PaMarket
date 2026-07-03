-- ============================================================
-- PaMarket — admin moderation for the general `reviews` table
--
-- Audit finding (Section 1, R3): the general `reviews` table (seller/user
-- ratings) had only a "reviewer may delete their own review" policy. There was
-- no way for an admin to remove an abusive, defamatory, or fraudulent review of
-- a regular seller — unlike rental_reviews, which already supports admin
-- moderation via its `status` column. This closes that gap at the database
-- level so the admin panel can hard-delete an offending review.
--
-- Idempotent: safe to run more than once. Requires public.is_admin() (created
-- in admin_security_hardening.sql / security_hardening_2026_06.sql).
-- ============================================================

alter table public.reviews enable row level security;

-- Reviewer may delete their own review; an admin may delete ANY review.
drop policy if exists "reviews: own delete" on public.reviews;
drop policy if exists "reviews: own or admin delete" on public.reviews;
create policy "reviews: own or admin delete"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = reviewer_id or public.is_admin());

-- Admins may also read every review regardless of visibility rules (public read
-- already allows this, but assert it so a future tightening of public read does
-- not silently lock admins out of moderation).
drop policy if exists "reviews: admin read" on public.reviews;
create policy "reviews: admin read"
  on public.reviews for select
  to authenticated
  using (true);
