-- Public clients may read active ads, while only verified admins may write.

alter table public.paid_ads enable row level security;

revoke all on table public.paid_ads from anon;
grant select on table public.paid_ads to anon;

revoke truncate, references, trigger on table public.paid_ads from authenticated;
grant select, insert, update, delete on table public.paid_ads to authenticated;

drop policy if exists "admin_all" on public.paid_ads;
drop policy if exists "anon read paid_ads" on public.paid_ads;
drop policy if exists "anon write paid_ads" on public.paid_ads;
drop policy if exists "paid_ads admin write" on public.paid_ads;
drop policy if exists "public can view active ads" on public.paid_ads;
drop policy if exists "public_read_active" on public.paid_ads;
drop policy if exists "paid_ads public read active" on public.paid_ads;

create policy "paid_ads public read active"
on public.paid_ads
for select
to anon, authenticated
using (active = true);

create policy "paid_ads admin write"
on public.paid_ads
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
