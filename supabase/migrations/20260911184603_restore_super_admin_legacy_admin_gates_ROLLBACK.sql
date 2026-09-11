-- Roll back only C2B-FIX. Restores the exact pre-fix helper semantics and the
-- seven inline role = admin policies. C2B hierarchy/credential changes remain.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin() is null;
revoke all on function public.is_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_admin() to public, anon, authenticated, service_role;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  );
$$;

comment on function public.is_moderator() is null;
revoke all on function public.is_moderator() from public, anon, authenticated, service_role;
grant execute on function public.is_moderator() to public, anon, authenticated, service_role;

drop policy "companyverif admin read" on public.company_verifications;
create policy "companyverif admin read"
  on public.company_verifications for select to authenticated
  using (auth.uid() in (select p.id from public.profiles p where p.role = 'admin'));

drop policy "companyverif admin select" on public.company_verifications;
create policy "companyverif admin select"
  on public.company_verifications for select to authenticated
  using (auth.uid() in (select p.id from public.profiles p where p.role = 'admin'));

drop policy "companyverif admin update" on public.company_verifications;
create policy "companyverif admin update"
  on public.company_verifications for update to authenticated
  using (auth.uid() in (select p.id from public.profiles p where p.role = 'admin'));

drop policy "verif admin select" on public.verifications;
create policy "verif admin select"
  on public.verifications for select to authenticated
  using (auth.uid() in (select p.id from public.profiles p where p.role = 'admin'));

drop policy "verif admin update" on public.verifications;
create policy "verif admin update"
  on public.verifications for update to authenticated
  using (auth.uid() in (select p.id from public.profiles p where p.role = 'admin'));

drop policy "scheduled notifications admin read" on public.scheduled_notifications;
create policy "scheduled notifications admin read"
  on public.scheduled_notifications for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ));

drop policy "scheduled notifications admin update" on public.scheduled_notifications;
create policy "scheduled notifications admin update"
  on public.scheduled_notifications for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ));

notify pgrst, 'reload schema';

commit;
