create or replace function public.run_reengagement_bundle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare a jsonb; b jsonb; begin
 a:=public.run_saved_listing_reminders();
 b:=public.run_marketplace_reengagement();
 return jsonb_build_object('saved_listing_reminded',coalesce((a->>'reminded')::int,0),'marketplace_reengaged',coalesce((b->>'notified')::int,0));
end; $$;
revoke all on function public.run_reengagement_bundle() from public,anon,authenticated;
grant execute on function public.run_reengagement_bundle() to service_role;

select cron.schedule('pamarket-reengagement-bundle','17 11 * * *', $cron$select public.run_reengagement_bundle();$cron$);;
