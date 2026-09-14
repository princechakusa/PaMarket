-- Run after applying 20260914120000_retire_untrusted_admin_login_state.sql.
-- Read-only authorization assertions; this script creates no test data.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('admin_login_attempts', 'admin_ip_blocks')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and ('public' = any(roles) or 'anon' = any(roles) or 'authenticated' = any(roles))
  ) then
    raise exception 'C2E-3A: a browser write policy still exists on admin login state';
  end if;

  if has_table_privilege('anon', 'public.admin_login_attempts', 'INSERT')
     or has_table_privilege('anon', 'public.admin_login_attempts', 'UPDATE')
     or has_table_privilege('anon', 'public.admin_login_attempts', 'DELETE')
     or has_table_privilege('authenticated', 'public.admin_login_attempts', 'INSERT')
     or has_table_privilege('authenticated', 'public.admin_login_attempts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.admin_login_attempts', 'DELETE')
     or has_table_privilege('anon', 'public.admin_ip_blocks', 'INSERT')
     or has_table_privilege('anon', 'public.admin_ip_blocks', 'UPDATE')
     or has_table_privilege('anon', 'public.admin_ip_blocks', 'DELETE')
     or has_table_privilege('authenticated', 'public.admin_ip_blocks', 'INSERT')
     or has_table_privilege('authenticated', 'public.admin_ip_blocks', 'UPDATE')
     or has_table_privilege('authenticated', 'public.admin_ip_blocks', 'DELETE') then
    raise exception 'C2E-3A: a browser DML grant still exists on admin login state';
  end if;

  if not has_table_privilege('authenticated', 'public.admin_login_attempts', 'SELECT')
     or not has_table_privilege('authenticated', 'public.admin_ip_blocks', 'SELECT') then
    raise exception 'C2E-3A: authorized Security Center read grant was not preserved';
  end if;
end
$$;
