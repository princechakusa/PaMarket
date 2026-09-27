-- ============================================================================
-- Admin → General Settings: make the operational switches real.
--
-- Until now these app_settings.settings keys were saved by the admin panel
-- but read by nothing. This migration gives each one server-side teeth
-- (the mobile app / website hide the matching UI; this is what makes it
-- impossible to bypass):
--
--   signupPaused            → block_signup_when_paused (auth.users trigger)
--   requireListingApproval  → zz_listing_approval_gate (new listings → 'pending')
--   autoApproveVerified     → same trigger: verified sellers skip the queue
--   freeOnly                → biz_plan_* / recruiter_plan_job_limit return the
--                             top tier; recruiter contact needs no subscription
--   enablePremiumListings   → set to true here so boosts stay visible (it was
--                             false but never enforced; product decision
--                             2026-09-28). The switch is UI-only: a purchase
--                             that already happened must still activate.
--   showSponsoredAds / allowImageUploads → client + get-r2-upload-url edge fn
--   supportWhatsapp         → removed (duplicate of content.whatsappNumber)
--
-- Also fixes a real entitlement bug: the app sells the 'recruiter' plan as
-- unlimited job posts but recruiter_plan_job_limit capped it at 10.
--
-- Idempotent — safe to re-run. Run in the Supabase SQL editor.
-- ============================================================================

-- ── 0. Settings values ──────────────────────────────────────────────────────
update public.app_settings
set settings = (coalesce(settings, '{}'::jsonb) - 'supportWhatsapp')
               || jsonb_build_object('enablePremiumListings', true)
where id = 1;

-- Single reader for every trigger/function below. SECURITY DEFINER so it
-- works regardless of the caller's RLS; a missing key returns the default
-- that matches today's behaviour.
create or replace function public.app_setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case jsonb_typeof(settings -> p_key)
              when 'boolean' then (settings ->> p_key)::boolean
              else null
            end
     from public.app_settings where id = 1),
    p_default
  )
$$;
revoke execute on function public.app_setting_bool(text, boolean) from public, anon;
grant execute on function public.app_setting_bool(text, boolean) to authenticated, service_role;

create or replace function public.platform_free_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.app_setting_bool('freeOnly', false) $$;
revoke execute on function public.platform_free_mode() from public, anon;
grant execute on function public.platform_free_mode() to authenticated, service_role;

-- ── 1. Pause new signups ────────────────────────────────────────────────────
create or replace function public.block_signup_when_paused()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_setting_bool('signupPaused', false) then
    raise exception 'SIGNUP_PAUSED: new sign-ups are temporarily paused'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_signup_when_paused on auth.users;
create trigger trg_block_signup_when_paused
  before insert on auth.users
  for each row execute function public.block_signup_when_paused();

-- ── 2. Listing approval gate ────────────────────────────────────────────────
-- Named zz_* so it fires AFTER every other BEFORE trigger on listings
-- (Postgres fires same-timing triggers alphabetically): the job-credit and
-- moderation triggers still see the original 'active' insert, and this only
-- holds back what is still 'active' at the end.
create or replace function public.listing_approval_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified boolean;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if coalesce(new.status, 'active') <> 'active' then return new; end if;
  -- Upsert-edits arrive as INSERT first; never send a live ad back to review.
  if exists (select 1 from public.listings where id = new.id) then return new; end if;
  if not public.app_setting_bool('requireListingApproval', false) then return new; end if;

  if public.app_setting_bool('autoApproveVerified', false) then
    select coalesce(p.verified, false) into v_verified from public.profiles p where p.id = auth.uid();
    if coalesce(v_verified, false) then return new; end if;
  end if;

  new.status := 'pending';
  return new;
end;
$$;

drop trigger if exists zz_listing_approval_gate on public.listings;
create trigger zz_listing_approval_gate
  before insert on public.listings
  for each row execute function public.listing_approval_gate();

-- ── 3. Free-for-everyone mode + recruiter limit fix ─────────────────────────
-- These were IMMUTABLE pure lookups; they now read a setting, so STABLE.
create or replace function public.biz_plan_listing_limit(p_plan text)
returns int language sql stable security definer set search_path = public as
$$ select case when public.platform_free_mode() then -1 else
     case p_plan when 'starter' then 15 when 'pro' then 60 when 'premium' then -1 else 3 end
   end $$;

