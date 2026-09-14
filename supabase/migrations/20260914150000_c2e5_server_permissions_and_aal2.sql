-- C2E-5: server permissions + AAL2 alignment.
--
-- N-06: several AMOS/analytics/recruitment/notifications/admin-session
-- objects gate on is_admin_team() (rank >= 2: super_admin/admin/moderator/
-- support/finance), which is broader than the client permission matrix
-- (admin/src/security/permissions.ts) — amos.*, analytics.view, and
-- candidate-PII exposure are only granted to the operationalAdmin set
-- (admin + super_admin), not to moderator/support/finance. This migration
-- narrows those specific objects to public.has_admin_privilege('admin')
-- (rank >= 3, already exists from C2B) or public.is_super_admin() for
-- integration-credential-adjacent objects. No new role system, no new
-- helper function — reuses has_admin_privilege()/is_super_admin() exactly
-- as their own doc comments recommend for new work.
--
-- N-07: update_shop_order_status/rental_set_listing_state/the five
-- admin_*_paid_ad* functions rely on is_admin()/an admin override branch
-- without requiring AAL2. This migration adds public.has_mfa_aal2() to the
-- admin-privileged path of each — for the two functions also used by
-- ordinary business owners/customers (update_shop_order_status,
-- rental_set_listing_state), AAL2 is required only on the admin-override
-- branch, never on the owner/customer's own normal transitions.
--
-- Left deliberately untouched (out of C2E-5 scope, see the C2E-5 report):
-- chats/support tickets, moderation_appeals, job_runs, search_logs,
-- profiles admin-update, app_error_events, enforce_recruitment_contact_
-- authority(), list_my_contact_requests() — all still is_admin_team() and
-- flagged as N-06-adjacent for a future stage, not silently pulled in here.
-- admin_saved_views is already correctly owner-scoped and is left as-is.

