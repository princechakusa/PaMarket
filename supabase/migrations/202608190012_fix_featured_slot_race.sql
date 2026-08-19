-- ============================================================
-- 202608190012_fix_featured_slot_race.sql
--
-- Audit 3/5 + 4/5: enforce_listing_feature_entitlement()'s slot-count check
-- (COUNT(*) of other currently-featured listings for a business, compared
-- against the plan's allowed slot count) has no locking — confirmed live,
-- unchanged since first flagged. Two concurrent "feature this listing"
-- UPDATEs on two DIFFERENT listings for the same business could each read
-- the same pre-commit slot count and both pass the check, overselling by
-- the number of concurrent requests (each locks only its own row via the
-- UPDATE itself, not the other rows being counted).
--
-- FIX: same proven pattern already used elsewhere in this codebase for
-- exactly this class of problem (spend_job_credit, create_job_listing —
-- see enforce_job_posting_entitlement.sql / add_job_credits.sql) —
-- pg_advisory_xact_lock keyed on business_id, taken before the count, so
-- concurrent feature-activation attempts for the SAME business serialize.
-- (A plain `SELECT ... FOR UPDATE` can't be combined with COUNT(*) in one
-- statement; an advisory lock avoids restructuring the query into two
-- round trips.) Different businesses are unaffected — the lock key is
-- scoped per business_id, not global.
--
-- No behavior change for the normal (non-concurrent) case: same checks,
-- same error codes/messages, same 31-day cap, same ownership check.
-- ============================================================

create or replace function public.enforce_listing_feature_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_plan text;
  v_extra int;
  v_used int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if TG_OP = 'INSERT' then
    if exists (select 1 from public.listings where id = NEW.id) then return NEW; end if;
    NEW.featured_until := null;
    NEW.boost := null;
    return NEW;
  end if;
  if NEW.featured_until is null or NEW.featured_until <= now()
     or (OLD.featured_until is not null and NEW.featured_until <= OLD.featured_until) then
    if NEW.featured_until is null or NEW.featured_until <= now() then NEW.boost := null; end if;
    return NEW;
  end if;
  if NEW.business_id is null then
    raise exception 'BOOST_REQUIRES_PURCHASE: featured placement requires a verified purchase';
  end if;
  if NEW.featured_until > now() + interval '31 days' then
    raise exception 'FEATURE_DURATION_LIMIT: featured placement cannot exceed 31 days';
  end if;

  select plan_id into v_plan
  from public.businesses
  where id = NEW.business_id and owner_user_id = auth.uid();
  if v_plan is null then raise exception 'FEATURE_NOT_OWNER: you do not own this business'; end if;

  -- Serialize concurrent feature-slot claims for this business — see
  -- migration header. Held for the rest of this transaction.
  perform pg_advisory_xact_lock(hashtext('feature_slot:' || NEW.business_id::text));

  select coalesce(sum(extra_slots), 0) into v_extra
  from public.featured_slot_packs
  where business_id = NEW.business_id and status = 'consumed';
  select count(*) into v_used
  from public.listings
  where business_id = NEW.business_id and id != NEW.id and featured_until > now();
  if v_used >= public.biz_plan_featured_slots(v_plan) + v_extra then
    raise exception 'NO_FEATURED_SLOTS: all featured slots are in use';
  end if;
  return NEW;
end;
$function$;

-- Verification (run after applying):
--   select prosrc from pg_proc where proname = 'enforce_listing_feature_entitlement';
--   -- confirm the advisory lock line is present, plan/count/limit logic unchanged.
-- ============================================================
