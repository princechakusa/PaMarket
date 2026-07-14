-- Site-wide website announcements, separate from per-user notifications.
create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  link_label text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists site_announcements_active_created_idx
  on public.site_announcements (is_active, created_at desc);

alter table public.site_announcements enable row level security;

drop policy if exists "site_announcements: public read active" on public.site_announcements;
create policy "site_announcements: public read active"
  on public.site_announcements for select
  to anon, authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- The repository's existing recursion-safe admin helper is public.is_admin().
drop policy if exists "site_announcements: admin write" on public.site_announcements;
create policy "site_announcements: admin write"
  on public.site_announcements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.site_announcements to anon, authenticated;
grant insert, update, delete on public.site_announcements to authenticated;

comment on table public.site_announcements is
  'Dismissible public website announcements managed by PaMarket admins.';
