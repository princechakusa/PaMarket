-- ============================================================================
-- PaMarket Moderation Backend — Phase A (single source of truth)
-- ----------------------------------------------------------------------------
-- Production-ready, IDEMPOTENT migration. Run in the Supabase SQL Editor with
-- the service role. Backend only — no app/admin changes.
--
-- Contents:
--   0. Helper: is_moderator()
--   1. reports  — severity, priority, message_id, chat_id, target/status enums,
--                 indexes, RLS hardening
--   2. moderation_actions — immutable admin audit log (RLS: moderators only)
--   3. listings — extended moderation states (RLS already hides non-active)
--   4. moderation_rules + tiered check_listing_content() (ALLOW / FLAG / BLOCK)
--   5. user_sanctions + is_user_suspended()/is_user_banned() + enforcement
--
-- Existing production data is preserved; every existing status/target_type
-- value remains valid under the widened CHECK constraints.
-- ============================================================================

begin;

-- ── 0. Moderator/admin predicate ───────────────────────────────────────────
-- SECURITY DEFINER so it can read profiles.role regardless of profiles RLS.
create or replace function public.is_moderator()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','moderator')
  );
$$;

-- ============================================================================
-- 1. REPORTS — enhance the existing table
-- ============================================================================
alter table public.reports add column if not exists severity   text;
alter table public.reports add column if not exists priority   smallint;
alter table public.reports add column if not exists message_id uuid;     -- messages.id
alter table public.reports add column if not exists chat_id    text;     -- conversations.id (text)
alter table public.reports add column if not exists updated_at timestamptz;

-- Defaults + backfill existing rows (no NULLs left behind).
alter table public.reports alter column severity   set default 'medium';
alter table public.reports alter column priority   set default 3;
alter table public.reports alter column updated_at set default now();
update public.reports set severity   = 'medium' where severity   is null;
update public.reports set priority   = 3        where priority   is null;
update public.reports set updated_at = created_at where updated_at is null;

-- Widen target_type (+ message, chat) and status (+ workflow states).
-- Drop any existing CHECK constraints on these columns by definition match,
-- so this works no matter what Postgres auto-named them.
do $$
declare r record;
begin
  for r in
    select conname, pg_get_constraintdef(oid) def
    from pg_constraint
    where conrelid = 'public.reports'::regclass and contype = 'c'
  loop
    if r.def ilike '%target_type%' or r.def ilike '%severity%'
       or r.def ilike '%priority%' or r.def ~* 'status' then
      execute format('alter table public.reports drop constraint %I', r.conname);
    end if;
  end loop;
end$$;

alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('listing','user','message','chat','support','bug','appeal'));
alter table public.reports
  add constraint reports_status_check
  check (status in ('open','reviewing','actioned','resolved','dismissed'));
alter table public.reports
  add constraint reports_severity_check
  check (severity in ('low','medium','high','critical'));
alter table public.reports
  add constraint reports_priority_check
  check (priority between 1 and 5);

-- Indexes for the moderation queue.
create index if not exists reports_status_idx      on public.reports (status);
create index if not exists reports_severity_idx    on public.reports (severity);
create index if not exists reports_created_at_idx  on public.reports (created_at desc);
create index if not exists reports_target_type_idx on public.reports (target_type);
create index if not exists reports_target_id_idx   on public.reports (target_id);
create index if not exists reports_priority_idx    on public.reports (priority desc);
-- "most reported target": composite for GROUP BY target_type,target_id counts.
create index if not exists reports_target_idx      on public.reports (target_type, target_id);

-- RLS hardening. The existing SELECT policy was `using (true)` — every
-- authenticated user could read every report (mislabelled "own"). Replace with
-- reporter-owns + moderator-reads-all, and let moderators update reports.
alter table public.reports enable row level security;
drop policy if exists "Users read own reports" on public.reports;
drop policy if exists "reports: reporter or moderator read" on public.reports;
create policy "reports: reporter or moderator read"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator());
drop policy if exists "reports: moderator update" on public.reports;
create policy "reports: moderator update"
  on public.reports for update
  using (public.is_moderator()) with check (public.is_moderator());
-- (The existing "Authenticated users can report" INSERT policy is preserved.)

-- Keep updated_at fresh on report changes.
create or replace function public.touch_reports_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_reports_touch on public.reports;
create trigger trg_reports_touch before update on public.reports
  for each row execute function public.touch_reports_updated_at();

