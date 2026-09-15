-- Notify-on-decision hardening test. Confirms the real write path the
-- admin's notifyDecision() helper depends on (INSERT into notifications
-- as an admin, targeting another user) actually works and stays scoped
-- to admin-team only. Self-contained and always rolled back.

begin;

create temporary table notify_results (
  n integer primary key,
  test_name text not null,
  passed boolean not null
) on commit drop;
grant insert, select on table notify_results to authenticated;

do $test$
declare
  v_super uuid;
  v_users uuid[];
  v_admin uuid; v_applicant uuid; v_outsider uuid;
  v_notif_id text;
  v_n int;
  v_meta jsonb;
begin
  select id into v_super from public.profiles where role = 'super_admin' limit 1;
  select array_agg(id order by id) into v_users from (
    select id from public.profiles where role = 'user' order by id limit 3
  ) u;
  if v_super is null or coalesce(array_length(v_users, 1), 0) < 3 then
    raise exception 'notify-decision test abort: requires one super_admin and three user profiles';
  end if;
  v_admin := v_users[1]; v_applicant := v_users[2]; v_outsider := v_users[3];

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set role = 'admin' where id = v_admin;

  v_notif_id := gen_random_uuid()::text;

  -- A. admin can insert a decision notification for a different user, with
  -- a meta.deepLink payload -- exactly what notifyDecision() does.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.notifications (id, user_id, title, body, type, meta)
    values (v_notif_id, v_applicant, 'Please resubmit your verification documents', 'Your identity verification needs another look. Please resubmit your ID and selfie in the app.', 'admin_decision', jsonb_build_object('deepLink', 'verify:me'));
  reset role;
  select count(*) into v_n from public.notifications where id = v_notif_id;
  insert into notify_results values (1, 'admin can insert a decision notification for another user', v_n = 1);

  -- B. the applicant can read their own notification, with the deep link intact.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_applicant, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_applicant::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select meta into v_meta from public.notifications where id = v_notif_id;
  reset role;
  insert into notify_results values (2, 'applicant can read their own decision notification', v_meta ->> 'deepLink' = 'verify:me');

  -- C. an unrelated regular user cannot read someone else's notification.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into v_n from public.notifications where id = v_notif_id;
  reset role;
  insert into notify_results values (3, 'unrelated user cannot read another user''s decision notification', v_n = 0);

  -- D. an unrelated regular user cannot insert a notification impersonating
  -- an admin decision for someone else (the exact write notifyDecision()
  -- performs, attempted by a non-admin caller).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into public.notifications (id, user_id, title, body, type)
      values (gen_random_uuid()::text, v_applicant, 'Fake decision', 'body', 'admin_decision');
    v_n := 1;
  exception when insufficient_privilege then v_n := 0;
  end;
  reset role;
  insert into notify_results values (4, 'unrelated regular user cannot insert a decision notification for someone else', v_n = 0);

  -- E. anon cannot insert at all.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  begin
    insert into public.notifications (id, user_id, title, body, type)
      values (gen_random_uuid()::text, v_applicant, 'Fake decision', 'body', 'admin_decision');
    v_n := 1;
  exception when insufficient_privilege then v_n := 0;
  end;
  reset role;
  insert into notify_results values (5, 'anon cannot insert a decision notification', v_n = 0);

  -- Cleanup.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  delete from public.notifications where id = v_notif_id;

  if exists (select 1 from notify_results where not passed) then
    raise exception 'notify-decision test failure: %', (
      select string_agg(n || ':' || test_name, ', ' order by n)
      from notify_results where not passed
    );
  end if;
end
$test$;

select n, test_name, passed from notify_results order by n;

rollback;
