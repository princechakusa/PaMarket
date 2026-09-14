-- C2E-8 database test. Self-contained and always rolled back — safe to run
-- directly against a live database (never commits).

begin;

create temporary table c2e8_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table c2e8_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_owner uuid; v_admin uuid; v_moderator uuid; v_support uuid; v_finance uuid;
  v_recruiter_admin uuid;
  v_ok boolean;
  v_result jsonb;
  v_before numeric;
  v_secret text;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 5
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 5 then
    raise exception 'C2E-8 test abort: requires one super_admin and five user profiles';
  end if;
  v_owner := v_users[1]; v_admin := v_users[2]; v_moderator := v_users[3];
  v_support := v_users[4]; v_finance := v_users[5];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'moderator' where id = v_moderator;
  update public.profiles set role = 'support' where id = v_support;
  update public.profiles set role = 'finance' where id = v_finance;
  update public.profiles set mfa_secret = null, two_factor_secret = null, two_factor_enabled = false,
    wallet_usd = 100 where id = v_owner;

  -- ══════════════════ MFA/2FA read exposure ══════════════════

  -- A. Owner reads own mfa_secret via get_my_mfa_secret() RPC -> PASS.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.profiles set mfa_secret = 'c2e8-admin-own-secret' where id = v_admin;
  select public.get_my_mfa_secret() into v_secret;
  reset role;
  insert into c2e8_results values (1, 'A: owner reads own mfa_secret via RPC', (v_secret = 'c2e8-admin-own-secret'));

  -- B. Regular authenticated user cannot SELECT another user's mfa_secret
  -- column directly (column-level revoke, applies regardless of row policy).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_admin limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e8_results values (2, 'B: regular user cannot SELECT mfa_secret column at all (column revoked)', v_ok);

  -- C. Moderator cannot read another user's mfa_secret column directly.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_admin limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e8_results values (3, 'C: moderator blocked from selecting mfa_secret column (even for another row)', v_ok);

  -- D. Admin (even at AAL2) cannot read another user's mfa_secret column
  -- directly -- only via the owner-scoped RPC.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_owner limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e8_results values (4, 'D: admin (AAL2) blocked from selecting another user''s mfa_secret column', v_ok);

  -- E. super_admin cannot read another user's mfa_secret column directly.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  set local role authenticated;
  begin
    perform 1 from (select mfa_secret from public.profiles where id = v_admin limit 1) x;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e8_results values (5, 'E: super_admin blocked from selecting another user''s mfa_secret column', v_ok);

  -- F. Existing 2FA self-service (two_factor_secret) still fully functional
  -- (unchanged in this stage -- confirms it was not accidentally touched).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e8-owner-2fa' where id = v_owner;
  select (two_factor_secret = 'c2e8-owner-2fa') into v_ok from public.profiles where id = v_owner;
  reset role;
  insert into c2e8_results values (6, 'F: mobile two_factor_secret self-service unaffected (unchanged this stage)', v_ok);

  -- ══════════════════ Wallet adjustment RPC ══════════════════

  -- G. Unauthenticated (no auth.uid()) cannot adjust wallet.
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (7, 'G: unauthenticated blocked from admin_adjust_wallet', v_ok);

  -- H. Regular user cannot adjust wallet.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_users[1], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[1]::text, true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (8, 'H: regular user blocked from admin_adjust_wallet', v_ok);

  -- I. support cannot adjust wallet.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (9, 'I: support (even AAL2) blocked from admin_adjust_wallet', v_ok);

  -- J. moderator cannot adjust wallet.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (10, 'J: moderator (even AAL2) blocked from admin_adjust_wallet', v_ok);

  -- K. finance cannot adjust wallet.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (11, 'K: finance (even AAL2) blocked from admin_adjust_wallet', v_ok);

  -- L. admin WITHOUT AAL2 cannot adjust wallet.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (12, 'L: admin without AAL2 blocked from admin_adjust_wallet', v_ok);

  -- M. admin WITH AAL2 succeeds.
  select wallet_usd into v_before from public.profiles where id = v_owner;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select public.admin_adjust_wallet(v_owner, 25, 'C2E-8 test credit') into v_result;
  reset role;
  insert into c2e8_results values (13, 'M: admin with AAL2 succeeds', (v_result->>'ok')::boolean and (v_result->>'balance')::numeric = v_before + 25);

  -- N. Transaction ledger entry created for that adjustment.
  select exists (
    select 1 from public.transactions
    where user_id = v_owner and type = 'admin_adjustment' and amount = 25 and note = 'C2E-8 test credit'
  ) into v_ok;
  insert into c2e8_results values (14, 'N: wallet adjustment recorded in transactions ledger', v_ok);

  -- O. Audit log entry created for that adjustment.
  select exists (
    select 1 from public.admin_audit_logs
    where actor_id = v_admin and action = 'admin_adjust_wallet' and entity_id = v_owner::text
  ) into v_ok;
  insert into c2e8_results values (15, 'O: wallet adjustment recorded in admin_audit_logs', v_ok);

  -- P. super_admin WITHOUT AAL2 cannot adjust wallet.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  set local role authenticated;
  begin
    perform public.admin_adjust_wallet(v_owner, 10, 'test');
    v_ok := false;
  exception when others then v_ok := (sqlstate = '42501');
  end;
  reset role;
  insert into c2e8_results values (16, 'P: super_admin without AAL2 blocked from admin_adjust_wallet', v_ok);

  -- Q. super_admin WITH AAL2 succeeds.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  set local role authenticated;
  select public.admin_adjust_wallet(v_owner, -5, 'C2E-8 test debit') into v_result;
  reset role;
  insert into c2e8_results values (17, 'Q: super_admin with AAL2 succeeds', (v_result->>'ok')::boolean);

  -- R. Direct raw UPDATE of wallet_usd is blocked for staff (admin, AAL2).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    update public.profiles set wallet_usd = 999999 where id = v_owner;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  insert into c2e8_results values (18, 'R: direct raw UPDATE of wallet_usd blocked even for admin+AAL2 (RPC-only path)', v_ok);

  -- ══════════════════ Moderation appeals ══════════════════

  -- S. admin/super_admin/moderator can read moderation_appeals; support/
  -- finance cannot (policy references is_moderator(), spot-checked).
  select (
    exists (select 1 from pg_policies where tablename = 'moderation_appeals' and policyname = 'appeals team read' and qual ilike '%is_moderator%')
    and exists (select 1 from pg_policies where tablename = 'moderation_appeals' and policyname = 'appeals team update' and qual ilike '%is_moderator%')
  ) into v_ok;
  insert into c2e8_results values (19, 'S: moderation_appeals read/update policies now use is_moderator()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  select public.is_moderator() into v_ok;
  insert into c2e8_results values (20, 'T: support does not satisfy is_moderator() (moderation_appeals now blocked for support)', not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  select public.is_moderator() into v_ok;
  insert into c2e8_results values (21, 'U: finance does not satisfy is_moderator() (moderation_appeals now blocked for finance)', not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  select public.is_moderator() into v_ok;
  insert into c2e8_results values (22, 'V: moderator satisfies is_moderator() (moderation_appeals access preserved)', v_ok);

  -- W. Ordinary user can still insert their own appeal (requester_id path
  -- of the insert policy, unchanged).
  select (
    exists (select 1 from pg_policies where tablename = 'moderation_appeals' and policyname = 'appeals user insert' and with_check ilike '%requester_id%')
  ) into v_ok;
  insert into c2e8_results values (23, 'W: moderation_appeals user-insert-own-appeal path preserved', v_ok);

  -- ══════════════════ Support tickets ══════════════════

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select public.is_support_team() into v_ok;
  insert into c2e8_results values (24, 'X: admin satisfies is_support_team()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  select public.is_support_team() into v_ok;
  insert into c2e8_results values (25, 'Y: super_admin satisfies is_support_team()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_support, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_support::text, true);
  select public.is_support_team() into v_ok;
  insert into c2e8_results values (26, 'Z: support satisfies is_support_team()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  select public.is_support_team() into v_ok;
  insert into c2e8_results values (27, 'AA: moderator does NOT satisfy is_support_team() (support tickets now blocked)', not v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_finance, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_finance::text, true);
  select public.is_support_team() into v_ok;
  insert into c2e8_results values (28, 'AB: finance does NOT satisfy is_support_team() (support tickets now blocked)', not v_ok);

  select (
    exists (select 1 from pg_policies where tablename = 'support_tickets' and policyname = 'tickets team' and qual ilike '%is_support_team%')
    and exists (select 1 from pg_policies where tablename = 'support_ticket_messages' and policyname = 'ticket_msgs team' and qual ilike '%is_support_team%')
  ) into v_ok;
  insert into c2e8_results values (29, 'AC: support_tickets/support_ticket_messages policies now use is_support_team()', v_ok);

  -- ══════════════════ Recruiter hierarchy ══════════════════

  select id into v_recruiter_admin from unnest(v_users) u(id) where u.id = v_admin;
  update public.profiles set company_verified = false where id in (v_admin, v_moderator, v_super);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select public.is_authorized_recruiter() into v_ok;
  insert into c2e8_results values (30, 'AD: admin (uncompany-verified) still passes is_authorized_recruiter()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  select public.is_authorized_recruiter() into v_ok;
  insert into c2e8_results values (31, 'AE: moderator (uncompany-verified) still passes is_authorized_recruiter()', v_ok);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  select public.is_authorized_recruiter() into v_ok;
  insert into c2e8_results values (32, 'AF: super_admin (uncompany-verified) now passes is_authorized_recruiter() (was the bug)', v_ok);

  -- ══════════════════ Regressions: C2E-5/6/7 spot-checks ══════════════════

  select (
    to_regprocedure('public.has_mfa_aal2()') is not null
    and to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.is_admin_team()') is not null
    and to_regprocedure('public.has_admin_privilege(text)') is not null
    and to_regprocedure('public.is_super_admin()') is not null
    and to_regprocedure('public.is_moderator()') is not null
  ) into v_ok;
  insert into c2e8_results values (33, 'AG: C2E-5/6/7/native helper functions still present', v_ok);

  select (
    exists (select 1 from pg_policies where tablename = 'amos_settings' and policyname = 'amos_settings team' and qual ilike '%has_admin_privilege%')
    and exists (select 1 from pg_policies where tablename = 'admin_sessions' and policyname = 'admin_sessions team' and qual ilike '%is_super_admin%')
  ) into v_ok;
  insert into c2e8_results values (34, 'AH: C2E-5 RLS policies unchanged', v_ok);

  select not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles_public' and column_name in ('role','status','privacy')
  ) into v_ok;
  insert into c2e8_results values (35, 'AI: C2E-6 profiles_public narrowing unchanged', v_ok);

  -- C2E-7 regression: staff still blocked from writing another user's
  -- two_factor_secret (write guard untouched by this stage).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_moderator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_moderator::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.profiles set two_factor_secret = 'c2e8-attacker' where id = v_owner;
  reset role;
  select (two_factor_secret = 'c2e8-owner-2fa') into v_ok from public.profiles where id = v_owner;
  insert into c2e8_results values (36, 'AJ: C2E-7 cross-user two_factor_secret write guard unchanged', v_ok);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.transactions where user_id = v_owner and type = 'admin_adjustment' and note in ('C2E-8 test credit', 'C2E-8 test debit');
  delete from public.admin_audit_logs where actor_id in (v_admin, v_super) and action = 'admin_adjust_wallet' and entity_id = v_owner::text;
  update public.profiles set two_factor_secret = null, two_factor_enabled = false,
    mfa_secret = null, wallet_usd = null, company_verified = null
    where id in (v_owner, v_admin, v_moderator, v_super);

  if exists (select 1 from c2e8_results where not passed) then
    raise exception 'C2E-8 test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from c2e8_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from c2e8_results order by n;

rollback;
