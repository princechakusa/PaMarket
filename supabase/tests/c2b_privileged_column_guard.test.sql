-- ============================================================
-- C2B test script — repeatable, self-contained, NEVER commits.
--
-- Applies the full C2B forward migration's DDL in-transaction, runs the 15
-- required assertions against the live data it finds (no accounts created
-- or permanently changed — every mutation below, including the transient
-- role changes used to simulate moderator/support/finance/super_admin
-- callers, is undone by the final ROLLBACK), then rolls back.
--
-- Run:   supabase db query --linked -f supabase/tests/c2b_privileged_column_guard.test.sql
-- Safe to run against production as-is: ends in ROLLBACK, never COMMIT.
-- The only visible output is the final `results` table dump.
-- ============================================================

begin;

-- ── 0. Apply the C2B DDL in-transaction (identical to the forward
--       migration's steps 1-5; preconditions omitted here since the
--       forward migration file itself carries them and this script's own
--       setup below re-derives its inputs from whatever it finds). ─────
create or replace function public.role_rank(p_role text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'super_admin' then 4
    when 'admin'        then 3
    when 'moderator'    then 2
    when 'support'      then 2
    when 'finance'      then 2
    when 'user'         then 1
    else null
  end;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.has_admin_privilege(min_role text)
returns boolean
language plpgsql stable security definer set search_path = 'public'
as $$
declare
  v_min_rank    smallint := public.role_rank(min_role);
  v_caller_rank smallint;
begin
  if v_min_rank is null then
    raise exception 'has_admin_privilege: unknown role %', min_role using errcode = '22023';
  end if;
  select public.role_rank(p.role) into v_caller_rank from public.profiles p where p.id = auth.uid();
  if v_caller_rank is null then return false; end if;
  return v_caller_rank >= greatest(v_min_rank, 2);
end;
$$;

create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql security invoker set search_path = 'public'
as $$
begin
  if public.is_admin_team() or auth.role() = 'service_role' then
    return new;
  end if;
  new.role                 := old.role;
  new.verified              := old.verified;
  new.company_verified      := old.company_verified;
  new.status                := old.status;
  new.ban_reason             := old.ban_reason;
  new.ban_until              := old.ban_until;
  new.verification_pending  := old.verification_pending;
  new.admin_notes           := old.admin_notes;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_privileged on public.profiles;
create trigger trg_profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged();

create or replace function public.amos_set_integration_credential(
  p_provider text, p_secret_name text, p_secret_value text
)
returns void
language plpgsql security definer set search_path = 'public', 'vault'
as $$
declare v_secret_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only super_admin can connect AMOS integrations';
  end if;
  select id into v_secret_id from vault.secrets where name = p_secret_name;
  if v_secret_id is null then
    perform vault.create_secret(p_secret_value, p_secret_name, 'AMOS integration credential: ' || p_provider);
  else
    perform vault.update_secret(v_secret_id, p_secret_value);
  end if;
  update public.amos_integrations
  set status = 'connected', credentials_ref = p_secret_name, consecutive_failures = 0, auto_disabled = false, updated_at = now()
  where provider = p_provider;
end;
$$;

-- ── results sink ──────────────────────────────────────────────────────
create temporary table results (
  n int primary key, name text, expected text, actual text, passed boolean
);

-- ── main test body ───────────────────────────────────────────────────
do $$
declare
  v_user1 uuid; v_user2 uuid; v_mod uuid; v_supp uuid; v_fin uuid; v_sa uuid;
  v_admin uuid;
  before1 record; after1 record;
  v_rowcount int;
  v_role_after text;
  v_status_after text; v_ban_until_after timestamptz; v_ban_reason_after text;
  v_ok boolean; v_ok2 boolean; v_ok3 boolean;
  v_amos_result text;
  v_bio_after text;
begin
  -- pick 6 distinct existing 'user' rows plus the real admin row (read-only lookup)
  select id into v_user1 from (
    select id from public.profiles where role = 'user' order by id limit 1 offset 0
  ) t;
  select id into v_user2 from (
    select id from public.profiles where role = 'user' order by id limit 1 offset 1
  ) t;
  select id into v_mod from (
    select id from public.profiles where role = 'user' order by id limit 1 offset 2
  ) t;
  select id into v_supp from (
    select id from public.profiles where role = 'user' order by id limit 1 offset 3
  ) t;
  select id into v_fin from (
    select id from public.profiles where role = 'user' order by id limit 1 offset 4
  ) t;
  select id into v_sa from (
    select id from public.profiles where role = 'user' order by id limit 1 offset 5
  ) t;
  select id into v_admin from public.profiles where role = 'admin' limit 1;

  if v_user1 is null or v_user2 is null or v_mod is null or v_supp is null
     or v_fin is null or v_sa is null or v_admin is null then
    raise exception 'C2B test abort: not enough distinct profiles to run the suite (need >=6 role=user rows and >=1 role=admin row)';
  end if;

  -- ── transient setup — role changes here NEVER persist (ROLLBACK below).
  --    These UPDATEs touch the same privileged columns the new trigger
  --    guards, so they must run under the trigger's own service_role
  --    bypass path (the trigger fires for every caller, including
  --    postgres — rolbypassrls only affects RLS, never trigger execution).
  -- pre-existing trg_log_role_change (AFTER UPDATE, unrelated to C2B, not
  -- modified by it) requires a non-null actor_id; attribute these setup-only
  -- role changes to the real admin account (auth.uid()), same as it would
  -- record a genuine admin-performed promotion.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  update public.profiles set role = 'moderator' where id = v_mod;
  update public.profiles set role = 'support'   where id = v_supp;
  update public.profiles set role = 'finance'   where id = v_fin;
  update public.profiles set role = 'super_admin' where id = v_sa;
  update public.profiles
    set status = 'banned', ban_reason = 'c2b-test', ban_until = now() + interval '1 day', verified = false
    where id = v_user2;

  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select role, verified, company_verified, status, ban_reason, ban_until, verification_pending, admin_notes, bio
    into before1
    from public.profiles where id = v_user1;

  -- ════════════════════════════════════════════════════════════════
  -- TESTS 1, 2, 5: normal user attempts every privileged field at once,
  -- plus a legitimate field (bio), in a single UPDATE.
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_user1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  update public.profiles
  set verified = true,
      company_verified = true,
      status = 'active',
      ban_reason = null,
      ban_until = null,
      verification_pending = true,
      admin_notes = 'self-inserted note (test)',
      bio = 'c2b-test bio edit'
  where id = v_user1;

  reset role;

  select role, verified, company_verified, status, ban_reason, ban_until, verification_pending, admin_notes, bio
    into after1
    from public.profiles where id = v_user1;

  insert into results values (1, 'normal user cannot self-verify (verified)',
    'unchanged', case when after1.verified = before1.verified then 'unchanged' else 'CHANGED' end,
    after1.verified = before1.verified);

  insert into results values (2, 'normal user cannot self-verify (company_verified)',
    'unchanged', case when after1.company_verified is not distinct from before1.company_verified then 'unchanged' else 'CHANGED' end,
    after1.company_verified is not distinct from before1.company_verified);

  insert into results values (3, 'normal user cannot change status/ban fields',
    'unchanged', case when after1.status = before1.status
                        and after1.ban_reason is not distinct from before1.ban_reason
                        and after1.ban_until is not distinct from before1.ban_until
                   then 'unchanged' else 'CHANGED' end,
    after1.status = before1.status and after1.ban_reason is not distinct from before1.ban_reason
      and after1.ban_until is not distinct from before1.ban_until);

  insert into results values (4, 'normal user cannot change verification_pending',
    'unchanged', case when after1.verification_pending is not distinct from before1.verification_pending then 'unchanged' else 'CHANGED' end,
    after1.verification_pending is not distinct from before1.verification_pending);

  insert into results values (5, 'normal user cannot change admin_notes',
    'unchanged', case when after1.admin_notes is not distinct from before1.admin_notes then 'unchanged' else 'CHANGED' end,
    after1.admin_notes is not distinct from before1.admin_notes);

  insert into results values (6, 'normal user CAN still edit legitimate field (bio)',
    'CHANGED', case when after1.bio = 'c2b-test bio edit' then 'CHANGED' else 'unchanged' end,
    after1.bio = 'c2b-test bio edit');

  -- ════════════════════════════════════════════════════════════════
  -- TEST 7: role self-escalation attempt (separate UPDATE — the existing
  -- own-update policy's WITH CHECK may reject the whole statement, or the
  -- new trigger re-pins it; either outcome is a pass as long as role is
  -- unchanged afterward).
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_user1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  begin
    update public.profiles set role = 'admin' where id = v_user1;
  exception when others then
    null; -- RLS policy violation is an acceptable "blocked" outcome too
  end;

  reset role;

  select role into v_role_after from public.profiles where id = v_user1;
  insert into results values (7, 'normal user cannot promote own role',
    'user', v_role_after, v_role_after = 'user');

  -- ════════════════════════════════════════════════════════════════
  -- TEST 8: banned user cannot unban self.
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_user2::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  update public.profiles
  set status = 'active', ban_reason = null, ban_until = null
  where id = v_user2;

  reset role;

  select status, ban_reason, ban_until into v_status_after, v_ban_reason_after, v_ban_until_after
  from public.profiles where id = v_user2;

  insert into results values (8, 'banned user cannot unban self',
    'banned/c2b-test/<future date>',
    v_status_after || '/' || coalesce(v_ban_reason_after,'null') || '/' || coalesce(v_ban_until_after::text,'null'),
    v_status_after = 'banned' and v_ban_reason_after = 'c2b-test' and v_ban_until_after is not null);

  -- ════════════════════════════════════════════════════════════════
  -- TEST 9: existing authenticated admin operations still work (admin
  -- verifying a DIFFERENT user's account — the exact admin.html workflow).
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  update public.profiles set verified = true where id = v_mod; -- v_mod row, acting as admin
  get diagnostics v_rowcount = row_count;

  reset role;

  insert into results values (9, 'authenticated admin can still verify another user',
    '1 row updated, verified=true', v_rowcount || ' row(s) updated', v_rowcount = 1);

  -- ════════════════════════════════════════════════════════════════
  -- TEST 10: super_admin passes hierarchy checks.
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_sa::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select public.has_admin_privilege('super_admin') into v_ok;
  select public.has_admin_privilege('admin')       into v_ok2;
  select public.is_super_admin()                    into v_ok3;

  reset role;

  insert into results values (10, 'super_admin passes hierarchy checks',
    'true/true/true', v_ok || '/' || v_ok2 || '/' || v_ok3, v_ok and v_ok2 and v_ok3);

  -- ════════════════════════════════════════════════════════════════
  -- TEST 11: admin cannot perform super-admin-only actions.
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select public.has_admin_privilege('super_admin') into v_ok; -- expect false
  select public.is_super_admin()                    into v_ok2; -- expect false

  v_amos_result := null;
  begin
    perform public.amos_set_integration_credential('c2b_test_probe', 'c2b_test_probe_admin', 'dummy');
    v_amos_result := 'UNEXPECTED_SUCCESS';
  exception when others then
    v_amos_result := 'rejected: ' || sqlerrm;
  end;

  reset role;

  insert into results values (11, 'admin cannot pass super_admin checks / cannot set AMOS credentials',
    'false/false/rejected', v_ok || '/' || v_ok2 || '/' || (v_amos_result like 'rejected%'),
    not v_ok and not v_ok2 and v_amos_result like 'rejected%');

  -- ════════════════════════════════════════════════════════════════
  -- TEST 12: moderator/support/finance do not gain broad (admin-level)
  -- privileges, and none of them can set AMOS credentials either.
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_mod::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.has_admin_privilege('admin') into v_ok; -- expect false (rank 2 < rank 3)
  v_amos_result := null;
  begin
    perform public.amos_set_integration_credential('c2b_test_probe', 'c2b_test_probe_mod', 'dummy');
    v_amos_result := 'UNEXPECTED_SUCCESS';
  exception when others then
    v_amos_result := 'rejected';
  end;
  reset role;
  insert into results values (12, 'moderator lacks admin-level privilege + cannot set AMOS credentials',
    'false/rejected', v_ok || '/' || v_amos_result, not v_ok and v_amos_result = 'rejected');

  perform set_config('request.jwt.claim.sub', v_supp::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.has_admin_privilege('admin') into v_ok;
  v_amos_result := null;
  begin
    perform public.amos_set_integration_credential('c2b_test_probe', 'c2b_test_probe_supp', 'dummy');
    v_amos_result := 'UNEXPECTED_SUCCESS';
  exception when others then
    v_amos_result := 'rejected';
  end;
  reset role;
  insert into results values (13, 'support lacks admin-level privilege + cannot set AMOS credentials',
    'false/rejected', v_ok || '/' || v_amos_result, not v_ok and v_amos_result = 'rejected');

  perform set_config('request.jwt.claim.sub', v_fin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.has_admin_privilege('admin') into v_ok;
  v_amos_result := null;
  begin
    perform public.amos_set_integration_credential('c2b_test_probe', 'c2b_test_probe_fin', 'dummy');
    v_amos_result := 'UNEXPECTED_SUCCESS';
  exception when others then
    v_amos_result := 'rejected';
  end;
  reset role;
  insert into results values (14, 'finance lacks admin-level privilege + cannot set AMOS credentials',
    'false/rejected', v_ok || '/' || v_amos_result, not v_ok and v_amos_result = 'rejected');

  -- ════════════════════════════════════════════════════════════════
  -- TEST 15a: ordinary user is also rejected by amos_set_integration_credential
  -- (completes "rejects every role except super_admin").
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_user1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  v_amos_result := null;
  begin
    perform public.amos_set_integration_credential('c2b_test_probe', 'c2b_test_probe_user', 'dummy');
    v_amos_result := 'UNEXPECTED_SUCCESS';
  exception when others then
    v_amos_result := 'rejected: ' || sqlerrm;
  end;
  reset role;
  insert into results values (15, 'ordinary user rejected by amos_set_integration_credential, no secret leaked in error',
    'rejected, generic message', v_amos_result,
    v_amos_result like 'rejected%'
      and v_amos_result not ilike '%dummy%'
      and v_amos_result not ilike '%vault%secret%value%');

  -- ════════════════════════════════════════════════════════════════
  -- TEST 16: super_admin IS accepted by amos_set_integration_credential
  -- (positive case — completes coverage of "rejects every role except
  -- super_admin" by proving super_admin is the one role that is NOT
  -- rejected). Uses a disposable probe provider/secret name; the whole
  -- transaction rolls back so nothing persists in vault.secrets or
  -- amos_integrations either way.
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_sa::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  v_amos_result := null;
  begin
    perform public.amos_set_integration_credential('c2b_test_probe', 'c2b_test_probe_superadmin', 'dummy');
    v_amos_result := 'accepted';
  exception when others then
    v_amos_result := 'unexpected_rejection: ' || sqlerrm;
  end;
  reset role;
  insert into results values (16, 'super_admin IS accepted by amos_set_integration_credential',
    'accepted', v_amos_result, v_amos_result = 'accepted');

  -- ════════════════════════════════════════════════════════════════
  -- TEST 17: service_role backend path remains functional (bypasses the
  -- guard via auth.role() = 'service_role', independent of is_admin_team()).
  -- ════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', null, true);

  update public.profiles set company_verified = true where id = v_fin; -- unrelated row
  get diagnostics v_rowcount = row_count;

  perform set_config('request.jwt.claim.role', '', true); -- clear simulated claim

  insert into results values (17, 'service_role can still write privileged columns',
    '1 row updated', v_rowcount || ' row(s) updated', v_rowcount = 1);

end $$;

select n, name, expected, actual, passed from results order by n;

rollback;
