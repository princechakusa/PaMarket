-- PaMarket C2B-FIX: restore super_admin compatibility with legacy admin gates.
-- Narrow emergency compatibility migration. This is not C2C/C2F and does not
-- broaden moderator, support, or finance access.

begin;

do $preflight$
declare
  v_policy_count integer;
begin
  if to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.is_moderator()') is null then
    raise exception 'C2B-FIX abort: required legacy role helper is missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
      and p.prosecdef
      and p.prosrc ~ 'role[[:space:]]*=[[:space:]]*''admin'''
      and p.prosrc !~ 'super_admin'
  ) then
    raise exception 'C2B-FIX abort: is_admin() no longer matches the expected pre-fix definition';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_moderator'
      and p.prosecdef
      and p.prosrc ~ 'admin'
      and p.prosrc ~ 'moderator'
      and p.prosrc !~ 'super_admin'
  ) then
    raise exception 'C2B-FIX abort: is_moderator() no longer matches the expected pre-fix definition';
  end if;

  if (select count(*) from public.profiles where role = 'super_admin') <> 1 then
    raise exception 'C2B-FIX abort: expected exactly one super_admin profile';
  end if;

  if to_regprocedure('public.is_super_admin()') is null
     or to_regprocedure('public.amos_set_integration_credential(text,text,text)') is null
     or not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'amos_set_integration_credential'
         and p.prosrc ~ 'is_super_admin\(\)'
     ) then
    raise exception 'C2B-FIX abort: C2B super-admin credential guard is not intact';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public' and (tablename, policyname) in (
    ('company_verifications', 'companyverif admin read'),
    ('company_verifications', 'companyverif admin select'),
    ('company_verifications', 'companyverif admin update'),
    ('verifications', 'verif admin select'),
    ('verifications', 'verif admin update'),
    ('scheduled_notifications', 'scheduled notifications admin read'),
    ('scheduled_notifications', 'scheduled notifications admin update')
  );

  if v_policy_count <> 7 then
    raise exception 'C2B-FIX abort: expected seven legacy inline-role policies, found %', v_policy_count;
  end if;
end
$preflight$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

comment on function public.is_admin() is
  'C2B-FIX compatibility helper: true for admin and super_admin. Specialist roles remain excluded.';

revoke all on function public.is_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'moderator')
  );
$$;

comment on function public.is_moderator() is
  'C2B-FIX compatibility helper: true for admin, super_admin, and moderator. Support and finance remain excluded.';

revoke all on function public.is_moderator() from public, anon, authenticated, service_role;
grant execute on function public.is_moderator() to anon, authenticated, service_role;

-- These seven policies use inline role = admin checks, so helper replacement
-- cannot restore them. They are active legacy verification/notification paths.
drop policy "companyverif admin read" on public.company_verifications;
create policy "companyverif admin read"
  on public.company_verifications for select to authenticated
  using (public.is_admin());

drop policy "companyverif admin select" on public.company_verifications;
create policy "companyverif admin select"
  on public.company_verifications for select to authenticated
  using (public.is_admin());

drop policy "companyverif admin update" on public.company_verifications;
create policy "companyverif admin update"
  on public.company_verifications for update to authenticated
  using (public.is_admin());

drop policy "verif admin select" on public.verifications;
create policy "verif admin select"
  on public.verifications for select to authenticated
  using (public.is_admin());

drop policy "verif admin update" on public.verifications;
create policy "verif admin update"
  on public.verifications for update to authenticated
  using (public.is_admin());

drop policy "scheduled notifications admin read" on public.scheduled_notifications;
create policy "scheduled notifications admin read"
  on public.scheduled_notifications for select to authenticated
  using (public.is_admin());

drop policy "scheduled notifications admin update" on public.scheduled_notifications;
create policy "scheduled notifications admin update"
  on public.scheduled_notifications for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';

commit;
