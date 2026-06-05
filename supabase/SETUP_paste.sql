create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'User',
  phone       text,
  avatar      text,
  verified    boolean not null default false,
  wallet_usd  numeric(12,2) not null default 0,
  language    text not null default 'English',
  email       text,
  bio         text,
  city        text,
  job_title   text,
  skills      text,
  sector      text,
  exp         text,
  cv          jsonb,
  open_to_work boolean not null default false,
  verification_pending boolean not null default false,
  role        text not null default 'user' check (role in ('user','admin','moderator')),
  status      text not null default 'active' check (status in ('active','banned','suspended')),
  ban_reason  text,
  ban_until   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read"
  on public.profiles for select
  using (true);
drop policy if exists "profiles: own insert" on public.profiles;
create policy "profiles: own insert"
  on public.profiles for insert
  with check (auth.uid()::text = id::text);
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid()::text = id::text)
  with check (
    auth.uid()::text = id::text
    and role = (select role from public.profiles where id::text = auth.uid()::text)
  );
create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references auth.users(id) on delete cascade,
  seller_name text not null default '',
  seller_phone text not null default '',
  title       text not null,
  description text not null default '',
  price       numeric(14,2) not null default 0,
  currency    text not null default 'USD' check (currency in ('USD','ZiG')),
  category    text not null default 'other',
  province    text not null default '',
  city        text not null default '',
  suburb      text not null default '',
  photos      text[] not null default '{}',
  status      text not null default 'active' check (status in ('active','sold','deleted','pending')),
  condition   text check (condition in ('new','like-new','used','refurbished')),
  boost       jsonb,
  views       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists listings_seller_idx   on public.listings (seller_id);
create index if not exists listings_status_idx   on public.listings (status);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_created_idx  on public.listings (created_at desc);
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();
alter table public.listings enable row level security;
drop policy if exists "listings: public read active" on public.listings;
create policy "listings: public read active"
  on public.listings for select
  using (status = 'active' or seller_id::text = auth.uid()::text);
drop policy if exists "listings: own insert" on public.listings;
create policy "listings: own insert"
  on public.listings for insert
  with check (auth.uid()::text = seller_id::text);
drop policy if exists "listings: own update" on public.listings;
create policy "listings: own update"
  on public.listings for update
  using (auth.uid()::text = seller_id::text)
  with check (auth.uid()::text = seller_id::text);
drop policy if exists "listings: own delete" on public.listings;
create policy "listings: own delete"
  on public.listings for delete
  using (auth.uid()::text = seller_id::text);
create table if not exists public.conversations (
  id          text primary key,
  members     uuid[] not null default '{}',
  listing_id  uuid references public.listings(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists conversations_members_idx
  on public.conversations using gin (members);
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();
alter table public.conversations enable row level security;
drop policy if exists "conversations: member read" on public.conversations;
create policy "conversations: member read"
  on public.conversations for select
  using (auth.uid()::text = any(members::text[]));
drop policy if exists "conversations: member insert" on public.conversations;
create policy "conversations: member insert"
  on public.conversations for insert
  with check (auth.uid()::text = any(members::text[]));
drop policy if exists "conversations: member update" on public.conversations;
create policy "conversations: member update"
  on public.conversations for update
  using (auth.uid()::text = any(members::text[]));
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  sender_name     text not null default '',
  text            text not null,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_created_idx
  on public.messages (conversation_id, created_at asc);
alter table public.messages enable row level security;
drop policy if exists "messages: member read" on public.messages;
create policy "messages: member read"
  on public.messages for select
  using (
    conversation_id in (select id from public.conversations where auth.uid()::text = any(members::text[]))
  );
drop policy if exists "messages: member insert" on public.messages;
create policy "messages: member insert"
  on public.messages for insert
  with check (
    auth.uid()::text = sender_id::text
    and conversation_id in (select id from public.conversations where auth.uid()::text = any(members::text[]))
  );
drop policy if exists "messages: member update" on public.messages;
create policy "messages: member update"
  on public.messages for update
  using (
    conversation_id in (select id from public.conversations where auth.uid()::text = any(members::text[]))
  );
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.listings(id) on delete cascade,
  job_title       text not null default '',
  company         text not null default '',
  applicant_id    uuid not null references auth.users(id) on delete cascade,
  applicant_name  text not null default '',
  applicant_phone text not null default '',
  applicant_email text not null default '',
  message         text not null default '',
  status          text not null default 'pending'
                    check (status in ('pending','shortlisted','declined')),
  employer_id     uuid not null references auth.users(id) on delete cascade,
  applied_at      timestamptz not null default now(),
  unique (job_id, applicant_id)
);
create index if not exists applications_applicant_idx on public.applications (applicant_id);
create index if not exists applications_employer_idx  on public.applications (employer_id);
create index if not exists applications_job_idx       on public.applications (job_id);
alter table public.applications enable row level security;
drop policy if exists "applications: read" on public.applications;
create policy "applications: read"
  on public.applications for select
  using (
    auth.uid()::text = applicant_id::text
    or auth.uid()::text = employer_id::text
  );
drop policy if exists "applications: insert" on public.applications;
create policy "applications: insert"
  on public.applications for insert
  with check (auth.uid()::text = applicant_id::text);
drop policy if exists "applications: employer update" on public.applications;
create policy "applications: employer update"
  on public.applications for update
  using (auth.uid()::text = employer_id::text)
  with check (auth.uid()::text = employer_id::text);
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references auth.users(id) on delete cascade,
  reviewer_id   uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null default '',
  rating        smallint not null check (rating between 1 and 5),
  text          text not null default '',
  created_at    timestamptz not null default now(),
  unique (seller_id, reviewer_id),
  check (seller_id <> reviewer_id)
);
create index if not exists reviews_seller_idx   on public.reviews (seller_id, created_at desc);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);
alter table public.reviews enable row level security;
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read"
  on public.reviews for select
  using (true);
