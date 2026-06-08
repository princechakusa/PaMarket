-- ============================================================
-- PaMarket — fix verifications row-level security
-- A signed-in user must be able to submit (insert/update) their OWN
-- verification row, the user must read their own, and admins read all.
-- The previous policies blocked the insert. Safe to run more than once.
-- ============================================================
alter table public.verifications enable row level security;

-- remove any older/incorrect policies (names vary across earlier setups)
drop policy if exists "verif_write_own"   on public.verifications;
drop policy if exists "verif_read_all"     on public.verifications;
drop policy if exists "verif own select"   on public.verifications;
drop policy if exists "verif own insert"   on public.verifications;
drop policy if exists "verif own update"   on public.verifications;
drop policy if exists "verif admin select" on public.verifications;
drop policy if exists "verif admin update" on public.verifications;

-- a user can create their own verification submission
create policy "verif own insert" on public.verifications
  for insert to authenticated
  with check (user_id = auth.uid());

-- a user can update their own submission (re-submit / upsert)
create policy "verif own update" on public.verifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- a user can read their own submission status
create policy "verif own select" on public.verifications
  for select to authenticated
  using (user_id = auth.uid());

-- admins can read every submission (for the admin portal review screen)
create policy "verif admin select" on public.verifications
  for select to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));

-- admins can approve / reject (update status) any submission
create policy "verif admin update" on public.verifications
  for update to authenticated
  using (auth.uid() in (select id from public.profiles where role = 'admin'));
