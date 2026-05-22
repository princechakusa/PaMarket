-- ─────────────────────────────────────────────────────────────
-- verifications table
-- ─────────────────────────────────────────────────────────────

create table if not exists public.verifications (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  id_doc       text, -- Base64 or URL
  selfie       text, -- Base64 or URL
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note   text,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for status
create index if not exists verifications_status_idx on public.verifications (status);

-- Enable RLS
alter table public.verifications enable row level security;

-- Users can read/write their own verification
create policy "Users can view own verification"
  on public.verifications for select
  using (auth.uid() = user_id);

create policy "Users can insert own verification"
  on public.verifications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own verification"
  on public.verifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can do everything
create policy "Admins can manage all verifications"
  on public.verifications
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
