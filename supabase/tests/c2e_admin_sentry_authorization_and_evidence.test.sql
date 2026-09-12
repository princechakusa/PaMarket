-- Stage C2E admin Sentry authorization/evidence test.
-- Run only after applying the forward migration. This script never commits.

begin;

do $test$
declare
  v_event text;
  v_status text;
  v_id uuid;
  v_metadata jsonb;
  v_definition text;
begin
  if has_function_privilege('anon', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'C2E test failed: anon can execute record_security_event';
  end if;
  if has_function_privilege('authenticated', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'C2E test failed: authenticated can execute record_security_event';
  end if;
  if not has_function_privilege('service_role', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'C2E test failed: service_role cannot execute record_security_event';
  end if;

  foreach v_event in array array[
    'admin_sentry_access_denied',
    'admin_sentry_issues_listed',
    'admin_sentry_issue_viewed'
  ] loop
    select result.id, result.status into v_id, v_status
    from public.record_security_event(
      v_event, 'info', 'edge_function', null, 'admin', true, 'aal1',
      'sentry_issue', '12345', 'errors_view', 'success', null, null,
      '/admin-sentry-issues?must=strip', 'GET', null, 'unavailable',
      'C2E synthetic test', 'c2e-test:' || v_event, jsonb_build_object(
        'operation', 'test', 'token', 'must-not-persist', 'email', 'must-not-persist'
      )
    ) result;

    if v_status <> 'recorded' or v_id is null then
      raise exception 'C2E test failed: % was not recorded', v_event;
    end if;

    select se.metadata into v_metadata from public.security_events se where se.id = v_id;
    if v_metadata ? 'token' or v_metadata ? 'email' or v_metadata->>'operation' <> 'test' then
      raise exception 'C2E test failed: metadata redaction changed for %', v_event;
    end if;
    if (select request_path from public.security_events where id = v_id) <> '/admin-sentry-issues' then
      raise exception 'C2E test failed: request query string was retained';
    end if;
  end loop;

  select result.status into v_status
  from public.record_security_event(
    'admin_sentry_issue_viewed', 'info', 'edge_function', null, 'admin', true,
    'aal1', 'sentry_issue', '12345', 'errors_view', 'success', null, null,
    '/admin-sentry-issues', 'GET', null, 'unavailable', null,
    'c2e-test:admin_sentry_issue_viewed', '{}'::jsonb
  ) result;
  if v_status <> 'duplicate' then
    raise exception 'C2E test failed: duplicate event key was not idempotent';
  end if;

  begin
    perform public.record_security_event(
      'admin_sentry_unknown', 'info', 'edge_function', null, null, true,
      'aal1', null, null, 'errors_view', 'blocked', null, null,
      '/admin-sentry-issues', 'GET', null, 'unavailable', null,
      'c2e-test:unknown', '{}'::jsonb
    );
    raise exception 'C2E test failed: unsupported event type was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  select pg_get_functiondef('public.list_security_events(integer,integer,timestamp with time zone,timestamp with time zone,text,text,text,text,uuid,uuid)'::regprocedure)
    into v_definition;
  foreach v_event in array array[
    'admin_sentry_access_denied',
    'admin_sentry_issues_listed',
    'admin_sentry_issue_viewed'
  ] loop
    if position(v_event in v_definition) = 0 then
      raise exception 'C2E test failed: list_security_events filter does not allow %', v_event;
    end if;
  end loop;

  -- Existing C2D events must remain accepted.
  perform public.record_security_event(
    'admin_logout', 'info', 'edge_function', null, 'admin', true,
    'aal1', null, null, 'logout', 'success', null, null,
    '/logout', 'POST', null, 'unavailable', null,
    'c2e-test:existing-admin-logout', '{}'::jsonb
  );
end
$test$;

rollback;
