-- Content reports (users reporting listings or other users)
-- Run in Supabase SQL Editor

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing','user','support','bug','appeal')),
  target_id   text not null,
  reason      text not null,
  reporter_id uuid references auth.users(id) on delete set null,
  reported_by text,
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now()
);

alter table reports enable row level security;

-- Anyone can submit a report or support message
create policy "Authenticated users can report"
  on reports for insert
  with check (reporter_id = auth.uid() or reporter_id is null);

-- Users can read their own reports
create policy "Users read own reports"
  on reports for select
  using (true);

-- Prevent duplicate reports from same user on same target
create unique index if not exists uq_report
  on reports (target_id, reporter_id)
  where target_type in ('listing','user');