drop policy if exists "reviews: own insert" on public.reviews;
create policy "reviews: own insert"
  on public.reviews for insert
  with check (
    auth.uid()::text = reviewer_id::text
    and auth.uid()::text <> seller_id::text
  );
drop policy if exists "reviews: own delete" on public.reviews;
create policy "reviews: own delete"
  on public.reviews for delete
  using (auth.uid()::text = reviewer_id::text);
create table if not exists public.notifications (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  body        text default '',
  type        text default 'info',
  read        boolean not null default false,
  created_at  timestamptz not null default now(),
  meta        jsonb default '{}'::jsonb
);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read = false;
alter table public.notifications enable row level security;
drop policy if exists "own notifications: select" on public.notifications;
create policy "own notifications: select"
  on public.notifications for select
  using (auth.uid()::text = user_id::text);
drop policy if exists "own notifications: update" on public.notifications;
create policy "own notifications: update"
  on public.notifications for update
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);
drop policy if exists "own notifications: insert" on public.notifications;
create policy "own notifications: insert"
  on public.notifications for insert
  with check (auth.uid()::text = user_id::text);
drop policy if exists "own notifications: delete" on public.notifications;
create policy "own notifications: delete"
  on public.notifications for delete
  using (auth.uid()::text = user_id::text);
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
drop policy if exists "Authenticated users can report" on reports;
create policy "Authenticated users can report"
  on reports for insert
  with check (reporter_id::text = auth.uid()::text or reporter_id is null);
drop policy if exists "Users read own reports" on reports;
create policy "Users read own reports"
  on reports for select
  using (true);
create unique index if not exists uq_report
  on reports (target_id, reporter_id)
  where target_type in ('listing','user');
create table if not exists saved_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  query       text,
  category    text,
  saved_at    timestamptz default now(),
  last_check  timestamptz default now(),
  constraint  uq_saved_search unique (user_id, query, category)
);
alter table saved_searches enable row level security;
drop policy if exists "Users manage their own saved searches" on saved_searches;
create policy "Users manage their own saved searches"
  on saved_searches for all
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);
create table if not exists user_saves (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  listing_id   text not null,
  saved_at     timestamptz not null default now(),
  unique(user_id, listing_id)
);
alter table user_saves enable row level security;
drop policy if exists "Users manage own saves" on user_saves;
create policy "Users manage own saves"
  on user_saves for all
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);
create table if not exists error_logs (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  message     text,
  source      text,
  stack       text,
  user_id     uuid references auth.users(id) on delete set null,
  user_agent  text,
  created_at  timestamptz default now()
);
alter table error_logs enable row level security;
drop policy if exists "Service role only read" on error_logs;
create policy "Service role only read"
  on error_logs for select
  using (false);
drop policy if exists "Anyone can log errors" on error_logs;
create policy "Anyone can log errors"
  on error_logs for insert
  with check (true);
create or replace function prune_error_logs()
returns void language plpgsql as $$
begin
  delete from error_logs where created_at < now() - interval '30 days';