-- ============================================================================
-- 2. MODERATION_ACTIONS — immutable admin audit log
-- ============================================================================
create table if not exists public.moderation_actions (
  id              uuid primary key default gen_random_uuid(),
  moderator_id    uuid references auth.users(id) on delete set null,
  action_type     text not null check (action_type in (
                    'warning','approve','reject','remove','restore',
                    'suspend','unsuspend','ban','unban',
                    'block_listing','unblock_listing')),
  target_type     text not null check (target_type in ('listing','user','message','chat','report')),
  target_id       text not null,
  reason          text,
  notes           text,
  previous_status text,
  new_status      text,
  created_at      timestamptz not null default now()
);
create index if not exists moderation_actions_target_idx    on public.moderation_actions (target_type, target_id);
create index if not exists moderation_actions_moderator_idx on public.moderation_actions (moderator_id);
create index if not exists moderation_actions_type_idx      on public.moderation_actions (action_type);
create index if not exists moderation_actions_created_idx   on public.moderation_actions (created_at desc);

alter table public.moderation_actions enable row level security;
drop policy if exists "moderation_actions: moderator read" on public.moderation_actions;
create policy "moderation_actions: moderator read"
  on public.moderation_actions for select using (public.is_moderator());
drop policy if exists "moderation_actions: moderator insert" on public.moderation_actions;
create policy "moderation_actions: moderator insert"
  on public.moderation_actions for insert
  with check (public.is_moderator() and moderator_id = auth.uid());
-- No UPDATE/DELETE policies → the audit log is append-only (immutable).

-- ============================================================================
-- 3. LISTINGS — extended moderation states
-- ============================================================================
-- Public read RLS is already `status = 'active' or seller_id = auth.uid()`,
-- so under_review / flagged / removed are hidden from the public automatically;
-- owners still see their own. We only widen the CHECK — nothing is deleted.
do $$
declare r record;
begin
  for r in
    select conname, pg_get_constraintdef(oid) def
    from pg_constraint
    where conrelid = 'public.listings'::regclass and contype = 'c'
  loop
    if r.def ~* 'status' and r.def ilike '%active%' then
      execute format('alter table public.listings drop constraint %I', r.conname);
    end if;
  end loop;
end$$;
alter table public.listings
  add constraint listings_status_check
  check (status in ('pending','active','under_review','flagged','sold','removed','deleted'));
create index if not exists listings_status_idx on public.listings (status);

-- ============================================================================
-- 4. TIERED CONTENT FILTER — configurable rules + ALLOW/FLAG/BLOCK engine
-- ============================================================================
create table if not exists public.moderation_rules (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  category   text,
  match_type text not null default 'contains' check (match_type in ('contains','word','regex')),
  pattern    text not null,
  risk       text not null check (risk in ('flag','block')),
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (match_type, pattern)
);
alter table public.moderation_rules enable row level security;
drop policy if exists "moderation_rules: moderator all" on public.moderation_rules;
create policy "moderation_rules: moderator all"
  on public.moderation_rules for all
  using (public.is_moderator()) with check (public.is_moderator());

-- Seed rules (idempotent). BLOCK = illegal/hateful; FLAG = contact-evasion,
-- scam phrases, and PII/link patterns that need a human look.
insert into public.moderation_rules (label, category, match_type, pattern, risk) values
  ('Illegal goods',        'prohibited', 'word', 'gun',          'block'),
  ('Illegal goods',        'prohibited', 'word', 'rifle',        'block'),
  ('Illegal goods',        'prohibited', 'word', 'ammunition',   'block'),
  ('Illegal goods',        'prohibited', 'word', 'weapon',       'block'),
  ('Illegal goods',        'prohibited', 'word', 'drugs',        'block'),
  ('Illegal goods',        'prohibited', 'word', 'cocaine',      'block'),
  ('Illegal goods',        'prohibited', 'word', 'stolen',       'block'),
  ('Illegal goods',        'prohibited', 'word', 'counterfeit',  'block'),
  ('Illegal goods',        'prohibited', 'word', 'pirated',      'block'),
  ('Illegal goods',        'prohibited', 'word', 'smuggle',      'block'),
  ('Illegal goods',        'prohibited', 'word', 'ivory',        'block'),
  ('Hate speech',          'hate',       'contains', 'kill all',      'block'),
  ('Scam phrase',          'scam',       'contains', 'pay outside',        'flag'),
  ('Scam phrase',          'scam',       'contains', 'pay outside the app','flag'),
  ('Scam phrase',          'scam',       'contains', 'send money first',   'flag'),
  ('Scam phrase',          'scam',       'contains', 'advance fee',        'flag'),
  ('Scam phrase',          'scam',       'contains', 'western union',      'flag'),
  ('Scam phrase',          'scam',       'contains', 'money gram',         'flag'),
  ('Contact evasion',      'contact',    'contains', 'whatsapp me',        'flag'),
  ('Contact evasion',      'contact',    'contains', 'contact me directly','flag'),
  ('Contact evasion',      'contact',    'contains', 'telegram',           'flag'),
  ('Contact evasion',      'contact',    'contains', 'signal',             'flag'),
  ('Contact evasion',      'contact',    'contains', 'messenger',          'flag'),
  ('Phone number',         'pii',        'regex', '(\+?\d[\d\s().-]{6,}\d)',                'flag'),
  ('Email address',        'pii',        'regex', '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}',  'flag'),
  ('External link',        'link',       'regex', '(https?://|www\.|t\.me/|wa\.me/|bit\.ly|\.co\.zw)', 'flag')