create or replace function public.biz_plan_featured_slots(p_plan text)
returns int language sql stable security definer set search_path = public as
$$ select case when public.platform_free_mode() then 3 else
     case p_plan when 'pro' then 1 when 'premium' then 3 else 0 end
   end $$;

create or replace function public.biz_plan_staff_limit(p_plan text)
returns int language sql stable security definer set search_path = public as
$$ select case when public.platform_free_mode() then -1 else
     case p_plan when 'starter' then 2 when 'pro' then 10 when 'premium' then -1 else 0 end
   end $$;

create or replace function public.recruiter_plan_job_limit(p_plan text)
returns int language sql stable security definer set search_path = public as
$$ select case when public.platform_free_mode() then -1 else
     case p_plan when 'recruiter' then -1 when 'recruiter_pro' then -1 else 2 end
   end $$;

-- request_candidate_contact: identical to 20260821200000 except the
-- subscription check is skipped in free mode.
create or replace function public.request_candidate_contact(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_real_candidate_id uuid;
  v_request public.contact_requests%rowtype;
  v_requester public.profiles%rowtype;
  v_candidate public.profiles%rowtype;
  v_safe_request jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  v_real_candidate_id := public.recruitment_resolve_ref(p_candidate_id);

  select * into v_requester from public.profiles where id = v_uid;
  if v_requester.id is null or v_requester.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'account_ineligible');
  end if;
  if not (coalesce(v_requester.company_verified, false) or v_requester.role in ('admin','moderator')) then
    return jsonb_build_object('ok', false, 'code', 'employer_verification_required');
  end if;
  if v_real_candidate_id = v_uid then return jsonb_build_object('ok', false, 'code', 'self_request_denied'); end if;

  select * into v_candidate from public.profiles
  where id = v_real_candidate_id and status = 'active' and open_to_work is true;
  if v_candidate.id is null then return jsonb_build_object('ok', false, 'code', 'candidate_unavailable'); end if;

  if not public.platform_free_mode() and not exists (
    select 1 from public.recruiter_profiles rp
    join public.recruiter_subscriptions rs on rs.recruiter_id = rp.id
    where rp.user_id = v_uid and rs.plan_id = 'recruiter'
      and rs.status = 'active' and rs.current_period_end is not null
      and rs.current_period_end > now()
  ) then return jsonb_build_object('ok', false, 'code', 'entitlement_required'); end if;

  perform pg_advisory_xact_lock(hashtext('candidate_contact:' || v_uid::text || ':' || v_real_candidate_id::text));
  select * into v_request from public.contact_requests
  where requester_id = v_uid and candidate_id = v_real_candidate_id for update;

  if v_request.id is not null and v_request.status in ('pending','approved') then
    v_safe_request := jsonb_build_object(
      'id', v_request.id, 'candidate_id', public.recruitment_ensure_ref(v_request.candidate_id),
      'status', v_request.status, 'created_at', v_request.created_at
    );
    return jsonb_build_object('ok', true, 'request', v_safe_request, 'existing', true);
  elsif v_request.id is not null then
    update public.contact_requests
    set requester_name = coalesce(v_requester.name,''), candidate_name = coalesce(v_candidate.name,''),
        company = coalesce(v_requester.company,''), status = 'pending', created_at = now(),
        decided_at = null, decided_by = null
    where id = v_request.id returning * into v_request;
  else
    insert into public.contact_requests
      (requester_id,candidate_id,requester_name,candidate_name,company,status)
    values (v_uid,v_real_candidate_id,coalesce(v_requester.name,''),coalesce(v_candidate.name,''),
            coalesce(v_requester.company,''),'pending') returning * into v_request;
  end if;

  v_safe_request := jsonb_build_object(
    'id', v_request.id, 'candidate_id', public.recruitment_ensure_ref(v_request.candidate_id),
    'status', v_request.status, 'created_at', v_request.created_at
  );
  return jsonb_build_object('ok', true, 'request', v_safe_request, 'existing', false);
end;
$$;
revoke execute on function public.request_candidate_contact(uuid) from public, anon;
grant execute on function public.request_candidate_contact(uuid) to authenticated;

notify pgrst, 'reload schema';
