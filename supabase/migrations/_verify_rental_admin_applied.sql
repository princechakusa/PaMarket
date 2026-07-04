-- ============================================================
-- PaMarket — READ-ONLY check for the two rental-admin migrations.
-- Run in the Supabase SQL editor. Every row should show 'OK'.
-- This changes nothing.
-- ============================================================
with checks as (

  -- add_rental_report_severity.sql : severity column + check constraint
  select 'rental_reports.severity column exists' as check_name,
    case when exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='rental_reports' and column_name='severity'
    ) then 'OK' else 'MISSING' end as status

  union all
  select 'rental_reports.severity allows low/medium/high',
    case when exists (
      select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
      where t.relname='rental_reports'
        and pg_get_constraintdef(c.oid) ilike '%severity%'
        and pg_get_constraintdef(c.oid) ilike '%high%'
    ) then 'OK' else 'MISSING' end

  union all
  -- fix_rental_audit_actor_default.sql : actor_id defaults to auth.uid()
  select 'rental_audit_logs.actor_id defaults to auth.uid()',
    case when exists (
      select 1 from pg_attrdef d
      join pg_class t on t.oid=d.adrelid
      join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
      where t.relname='rental_audit_logs' and a.attname='actor_id'
        and pg_get_expr(d.adbin, d.adrelid) ilike '%uid%'
    ) then 'OK' else 'MISSING' end
)
select check_name, status from checks order by status desc, check_name;