on conflict (match_type, pattern) do nothing;

-- The moderation engine. Runs BEFORE INSERT/UPDATE on listings.
--   * banned/suspended sellers cannot create listings          → BLOCK (raise)
--   * any 'block' rule matches                                  → BLOCK (raise)
--   * any 'flag' rule / excessive non-ASCII / hidden unicode    → FLAG (status)
--   * otherwise                                                 → ALLOW
-- Admin/moderator status transitions and non-text edits are left untouched.
create or replace function public.check_listing_content()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        record;
  content  text;
  outcome  text := 'ALLOW';
  nonascii int;
  bb       bytea;
begin
  -- Sanction enforcement (new listings only).
  if tg_op = 'INSERT' then
    if public.is_user_banned(new.seller_id) then
      raise exception 'account_banned: this account is banned from posting';
    end if;
    if public.is_user_suspended(new.seller_id) then
      raise exception 'account_suspended: this account is suspended from posting';
    end if;
  end if;

  -- Skip when nothing text-relevant changed on UPDATE (e.g. a boost or a
  -- moderator status change) so we never re-flag admin decisions.
  if tg_op = 'UPDATE'
     and new.title       is not distinct from old.title
     and new.description is not distinct from old.description then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.status in ('removed','under_review','flagged','deleted')
     and new.status is distinct from old.status then
    return new;
  end if;

  content := lower(coalesce(new.title,'') || ' ' || coalesce(new.description,''));

  -- Configurable rule evaluation.
  for r in select * from public.moderation_rules where enabled loop
    if (r.match_type = 'contains' and content like '%' || lower(r.pattern) || '%')
       or (r.match_type = 'word'  and content ~* ('\m' || r.pattern || '\M'))
       or (r.match_type = 'regex' and content ~* r.pattern) then
      if r.risk = 'block' then
        raise exception 'content_blocked: prohibited content (%)', r.label;
      else
        outcome := 'FLAG';
      end if;
    end if;
  end loop;

  -- Excessive emoji / non-ASCII spam.
  nonascii := char_length(content) - char_length(regexp_replace(content, '[^[:ascii:]]', '', 'g'));
  if nonascii > 20 then outcome := 'FLAG'; end if;

  -- Hidden/suspicious Unicode (zero-width chars, BOM, RTL override). Compared
  -- as UTF-8 byte sequences so the check is encoding-safe and cannot error:
  --   U+200B/C/D = E2 80 8B/8C/8D · U+FEFF = EF BB BF · U+202E = E2 80 AE
  bb := convert_to(content, 'UTF8');
  if position('\xe2808b'::bytea in bb) > 0 or position('\xe2808c'::bytea in bb) > 0
     or position('\xe2808d'::bytea in bb) > 0 or position('\xefbbbf'::bytea in bb) > 0
     or position('\xe280ae'::bytea in bb) > 0 then
    outcome := 'FLAG';
  end if;

  -- Medium risk → create/keep the listing but hidden pending review.
  -- Never override an admin-set moderation state.
  if outcome = 'FLAG' then
    if tg_op = 'INSERT' or new.status in ('active','pending') then
      new.status := 'flagged';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_listing_moderation on public.listings;
create trigger trg_listing_moderation
  before insert or update on public.listings
  for each row execute function public.check_listing_content();

-- ============================================================================
-- 5. USER SANCTIONS
-- ============================================================================
create table if not exists public.user_sanctions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  sanction_type text not null check (sanction_type in ('warning','suspension','permanent_ban')),
  reason        text,
  issued_by     uuid references auth.users(id) on delete set null,
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz,
  active        boolean not null default true
);
create index if not exists user_sanctions_user_idx    on public.user_sanctions (user_id);
create index if not exists user_sanctions_active_idx   on public.user_sanctions (active) where active;
create index if not exists user_sanctions_type_idx    on public.user_sanctions (sanction_type);
create index if not exists user_sanctions_expires_idx on public.user_sanctions (expires_at);

alter table public.user_sanctions enable row level security;
drop policy if exists "user_sanctions: self read" on public.user_sanctions;
create policy "user_sanctions: self read"
  on public.user_sanctions for select
  using (user_id = auth.uid() or public.is_moderator());
