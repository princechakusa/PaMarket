create or replace function public.run_marketplace_reengagement()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r record; v_count integer:=0;
begin
  for r in
    select p.id,
      coalesce((select vl.category from public.viewed_listings vl where vl.user_id=p.id order by vl.viewed_at desc limit 1),'marketplace') as category
    from public.profiles p
    where p.status='active'
      and exists(select 1 from public.push_tokens pt where pt.user_id=p.id)
      and coalesce(p.last_active_at,p.last_seen_at,p.last_seen,p.updated_at,p.created_at) < now()-interval '5 days'
      and coalesce(p.last_active_at,p.last_seen_at,p.last_seen,p.updated_at,p.created_at) > now()-interval '90 days'
      and not exists(select 1 from public.notifications n where n.user_id=p.id::text and n.type in ('marketplace_reengagement','personalized_recommendation','category_digest','listing_view_reminder','saved_listing_reminder') and n.created_at >= (extract(epoch from now()-interval '4 days')*1000)::bigint)
    order by coalesce(p.last_active_at,p.last_seen_at,p.last_seen,p.updated_at,p.created_at) desc
    limit 250
  loop
    begin
      insert into public.notifications(id,user_id,title,body,type,read,created_at,meta,push_sent)
      values(gen_random_uuid(),r.id::text,'See what’s new on PaMarket',case when r.category<>'marketplace' then left('New '||r.category||' listings may have been added since your last visit.',500) else 'New listings may have been added since your last visit.' end,'marketplace_reengagement',false,(extract(epoch from clock_timestamp())*1000)::bigint,jsonb_build_object('deepLink','/(tabs)/search'),false);
      v_count:=v_count+1;
    exception when others then
      insert into public.error_logs(source,error_code,message,context) values('run_marketplace_reengagement',sqlstate,left(sqlerrm,1000),jsonb_build_object('user_id',r.id));
    end;
  end loop;
  return jsonb_build_object('notified',v_count);
end; $$;
revoke all on function public.run_marketplace_reengagement() from public,anon,authenticated;
grant execute on function public.run_marketplace_reengagement() to service_role;;
