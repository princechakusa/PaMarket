-- fix: rental_companies INSERT/UPDATE policies fail because the RLS subquery
-- against `businesses` is itself subject to businesses RLS, blocking the check.
-- Solution: a SECURITY DEFINER function that reads businesses without RLS restrictions.

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.businesses
    where id = p_business_id
      and owner_user_id = auth.uid()
  );
$$;

grant execute on function public.is_business_owner(uuid) to authenticated;

-- Recreate rental_companies policies using the helper function

drop policy if exists "rental_companies: public read"   on public.rental_companies;
drop policy if exists "rental_companies: owner insert"  on public.rental_companies;
drop policy if exists "rental_companies: owner update"  on public.rental_companies;

create policy "rental_companies: public read"
  on public.rental_companies for select
  using (
    (status = 'active' and deleted_at is null)
    or public.is_business_owner(business_id)
    or public.is_admin()
  );

create policy "rental_companies: owner insert"
  on public.rental_companies for insert
  with check (
    auth.uid() is not null
    and public.is_business_owner(business_id)
  );

create policy "rental_companies: owner update"
  on public.rental_companies for update
  using (public.is_business_owner(business_id));


-- Also fix rental_company_profiles — same subquery problem via rental_companies join

drop policy if exists "rental_company_profiles: owner write" on public.rental_company_profiles;

create policy "rental_company_profiles: owner write"
  on public.rental_company_profiles for all
  using (
    exists (
      select 1 from public.rental_companies rc
      where rc.id = company_id
        and public.is_business_owner(rc.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.rental_companies rc
      where rc.id = company_id
        and public.is_business_owner(rc.business_id)
    )
  );