drop policy if exists "user_sanctions: moderator write" on public.user_sanctions;
create policy "user_sanctions: moderator write"
  on public.user_sanctions for all
  using (public.is_moderator()) with check (public.is_moderator());

-- Helper predicates (SECURITY DEFINER so triggers/RLS can call them).
create or replace function public.is_user_banned(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_sanctions
    where user_id = uid and sanction_type = 'permanent_ban' and active
      and (expires_at is null or expires_at > now())
  );
$$;
create or replace function public.is_user_suspended(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_sanctions
    where user_id = uid and sanction_type = 'suspension' and active
      and (expires_at is null or expires_at > now())
  );
$$;

commit;

-- ============================================================================
-- VERIFICATION (run separately after the migration; safe to run in a txn you
-- roll back). Replace the UUIDs with a real seller_id / moderator id.
-- ----------------------------------------------------------------------------
-- -- Schema present?
-- select column_name from information_schema.columns
--   where table_name='reports' and column_name in ('severity','priority','message_id','chat_id');
-- select to_regclass('public.moderation_actions'), to_regclass('public.user_sanctions'),
--        to_regclass('public.moderation_rules');
-- select count(*) as rule_count from public.moderation_rules;   -- expect >= 24
--
-- -- Listing states accepted:
-- select unnest(array['pending','active','under_review','flagged','sold','removed','deleted']) as ok_status;
--
-- -- Content filter behaviour (wrap in a transaction and ROLLBACK):
-- begin;
--   -- ALLOW: clean listing stays 'active'
--   insert into public.listings (seller_id,title,description,price,currency,category,status)
--     values ('<seller-uuid>','Dining table','Solid wood 6-seater',120,'USD','furniture','active')
--     returning status;                                            -- expect: active
--   -- FLAG: contact-evasion downgrades to 'flagged' (hidden from public)
--   insert into public.listings (seller_id,title,description,price,currency,category,status)
--     values ('<seller-uuid>','Phone','WhatsApp me on 0771234567',50,'USD','electronics','active')
--     returning status;                                            -- expect: flagged
--   -- BLOCK: prohibited word raises an exception
--   insert into public.listings (seller_id,title,description,price,currency,category,status)
--     values ('<seller-uuid>','Gun for sale','ak47',999,'USD','other','active');
--     -- expect: ERROR content_blocked: prohibited content (Illegal goods)
-- rollback;
--
-- -- Sanction helpers:
-- insert into public.user_sanctions (user_id,sanction_type,reason,issued_by,expires_at)
--   values ('<user-uuid>','suspension','spam','<mod-uuid>', now()+interval '7 days');
-- select public.is_user_suspended('<user-uuid>');                 -- expect: true
-- select public.is_user_banned('<user-uuid>');                    -- expect: false
--
-- -- Moderation queue queries the admin panel will use:
-- select target_type,count(*) from public.reports group by target_type;
-- select target_type,target_id,count(*) most_reported from public.reports
--   group by target_type,target_id order by most_reported desc limit 20;
-- select * from public.reports order by
--   array_position(array['critical','high','medium','low'],severity), priority desc, created_at desc;
-- ============================================================================

-- ============================================================================
-- ROLLBACK (run to undo Phase A). Data in the new tables is lost; reports
-- keeps its new columns' data unless you also drop the columns.
-- ----------------------------------------------------------------------------
-- drop trigger if exists trg_listing_moderation on public.listings;
-- -- restore the original simple filter if desired (see supabase/schema/moderation.sql)
-- drop trigger if exists trg_reports_touch on public.reports;
-- drop function if exists public.check_listing_content();
-- drop function if exists public.touch_reports_updated_at();
-- drop function if exists public.is_user_banned(uuid);
-- drop function if exists public.is_user_suspended(uuid);
-- drop table if exists public.moderation_actions;
-- drop table if exists public.user_sanctions;
-- drop table if exists public.moderation_rules;
-- drop function if exists public.is_moderator();
-- alter table public.listings drop constraint if exists listings_status_check;
-- alter table public.listings add constraint listings_status_check
--   check (status in ('active','sold','deleted','pending'));
-- alter table public.reports drop constraint if exists reports_target_type_check;
-- alter table public.reports drop constraint if exists reports_status_check;
-- alter table public.reports drop constraint if exists reports_severity_check;
-- alter table public.reports drop constraint if exists reports_priority_check;
-- alter table public.reports drop column if exists severity;
-- alter table public.reports drop column if exists priority;
-- alter table public.reports drop column if exists message_id;
-- alter table public.reports drop column if exists chat_id;
-- alter table public.reports drop column if exists updated_at;
-- ============================================================================
