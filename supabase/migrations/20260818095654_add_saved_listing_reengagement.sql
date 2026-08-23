alter table public.user_saves add column if not exists reminder_sent_at timestamptz;
create index if not exists user_saves_reminder_due_idx on public.user_saves (saved_at) where reminder_sent_at is null;

create or replace function public.run_saved_listing_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select us.id, us.user_id, us.listing_id, l.title
    from public.user_saves us
    join public.listings l on l.id::text = us.listing_id
    where us.reminder_sent_at is null
      and us.saved_at <= now() - interval '3 days'
      and us.saved_at >= now() - interval '30 days'
      and l.status = 'active'
      and exists (select 1 from public.push_tokens pt where pt.user_id = us.user_id)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = us.user_id::text
          and n.type = 'saved_listing_reminder'
          and n.created_at >= (extract(epoch from now() - interval '3 days') * 1000)::bigint
      )
    order by us.saved_at
    limit 250
  loop
    begin
      insert into public.notifications(id,user_id,title,body,type,read,created_at,meta,push_sent)
      values(gen_random_uuid(),r.user_id::text,'Still interested?',left('You saved ' || coalesce(nullif(r.title,''),'this listing') || '. Take another look before it is gone.',500),'saved_listing_reminder',false,(extract(epoch from clock_timestamp())*1000)::bigint,jsonb_build_object('listingId',r.listing_id,'deepLink','listing:'||r.listing_id),false);
      update public.user_saves set reminder_sent_at = now() where id = r.id;
      v_count := v_count + 1;
    exception when others then
      insert into public.error_logs(source,error_code,message,context) values('run_saved_listing_reminders',sqlstate,left(sqlerrm,1000),jsonb_build_object('user_id',r.user_id,'save_id',r.id));
    end;
  end loop;
  return jsonb_build_object('reminded',v_count);
end;
$$;
revoke all on function public.run_saved_listing_reminders() from public, anon, authenticated;

grant execute on function public.run_saved_listing_reminders() to service_role;;
