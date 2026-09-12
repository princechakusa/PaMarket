-- C2E-2 R2 evidence writer test.
-- Run after the forward migration. Never commits or leaves evidence rows.

begin;

do $test$
declare
  v_event text;
  v_id uuid;
  v_status text;
  v_definition text;
begin
  if has_function_privilege('anon', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'C2E-2 failed: anon can execute evidence writer';
  end if;
  if has_function_privilege('authenticated', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'C2E-2 failed: authenticated can execute evidence writer';
  end if;
  if not has_function_privilege('service_role', 'public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'C2E-2 failed: service_role cannot execute evidence writer';
  end if;

  foreach v_event in array array[
    'admin_r2_access_denied',
    'admin_r2_upload_issued',
    'admin_r2_verification_read_issued'
  ] loop
    select result.id, result.status into v_id, v_status
    from public.record_security_event(
      v_event, 'info', 'edge_function', null, 'admin', true, 'aal1',
      'r2_namespace', 'ads_upload', 'r2_url_issue', 'success', null, null,
      '/functions/v1/get-r2-upload-url?key=must-not-persist', 'POST', null,
      'unavailable', 'C2E-2 synthetic test', 'c2e2-test:' || v_event,
      jsonb_build_object('operation', 'ads_upload', 'key', 'must-not-persist', 'token', 'must-not-persist')
    ) result;

    if v_status <> 'recorded' or v_id is null then
      raise exception 'C2E-2 failed: % was not recorded', v_event;
    end if;
    if (select metadata ? 'key' or metadata ? 'token' from public.security_events where id = v_id) then
      raise exception 'C2E-2 failed: prohibited metadata persisted for %', v_event;
    end if;
    if (select request_path from public.security_events where id = v_id) <> '/functions/v1/get-r2-upload-url' then
      raise exception 'C2E-2 failed: query string persisted in request path';
    end if;
  end loop;

  select result.status into v_status
  from public.record_security_event(
    'admin_r2_upload_issued', 'info', 'edge_function', null, 'admin', true,
    'aal1', 'r2_namespace', 'ads_upload', 'r2_url_issue', 'success', null, null,
    '/functions/v1/get-r2-upload-url', 'POST', null, 'unavailable', null,
    'c2e2-test:admin_r2_upload_issued', '{}'::jsonb
  ) result;
  if v_status <> 'duplicate' then
    raise exception 'C2E-2 failed: duplicate evidence event was not idempotent';
  end if;

  begin
    perform public.record_security_event(
      'admin_r2_unknown', 'info', 'edge_function', null, null, true, 'aal1',
      null, null, 'r2_url_issue', 'blocked', null, null, '/r2', 'POST',
      null, 'unavailable', null, 'c2e2-test:unknown', '{}'::jsonb
    );
    raise exception 'C2E-2 failed: unknown event type was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  select pg_get_functiondef('public.record_security_event(text,text,text,uuid,text,boolean,text,text,text,text,text,text,uuid,text,text,inet,text,text,text,jsonb)'::regprocedure)
    into v_definition;
  foreach v_event in array array[
    'admin_r2_access_denied',
    'admin_r2_upload_issued',
    'admin_r2_verification_read_issued'
  ] loop
    if position(v_event in v_definition) = 0 then
      raise exception 'C2E-2 failed: deployed writer does not contain %', v_event;
    end if;
  end loop;
end
$test$;

rollback;