end;
$$;
create or replace function check_listing_content()
returns trigger language plpgsql as $$
declare
  banned_words text[] := array[
    'scam','fraud','fake','stolen','illegal','drugs','weapon','gun',
    'pirated','counterfeit','smuggle','smuggling','bribe','corrupt'
  ];
  w text;
  content text;
begin
  content := lower(coalesce(new.title,'') || ' ' || coalesce(new.description,''));
  foreach w in array banned_words loop
    if content like '%' || w || '%' then
      raise exception 'Listing contains prohibited content: %', w;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_listing_moderation on listings;
create trigger trg_listing_moderation
  before insert or update on listings
  for each row execute function check_listing_content();
alter table listings
  add column if not exists expires_at timestamptz
    generated always as (created_at + interval '30 days') stored;
create or replace function expire_old_listings()
returns void language plpgsql as $$
begin
  update listings
  set status = 'expired'
  where status = 'active'
    and expires_at < now();
end;
$$;
create or replace function renew_listing(listing_id uuid)
returns void language plpgsql security definer as $$
begin
  update listings
  set expires_at = now() + interval '30 days'
  where id = listing_id
    and seller_id::text = auth.uid()::text;
end;
$$;
create table if not exists topup_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_name   text,
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null,
  reference   text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint  uq_topup_ref unique (reference)
);
alter table topup_requests enable row level security;
drop policy if exists "Users manage their own topup requests" on topup_requests;
create policy "Users manage their own topup requests"
  on topup_requests for all
  to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listings-photos',
  'listings-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
drop policy if exists "Public read for listing photos" on storage.objects;
create policy "Public read for listing photos"
  on storage.objects for select
  using (bucket_id = 'listings-photos');
drop policy if exists "Authenticated users can upload listing photos" on storage.objects;
create policy "Authenticated users can upload listing photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listings-photos'
    and split_part(name, '/', 1) = 'listings'
    and split_part(name, '/', 2) = auth.uid()::text
  );
drop policy if exists "Users can delete their own listing photos" on storage.objects;
create policy "Users can delete their own listing photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listings-photos'
    and split_part(name, '/', 2) = auth.uid()::text
  );
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv jsonb;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_file_url text;
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv-files', 'cv-files', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "cv_files_insert" ON storage.objects;
CREATE POLICY "cv_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cv-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "cv_files_update" ON storage.objects;
CREATE POLICY "cv_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cv-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "cv_files_delete" ON storage.objects;
CREATE POLICY "cv_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cv-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "cv_files_select" ON storage.objects;
CREATE POLICY "cv_files_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'cv-files');
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS custom_questions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '[]'::jsonb;
SET search_path = public;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS province   text;
CREATE INDEX IF NOT EXISTS profiles_province_idx ON public.profiles (province);
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target        text NOT NULL DEFAULT 'all',
  title         text NOT NULL,
  body          text NOT NULL,
  type          text NOT NULL DEFAULT 'info',
  deep_link     text,
  image_url     text,
  provinces     text[],
  scheduled_for timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sched_notif_status_time_idx
  ON public.scheduled_notifications (status, scheduled_for)
  WHERE status = 'pending';
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sched_notif_admin_only" ON public.scheduled_notifications;
CREATE POLICY "sched_notif_admin_only"
  ON public.scheduled_notifications
  FOR ALL
  USING (false)    -- blocks all client access
  WITH CHECK (false);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs','verification-docs',false,8388608,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "verifdocs user insert" on storage.objects;
create policy "verifdocs user insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);
drop policy if exists "verifdocs user select" on storage.objects;
create policy "verifdocs user select" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);
drop policy if exists "verifdocs user delete" on storage.objects;
create policy "verifdocs user delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and split_part(name,'/',1) = auth.uid()::text);
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "verifdocs admin select" on storage.objects';
    execute 'create policy "verifdocs admin select" on storage.objects for select to authenticated using (bucket_id = ''verification-docs'' and auth.uid()::text in (select id::text from public.profiles where role = ''admin''))';
  end if;
end $$;
do $$
begin
  if to_regclass('public.verifications') is not null then
    execute 'alter table public.verifications add column if not exists id_doc_path text';
    execute 'alter table public.verifications add column if not exists selfie_path text';
  end if;
end $$;
create table if not exists public.company_verifications (
  user_id       uuid primary key,
  company_name  text,
  reg_cert_path text,
  owner_id_path text,
  tax_cert_path text,
  premises_path text,
  status        text not null default 'pending',
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz
);
alter table public.company_verifications enable row level security;
drop policy if exists "companyverif user insert" on public.company_verifications;
create policy "companyverif user insert" on public.company_verifications for insert to authenticated
  with check (user_id::text = auth.uid()::text);
