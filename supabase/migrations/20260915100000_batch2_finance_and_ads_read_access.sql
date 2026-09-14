-- Batch 2 (Commerce + Rentals + Reviews): two smallest-safe-change backend
-- fixes discovered during inspection, both directly blocking in-scope
-- Batch 2 capabilities.
--
-- 1. FINANCE REVENUE ACCESS — confirmed live before this change:
-- admin_revenue_summary()/admin_top_payers() both gate on
-- has_admin_privilege('admin') (rank >= 3: admin/super_admin only).
-- `finance`'s entire client permission set is dashboard.view/
-- monetization.view/revenue.view/ads.view/billing.view -- revenue
-- visibility is not incidental to this role, it is the role's whole
-- purpose. Without this fix, `finance` has zero functional capability in
-- Batch 2's Finance area despite being a defined staff role with a
-- permission explicitly named for it.
--
-- No existing helper expresses "admin/super_admin/finance" (is_admin_team()
-- is 5 roles, over-broad; has_admin_privilege() is rank-based and finance
-- shares rank 2 with moderator/support, so no rank threshold can select
-- finance alone). Adds is_finance_team(), mirroring is_support_team()'s
-- exact established pattern from C2E-8 -- not a new architecture, the same
-- pattern applied to the one remaining role that needed it.
--
-- Both RPCs return pure aggregate figures (sums/counts), never row-level
-- PII or payment records -- broadening their gate to include finance does
-- not expose anything beyond what the role's own permission already implies.

create or replace function "public"."is_finance_team"()
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'finance')
  );
$$;

create or replace function "public"."admin_revenue_summary"("days" integer default 30) returns jsonb
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $$
DECLARE result jsonb; since timestamptz := now() - (days || ' days')::interval;
BEGIN
  IF NOT public.is_finance_team() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'subs_paid',    COALESCE((SELECT SUM(amount) FROM business_payments WHERE status='paid' AND type='subscription' AND created_at >= since),0),
    'subs_failed',  COALESCE((SELECT COUNT(*) FROM business_payments WHERE status='failed' AND created_at >= since),0),
    'subs_pending', COALESCE((SELECT COUNT(*) FROM business_payments WHERE status='pending'),0),
    'other_paid',   COALESCE((SELECT SUM(amount) FROM business_payments WHERE status='paid' AND type<>'subscription' AND created_at >= since),0),
    'ads_revenue',  COALESCE((SELECT SUM(price_paid) FROM paid_ads),0),
    'txn_count',    COALESCE((SELECT COUNT(*) FROM business_payments WHERE created_at >= since),0)
  ) INTO result;
  RETURN result;
END; $$;

create or replace function "public"."admin_top_payers"("days" integer default 90, "lim" integer default 10) returns table("business_id" uuid, "total" numeric, "payments" bigint)
    language "sql" security definer
    set "search_path" to 'public'
    as $$
  SELECT business_id, SUM(amount) AS total, COUNT(*) AS payments
  FROM business_payments
  WHERE public.is_finance_team() AND status='paid'
    AND created_at >= now() - (days || ' days')::interval
  GROUP BY 1 ORDER BY 2 DESC LIMIT lim;
$$;

-- 2. PAID_ADS ADMIN READ — confirmed live before this change: paid_ads had
-- exactly one RLS policy, "paid_ads public read active" (active = true).
-- No admin-team SELECT policy exists at all, and none of the 5 existing
-- admin_*_paid_ad* RPCs (create/delete/expire/pause/set_active) provide a
-- list/read path either -- they only ever return the single row they just
-- mutated. This means Admin currently has no way to see scheduled, paused,
-- or expired ads -- exactly the records an Ads & Boosts workspace needs.
--
-- Adds one new, separate SELECT policy using is_admin() -- the same
-- precedent already used for every sibling commerce/business table
-- (businesses, business_verifications, business_payments, business_staff,
-- rental_*). The existing public-read-active policy and all 5 existing
-- mutation RPCs are untouched.

create policy "paid_ads: admin read" on "public"."paid_ads"
  for select
  using (public.is_admin());
