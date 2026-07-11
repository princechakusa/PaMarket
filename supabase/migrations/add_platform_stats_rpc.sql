-- =============================================================
-- PaMarket: get_platform_stats() — owner/admin analytics for the website
-- dashboard (dashboard.html). One security-definer call returns aggregate
-- marketplace + Paynow-revenue figures. Gated by is_admin() (profiles.role
-- = 'admin'); any non-admin caller gets null, so it's safe to grant to
-- authenticated and call straight from the client.
--
-- Only AGGREGATES are returned — no per-user rows, no PII. Website revenue
-- means Paynow (paynow_payments.status = 'consumed'); Google Play revenue
-- is settled by Google and lives in the app's admin panel, not here.
-- =============================================================

create or replace function public.get_platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    return null;  -- non-admins get nothing
  end if;

  select jsonb_build_object(
    'listings_active',   (select count(*) from public.listings where status = 'active'),
    'listings_total',    (select count(*) from public.listings),
    'jobs_active',       (select count(*) from public.listings where status = 'active' and category = 'jobs'),
    'businesses_active', (select count(*) from public.businesses where status = 'active'),
    'users_total',       (select count(*) from public.profiles),
    'applications_total',(select count(*) from public.applications),

    'revenue_total',     (select coalesce(sum(amount_usd), 0) from public.paynow_payments where status = 'consumed'),
    'revenue_7d',        (select coalesce(sum(amount_usd), 0) from public.paynow_payments where status = 'consumed' and paid_at > now() - interval '7 days'),
    'payments_count',    (select count(*) from public.paynow_payments where status = 'consumed'),
    'revenue_by_product',(select coalesce(jsonb_object_agg(product_id, s), '{}'::jsonb)
                            from (select product_id, sum(amount_usd) s
                                    from public.paynow_payments
                                   where status = 'consumed'
                                   group by product_id) t),
    'generated_at',      now()
  ) into v;

  return v;
end;
$$;

grant execute on function public.get_platform_stats() to authenticated;

notify pgrst, 'reload schema';