drop policy if exists "companyverif user update" on public.company_verifications;
create policy "companyverif user update" on public.company_verifications for update to authenticated
  using (user_id::text = auth.uid()::text);
drop policy if exists "companyverif user select" on public.company_verifications;
create policy "companyverif user select" on public.company_verifications for select to authenticated
  using (user_id::text = auth.uid()::text);
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "companyverif admin select" on public.company_verifications';
    execute 'create policy "companyverif admin select" on public.company_verifications for select to authenticated using (auth.uid()::text in (select id::text from public.profiles where role = ''admin''))';
    execute 'drop policy if exists "companyverif admin update" on public.company_verifications';
    execute 'create policy "companyverif admin update" on public.company_verifications for update to authenticated using (auth.uid()::text in (select id::text from public.profiles where role = ''admin''))';
    execute 'alter table public.profiles add column if not exists company_verified boolean default false';
    execute 'alter table public.profiles add column if not exists company_verification_pending boolean default false';
  end if;
end $$;
create table if not exists public.conversation_deletions (
  user_id         uuid not null,
  conversation_id text not null,
  deleted_at      timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table public.conversation_deletions enable row level security;
drop policy if exists "convdel own select" on public.conversation_deletions;
create policy "convdel own select" on public.conversation_deletions
  for select to authenticated using (user_id::text = auth.uid()::text);
drop policy if exists "convdel own insert" on public.conversation_deletions;
create policy "convdel own insert" on public.conversation_deletions
  for insert to authenticated with check (user_id::text = auth.uid()::text);
drop policy if exists "convdel own delete" on public.conversation_deletions;
create policy "convdel own delete" on public.conversation_deletions
  for delete to authenticated using (user_id::text = auth.uid()::text);
do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists "own notifications: delete" on public.notifications';
    execute 'create policy "own notifications: delete" on public.notifications for delete to authenticated using (user_id::text = auth.uid()::text)';
  end if;
end $$;
create table if not exists public.verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  id_doc       text,
  selfie       text,
  id_doc_path  text,
  selfie_path  text,
  status       text not null default 'pending',
  submitted_at timestamptz not null default now(),
  admin_note   text,
  unique (user_id)
);
alter table public.verifications enable row level security;
drop policy if exists "verif own select" on public.verifications;
create policy "verif own select" on public.verifications for select to authenticated
  using (user_id::text = auth.uid()::text);
drop policy if exists "verif own insert" on public.verifications;
create policy "verif own insert" on public.verifications for insert to authenticated
  with check (user_id::text = auth.uid()::text);
drop policy if exists "verif own update" on public.verifications;
create policy "verif own update" on public.verifications for update to authenticated
  using (user_id::text = auth.uid()::text);
drop policy if exists "verif admin select" on public.verifications;
create policy "verif admin select" on public.verifications for select to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));
drop policy if exists "verif admin update" on public.verifications;
create policy "verif admin update" on public.verifications for update to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));
create table if not exists public.paid_ads (
  id          text primary key,
  title       text,
  image_url   text,
  link_url    text,
  placement   text,
  active      boolean not null default true,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.paid_ads enable row level security;
drop policy if exists "paid_ads public read" on public.paid_ads;
create policy "paid_ads public read" on public.paid_ads for select using (true);
drop policy if exists "paid_ads admin write" on public.paid_ads;
create policy "paid_ads admin write" on public.paid_ads for all to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'))
  with check (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));
create table if not exists public.app_settings (
  id         integer primary key default 1,
  key        text unique,
  value      jsonb,
  settings   jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read" on public.app_settings for select using (true);
drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write" on public.app_settings for all to authenticated
  using (auth.uid()::text in (select id::text from public.profiles where role = 'admin'))
  with check (auth.uid()::text in (select id::text from public.profiles where role = 'admin'));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images','chat-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-files','cv-files', true, 5242880, array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
drop policy if exists "chat-images auth upload" on storage.objects;
create policy "chat-images auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images');
drop policy if exists "chat-images public read" on storage.objects;
create policy "chat-images public read" on storage.objects for select
  using (bucket_id = 'chat-images');
drop policy if exists "cv-files auth upload" on storage.objects;
create policy "cv-files auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-files');
drop policy if exists "cv-files public read" on storage.objects;
create policy "cv-files public read" on storage.objects for select
  using (bucket_id = 'cv-files');
