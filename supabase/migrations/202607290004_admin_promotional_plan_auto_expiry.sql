-- Admin promotional business-plan grants (admin.html "Override Plan" with a
-- 1 month / 1 year duration) previously had no automatic reversion — only a
-- manual "Downgrade overdue" button an admin had to remember to click. This
-- adds a cron-callable function that does the same downgrade automatically,
-- mirroring the client's existing bizExpireOverdue() logic exactly.

create or replace function public.expire_overdue_business_subscriptions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id, business_id, plan_id
    from public.business_subscriptions
    where status = 'active'
      and plan_id <> 'free'
      and current_period_end is not null
      and current_period_end < now()
    limit 500
  loop
    begin
      update public.business_subscriptions set status = 'expired' where id = rec.id;
      update public.businesses set plan_id = 'free' where id = rec.business_id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'expire_overdue_business_subscriptions: failed for business %: %', rec.business_id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('expired', v_count);
end;
$$;

revoke all on function public.expire_overdue_business_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_overdue_business_subscriptions() to service_role;