-- ── Part A: AMOS RLS policies ────────────────────────────────────────────
-- amos_integrations and amos_oauth_states hold connection/credential state
-- for third-party providers, so they get is_super_admin() (matching
-- amos_set_integration_credential's existing super_admin + AAL2 gate).
-- Every other amos_* table is admin-tier (has_admin_privilege('admin')),
-- matching amos.view/amos.run/amos.publish being operationalAdmin-only in
-- the client permission matrix.

drop policy if exists "amos_brand_kit team" on "public"."amos_brand_kit";
create policy "amos_brand_kit team" on "public"."amos_brand_kit"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_calendar team" on "public"."amos_zw_calendar";
create policy "amos_calendar team" on "public"."amos_zw_calendar"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_cd team" on "public"."amos_content_drafts";
create policy "amos_cd team" on "public"."amos_content_drafts"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_ci team" on "public"."amos_content_items";
create policy "amos_ci team" on "public"."amos_content_items"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_competitor_watchlist team" on "public"."amos_competitor_watchlist";
create policy "amos_competitor_watchlist team" on "public"."amos_competitor_watchlist"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_countries team" on "public"."amos_countries";
create policy "amos_countries team" on "public"."amos_countries"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_cr team" on "public"."amos_content_revisions";
create policy "amos_cr team" on "public"."amos_content_revisions"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_feedback team" on "public"."amos_content_feedback";
create policy "amos_feedback team" on "public"."amos_content_feedback"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_integrations team" on "public"."amos_integrations";
create policy "amos_integrations team" on "public"."amos_integrations"
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "amos_learning team" on "public"."amos_learning_signals";
create policy "amos_learning team" on "public"."amos_learning_signals"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_media team" on "public"."amos_media_assets";
create policy "amos_media team" on "public"."amos_media_assets"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_media_jobs team" on "public"."amos_media_jobs";
create policy "amos_media_jobs team" on "public"."amos_media_jobs"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_metrics team" on "public"."amos_metrics_daily";
create policy "amos_metrics team" on "public"."amos_metrics_daily"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_mi team" on "public"."amos_market_intelligence";
create policy "amos_mi team" on "public"."amos_market_intelligence"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_oauth_states team" on "public"."amos_oauth_states";
create policy "amos_oauth_states team" on "public"."amos_oauth_states"
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "amos_pl team" on "public"."amos_publish_log";
create policy "amos_pl team" on "public"."amos_publish_log"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_publish_audit team" on "public"."amos_publish_audit";
create policy "amos_publish_audit team" on "public"."amos_publish_audit"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_reports team" on "public"."amos_reports";
create policy "amos_reports team" on "public"."amos_reports"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_sched team" on "public"."amos_schedule";
create policy "amos_sched team" on "public"."amos_schedule"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_seo team" on "public"."amos_seo_recommendations";
create policy "amos_seo team" on "public"."amos_seo_recommendations"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "amos_settings team" on "public"."amos_settings";
create policy "amos_settings team" on "public"."amos_settings"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

-- ── Part B: Analytics RPCs ────────────────────────────────────────────────
-- analytics.view is operationalAdmin-only in the client matrix; all six
-- were is_admin_team() (rank >= 2). Bodies otherwise unchanged.

create or replace function "public"."admin_category_breakdown"() returns table("category" text, "n" bigint)
    language "sql" security definer
    set "search_path" to 'public'
    as $$
  SELECT COALESCE(category,'other') AS category, COUNT(*) AS n
  FROM listings
  WHERE public.has_admin_privilege('admin')
  GROUP BY 1 ORDER BY 2 DESC;
$$;

create or replace function "public"."admin_cohorts"("weeks" integer default 8) returns table("cohort" date, "signups" bigint, "verified" bigint)
    language "sql" security definer
    set "search_path" to 'public'
    as $$
  SELECT date_trunc('week', created_at)::date AS cohort,
         COUNT(*) AS signups,
         COUNT(*) FILTER (WHERE verified) AS verified
  FROM profiles
  WHERE public.has_admin_privilege('admin')
    AND created_at >= now() - (weeks || ' weeks')::interval
  GROUP BY 1 ORDER BY 1;
$$;

create or replace function "public"."admin_daily_growth"("days" integer default 30) returns table("d" date, "users" bigint, "listings" bigint)
    language "sql" security definer
    set "search_path" to 'public'
    as $$
  WITH span AS (
    SELECT generate_series((now()::date - (days-1)), now()::date, '1 day')::date AS d
  )
  SELECT s.d,
    (SELECT COUNT(*) FROM profiles p WHERE p.created_at::date = s.d) AS users,
    (SELECT COUNT(*) FROM listings l WHERE l.created_at::date = s.d) AS listings
  FROM span s
  WHERE public.has_admin_privilege('admin')
  ORDER BY s.d;
$$;

create or replace function "public"."admin_province_breakdown"() returns table("province" text, "n" bigint)
    language "sql" security definer
    set "search_path" to 'public'
    as $$
  SELECT COALESCE(province,'Unknown') AS province, COUNT(*) AS n
  FROM listings
  WHERE public.has_admin_privilege('admin')
  GROUP BY 1 ORDER BY 2 DESC;
$$;

create or replace function "public"."admin_revenue_summary"("days" integer default 30) returns jsonb
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $$
DECLARE result jsonb; since timestamptz := now() - (days || ' days')::interval;
BEGIN
  IF NOT public.has_admin_privilege('admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
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
  WHERE public.has_admin_privilege('admin') AND status='paid'
    AND created_at >= now() - (days || ' days')::interval
  GROUP BY 1 ORDER BY 2 DESC LIMIT lim;
$$;

-- ── Part C: Recruitment candidate access ─────────────────────────────────
-- These two RPCs already gate on is_authorized_recruiter() (verified
-- employers, or admin/moderator) for basic access — that gate is untouched.
-- Only the internal is_admin_team() branch that de-anonymizes name/avatar/
-- phone/email without an approved contact request is narrowed, so
-- moderator/support/finance see the same anonymized view an ordinary
-- recruiter would without an approved contact, matching the client matrix
-- (no staff role below admin has any candidate-identity permission).

create or replace function "public"."browse_recruitment_candidates"("p_query" text default null::text, "p_sector" text default null::text, "p_experience" text default null::text, "p_city" text default null::text, "p_limit" integer default 40, "p_offset" integer default 0) returns table("id" uuid, "name" text, "avatar" text, "verified" boolean, "job_title" text, "skills" text, "sector" text, "exp" text, "province" text, "city" text, "open_to_work" boolean, "cv" jsonb, "updated_at" timestamp with time zone)
    language "plpgsql" security definer
    set "search_path" to 'public', 'pg_temp'
    as $$
begin
  if not public.is_authorized_recruiter() then
    raise exception 'Verified employer access required.' using errcode = '42501';
  end if;

  insert into public.recruitment_candidate_refs (candidate_id)
  select p.id from public.profiles p
  where p.status = 'active' and p.open_to_work is true
  on conflict (candidate_id) do nothing;

  return query
    select r.ref_id,
           case when public.has_admin_privilege('admin') or exists (
             select 1 from public.contact_requests cr
             where cr.requester_id = auth.uid() and cr.candidate_id = p.id and cr.status = 'approved'
           ) then p.name else null end as name,
           case when public.has_admin_privilege('admin') or exists (
             select 1 from public.contact_requests cr
             where cr.requester_id = auth.uid() and cr.candidate_id = p.id and cr.status = 'approved'
           ) then p.avatar else null end as avatar,
           p.verified, p.job_title, p.skills,
           p.sector, p.exp, p.province, p.city, p.open_to_work,
           public.recruitment_public_cv(p.cv), p.updated_at
    from public.profiles p
    join public.recruitment_candidate_refs r on r.candidate_id = p.id
    where p.status = 'active'
      and p.open_to_work is true
      and (nullif(btrim(p_query), '') is null or
        p.name ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.job_title ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.sector ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.skills ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.city ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
      and (nullif(p_sector, '') is null or p.sector = p_sector)
      and (nullif(p_experience, '') is null or p.exp = p_experience)
      and (nullif(p_city, '') is null or p.city = p_city)
    order by p.updated_at desc nulls last, p.id
    limit p_limit offset p_offset;
end;
$$;

create or replace function "public"."get_recruitment_candidate"("p_candidate_id" uuid) returns table("id" uuid, "name" text, "avatar" text, "phone" text, "email" text, "contact_authorized" boolean, "has_cv" boolean, "verified" boolean, "job_title" text, "skills" text, "sector" text, "exp" text, "province" text, "city" text, "open_to_work" boolean, "cv" jsonb, "updated_at" timestamp with time zone)
    language "plpgsql" security definer
    set "search_path" to 'public', 'pg_temp'
    as $$
declare
  v_real_id uuid;
  v_application_access boolean;
  v_contact_access boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_real_id := public.recruitment_resolve_ref(p_candidate_id);

  select exists (
    select 1 from public.applications a join public.listings j on j.id = a.job_id
    where a.applicant_id = v_real_id and j.seller_id = auth.uid()
  ) into v_application_access;
  if auth.uid() <> v_real_id and not public.is_authorized_recruiter() and not v_application_access then
    raise exception 'Candidate profile access denied.' using errcode = '42501';
  end if;
  v_contact_access := auth.uid() = v_real_id or public.has_admin_privilege('admin') or v_application_access
    or exists (select 1 from public.contact_requests cr where cr.requester_id = auth.uid()
      and cr.candidate_id = v_real_id and cr.status = 'approved');

  return query select public.recruitment_ensure_ref(p.id),
    case when v_contact_access then p.name else null end,
    case when v_contact_access then p.avatar else null end,
    case when v_contact_access then p.phone else null end,
    case when v_contact_access then p.email else null end,
    v_contact_access, (p.cv_file_path is not null or p.cv_file_url is not null),
    p.verified,p.job_title,p.skills,p.sector,p.exp,p.province,p.city,p.open_to_work,
    public.recruitment_public_cv(p.cv),p.updated_at
  from public.profiles p where p.id = v_real_id and p.status = 'active'
    and (p.id = auth.uid() or p.open_to_work is true or v_application_access);
end;
$$;

drop policy if exists "recruitment_candidate_refs: admin all" on "public"."recruitment_candidate_refs";
create policy "recruitment_candidate_refs: admin all" on "public"."recruitment_candidate_refs"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

drop policy if exists "recruitment_conversation_context: admin all" on "public"."recruitment_conversation_context";
create policy "recruitment_conversation_context: admin all" on "public"."recruitment_conversation_context"
  using (public.has_admin_privilege('admin')) with check (public.has_admin_privilege('admin'));

-- ── Part D: Notifications + admin sessions ───────────────────────────────
-- notifications: no notifications.* permission exists in the client
-- matrix, so this narrows the over-grant (previously any of the 5 staff
-- roles could read/update ANY user's notification rows) to admin-tier —
-- the closest defensible match, since none of moderator/support/finance
-- have a permission implying broad user-notification visibility, while
-- admin/super_admin's operational need is preserved. See the C2E-5 report
-- for this judgment call.

drop policy if exists "notifications: own read" on "public"."notifications";
create policy "notifications: own read" on "public"."notifications" for select to "authenticated"
  using ((("user_id" = ("auth"."uid"())::"text") or public.has_admin_privilege('admin')));

drop policy if exists "notifications: own update" on "public"."notifications";
create policy "notifications: own update" on "public"."notifications" for update to "authenticated"
  using ((("user_id" = ("auth"."uid"())::"text") or public.has_admin_privilege('admin')));

-- admin_sessions: was is_admin_team() (any of 5 staff roles could read AND
-- revoke/modify ANY other staff member's session rows). admins.manage is
-- super_admin-only in the client matrix, so unrestricted cross-account
-- session control is narrowed to super_admin; every staff member keeps
-- full access to their own session rows regardless of role.

drop policy if exists "admin_sessions team" on "public"."admin_sessions";
create policy "admin_sessions team" on "public"."admin_sessions"
  using (("admin_id" = "auth"."uid"()) or public.is_super_admin())
  with check (("admin_id" = "auth"."uid"()) or public.is_super_admin());

-- admin_saved_views is intentionally left unchanged: "saved_views own"
-- already requires (admin_id = auth.uid() AND is_admin_team()), which is
-- correctly owner-scoped — no staff member can see or write another's
-- saved view regardless of role.

-- ── Part E: AAL2 on high-impact mutations (N-07) ─────────────────────────
-- The five paid-ad admin functions are pure admin-only (no owner/customer
-- branch) — AAL2 is added unconditionally alongside the existing is_admin()
-- check. update_shop_order_status and rental_set_listing_state are shared
-- with ordinary business owners/customers, so AAL2 is required only on the
-- admin-override branch, never on the owner's/customer's own transitions.

create or replace function "public"."admin_create_paid_ad"("p_business_name" text, "p_advertiser_id" uuid, "p_headline" text, "p_tagline" text, "p_image_url" text, "p_bg_color" text, "p_type" text, "p_target_section" text, "p_target_cat" text, "p_listing_id" uuid, "p_link_url" text, "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_price_paid" numeric) returns table("id" uuid, "status" text, "active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    language "plpgsql" security definer
    set "search_path" to ''
    as $_$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
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
$_$;

create or replace function "public"."admin_delete_paid_ad"("p_ad_id" uuid) returns uuid
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
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

create or replace function "public"."admin_expire_due_paid_ads"() returns integer
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  update public.paid_ads
  set active = false, updated_at = now()
  where active = true and ends_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function "public"."admin_pause_scheduled_paid_ad"("p_ad_id" uuid) returns table("id" uuid, "active" boolean, "status" text)
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
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

create or replace function "public"."admin_set_paid_ad_active"("p_ad_id" uuid, "p_active" boolean) returns table("id" uuid, "active" boolean, "status" text)
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not public.has_mfa_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
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

create or replace function "public"."update_shop_order_status"("p_order_id" uuid, "p_new_status" text, "p_note" text default null::text) returns jsonb
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_customer boolean;
  v_valid_transition boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated', 'msg', 'Please sign in again.');
  end if;

  if p_new_status not in ('pending','confirmed','declined','preparing','ready','completed','cancelled') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'msg', 'That is not a valid order status.');
  end if;

  select o.id, o.business_id, o.customer_id, o.status into v_order
  from public.shop_orders o
  where o.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'msg', 'Order not found.');
  end if;

  v_is_admin := public.is_admin();
  select exists (
    select 1 from public.businesses b where b.id = v_order.business_id and b.owner_user_id = v_uid
  ) into v_is_owner;
  v_is_customer := (v_order.customer_id = v_uid);

  -- Customer may now cancel their own order; every other transition
  -- remains owner/admin-only exactly as before.
  if not (v_is_owner or v_is_admin or v_is_customer) then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'msg', 'You are not allowed to update this order.');
  end if;

  if v_is_admin and not v_is_owner then
    -- Administrators may make any transition, including correcting a
    -- final status, per the business rule that only an admin may
    -- change an order once it has reached a final state. C2E-5: this
    -- admin-override path now requires AAL2 — the owner/customer
    -- branches below are never gated on AAL2.
    if not public.has_mfa_aal2() then
      return jsonb_build_object('ok', false, 'code', 'mfa_required', 'msg', 'Verify with your second factor to make this change.');
    end if;
    v_valid_transition := true;
  elsif v_is_owner then
    v_valid_transition := (v_order.status, p_new_status) in (
      ('pending','confirmed'), ('pending','declined'), ('pending','cancelled'),
      ('confirmed','preparing'), ('confirmed','cancelled'),
      ('preparing','ready'), ('preparing','cancelled'),
      ('ready','completed')
    );
  elsif v_is_customer then
    v_valid_transition := p_new_status = 'cancelled' and v_order.status in ('pending', 'confirmed');
  end if;

  if not v_valid_transition then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition', 'msg', 'This order cannot move from ' || v_order.status || ' to ' || p_new_status || '.');
  end if;

  update public.shop_orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id;

  insert into public.shop_order_status_history (order_id, status, note, changed_by)
  values (p_order_id, p_new_status, p_note, v_uid);

  return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', p_new_status);
exception
  when others then
    return jsonb_build_object('ok', false, 'code', 'update_failed', 'msg', 'Could not update this order. Please try again.');
end;
$$;

create or replace function "public"."rental_set_listing_state"("p_listing_id" uuid, "p_new_state" text, "p_reason" text default null::text, "p_auto_return" timestamp with time zone default null::timestamp with time zone) returns void
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $$
declare
  v_is_owner boolean;
begin
  select exists (
    select 1
    from public.rental_vehicle_listings l
    join public.rental_companies rc on rc.id = l.company_id
    join public.businesses b        on b.id = rc.business_id
    where l.id = p_listing_id
      and b.owner_user_id = auth.uid()
  ) into v_is_owner;

  -- Owner acting on their own listing: no AAL2 requirement, unchanged
  -- behaviour. Admin acting on someone else's listing: C2E-5 now requires
  -- AAL2 on this override path.
  if not v_is_owner then
    if not public.is_admin() then
      raise exception 'Not authorized to change the state of this listing.';
    end if;
    if not public.has_mfa_aal2() then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
  end if;

  insert into public.rental_vehicle_states
    (listing_id, current_state, changed_by, change_reason, auto_return_at)
  values
    (p_listing_id, p_new_state, auth.uid(), p_reason, p_auto_return)
  on conflict (listing_id) do update set
    current_state  = excluded.current_state,
    changed_by     = excluded.changed_by,
    change_reason  = excluded.change_reason,
    auto_return_at = excluded.auto_return_at,
    updated_at     = now();
end;
$$;

-- Phase 9: this function was directly and unnecessarily callable by anon
-- (the internal owner/is_admin() check happened to make an anon call
-- fail anyway, but the grant itself was still wrong — auth.uid() is
-- always null for anon, so it could never pass either branch).
revoke execute on function "public"."rental_set_listing_state"("p_listing_id" uuid, "p_new_state" text, "p_reason" text, "p_auto_return" timestamp with time zone) from "anon";
