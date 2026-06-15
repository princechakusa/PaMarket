-- ============================================================
-- PaMarket — contact unlock requests (Hire Talent)
-- An employer ("requester") asks to unlock a candidate's name + phone +
-- email. An admin approves/declines in the admin panel. The candidate's
-- identity is revealed to that employer ONLY after an approved row exists.
-- No money is stored or shown anywhere — payment is handled off-platform.
-- Safe to run more than once.
-- ============================================================

create table if not exists public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,  -- the hirer
  candidate_id  uuid not null references auth.users(id) on delete cascade,  -- the talent
  requester_name text not null default '',
  candidate_name text not null default '',
  company       text not null default '',
  role          text not null default '',
  note          text not null default '',
  status        text not null default 'pending'
                  check (status in ('pending','approved','declined')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users(id),
  -- One live request per (employer, candidate); re-requesting updates the row.
  unique (requester_id, candidate_id)
);

create index if not exists contact_requests_requester_idx on public.contact_requests (requester_id);
create index if not exists contact_requests_candidate_idx on public.contact_requests (candidate_id);
create index if not exists contact_requests_status_idx    on public.contact_requests (status);

alter table public.contact_requests enable row level security;

-- Read: the requester (their own), the candidate (about them), or an admin.
drop policy if exists "contact_requests: read" on public.contact_requests;
create policy "contact_requests: read"
  on public.contact_requests for select to authenticated
  using (
    auth.uid() = requester_id
    or auth.uid() = candidate_id
    or public.is_admin()
  );

-- Insert: a signed-in user may only create a request as themselves, and may
-- not request their own profile.
drop policy if exists "contact_requests: insert" on public.contact_requests;
create policy "contact_requests: insert"
  on public.contact_requests for insert to authenticated
  with check (auth.uid() = requester_id and requester_id <> candidate_id);

-- Update: the requester may re-submit (e.g. edit note) while pending; only an
-- admin may change the status (approve / decline).
drop policy if exists "contact_requests: requester update" on public.contact_requests;
create policy "contact_requests: requester update"
  on public.contact_requests for update to authenticated
  using (auth.uid() = requester_id and status = 'pending')
  with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "contact_requests: admin update" on public.contact_requests;
create policy "contact_requests: admin update"
  on public.contact_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Delete: requester may withdraw their own request; admin may remove any.
drop policy if exists "contact_requests: delete" on public.contact_requests;
create policy "contact_requests: delete"
  on public.contact_requests for delete to authenticated
  using (auth.uid() = requester_id or public.is_admin());
