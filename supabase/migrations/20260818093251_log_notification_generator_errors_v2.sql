create or replace function public.log_notification_automation_error(p_function text, p_sqlstate text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.error_logs(type, message, source)
  values (
    'notification_generator',
    left(coalesce(p_function,'unknown') || ': [' || coalesce(p_sqlstate,'') || '] ' || coalesce(p_message,''), 2000),
    'automation_runner'
  );
exception when others then
  raise warning 'log_notification_automation_error failed: %', sqlerrm;
end;
$$;

revoke all on function public.log_notification_automation_error(text,text,text) from public, anon, authenticated;

DO $$
declare
  r record;
  ddl text;
  patched text;
  replacement text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'run_category_digest',
        'run_listing_expiry_warnings',
        'run_listing_view_reminders',
        'run_message_noreply_reminders',
        'run_personalized_recommendations',
        'run_promotion_ended_notices',
        'run_promotion_expiry_warnings',
        'run_shop_new_arrivals',
        'run_stale_listing_prompts',
        'run_verification_nudge',
        'run_view_milestones'
      )
  loop
    ddl := pg_get_functiondef(r.oid);
    replacement := 'exception when others then' || chr(10) ||
      '      perform public.log_notification_automation_error(' || quote_literal(r.proname) || ', SQLSTATE, SQLERRM);';
    patched := regexp_replace(ddl, 'exception\s+when\s+others\s+then', replacement, 'gi');
    if patched = ddl then
      raise exception 'No exception block patched for %', r.proname;
    end if;
    execute patched;
  end loop;
end;
$$;;
