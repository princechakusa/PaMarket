-- Add only records absent from the existing Privacy Data Export. No seed data.
begin;
do $$ declare t text; begin
  if to_regprocedure('public.is_super_admin()') is null or to_regprocedure('public.has_mfa_aal2()') is null then
    raise exception 'Privacy export requires the existing Super Admin and AAL2 helpers';
  end if;
  foreach t in array array[
    'profiles','listings','businesses','applications','reviews','business_reviews',
    'notification_preferences','account_deletion_requests','deletion_logs',
    'messages','verifications','company_verifications','notifications',
    'push_tokens','support_tickets','support_ticket_messages','contact_requests',
    'reports','rental_vehicle_leads','user_saves','saved_searches','viewed_listings',
    'viewed_businesses','business_staff','business_leads','shop_orders',
    'play_purchases','paynow_payments','rental_favorites','moderation_appeals',
    'rental_reports','rental_reviews'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Privacy export source table public.% is missing', t;
    end if;
  end loop;
end $$;
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
  request_type text not null check (request_type in ('access','correction','deletion','portability','objection','restriction','other')),
  status text not null default 'received' check (status in ('received','verifying','in_progress','completed','rejected','withdrawn')),
  received_at timestamptz not null default now(), due_at timestamptz, completed_at timestamptz,
  requester_email text, source_reference text, identity_verified_at timestamptz,
  assigned_to uuid, decision text, evidence_references text[], created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.privacy_requests(user_id, received_at desc);
create table public.privacy_incidents (
  id uuid primary key default gen_random_uuid(), title text not null,
  status text not null default 'investigating' check (status in ('investigating','contained','resolved','closed','not_a_breach')),
  severity text, detected_at timestamptz not null, occurred_at timestamptz,
  affected_data text[], affected_user_count integer check (affected_user_count >= 0),
  affected_user_ids uuid[], description text, investigation text, root_cause text,
  containment text, remediation text, regulator_notified_at timestamptz,
  subjects_notified_at timestamptz, notification_reason text, resolved_at timestamptz,
  owner_id uuid, evidence_references text[], created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.privacy_consents (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
  purpose text not null, policy_version text, granted_at timestamptz not null default now(),
  withdrawn_at timestamptz, source text not null, evidence_reference text,
  recorded_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (withdrawn_at is null or withdrawn_at >= granted_at)
);
create index on public.privacy_consents(user_id, granted_at desc);
create function public.privacy_consent_preserve_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'withdrawn_at' - 'updated_at') is distinct from (to_jsonb(old) - 'withdrawn_at' - 'updated_at')
     or old.withdrawn_at is not null then
    raise exception 'consent history is immutable; only an initial withdrawal timestamp may be set';
  end if;
  return new;
end $$;
create trigger privacy_consent_preserve_history before update on public.privacy_consents
for each row execute function public.privacy_consent_preserve_history();
create table public.privacy_processors (
  id uuid primary key default gen_random_uuid(), provider text not null unique,
  service text, data_categories text[], processing_purpose text,
  location text, subprocessors text[], agreement_reference text,
  retention_terms text, compliance_status text not null default 'unreviewed',
  reviewed_at timestamptz, owner_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.privacy_retention_schedule (
  id uuid primary key default gen_random_uuid(), data_category text not null,
  source_tables text[] not null, retention_period text,
  trigger_event text, deletion_method text, legal_basis text,
  exceptions text, compliance_status text not null default 'unreviewed',
  reviewed_at timestamptz, owner_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Immutable history for every DPO register mutation, including the caller's
-- authenticated identity. No client role can insert/update/delete audit rows.
create table public.privacy_register_audit (
  id bigint generated always as identity primary key,
  register_name text not null, record_id uuid not null, action text not null,
  actor_id uuid, occurred_at timestamptz not null default now(),
  before_state jsonb, after_state jsonb
);
alter table public.privacy_register_audit enable row level security;
revoke all on public.privacy_register_audit from public, anon, authenticated;
create policy privacy_audit_dpo_read on public.privacy_register_audit for select to authenticated
  using (public.is_super_admin() and public.has_mfa_aal2());
grant select on public.privacy_register_audit to authenticated;
create table public.privacy_export_audit (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null,
  actor_id uuid not null, occurred_at timestamptz not null default now()
);
alter table public.privacy_export_audit enable row level security;
revoke all on public.privacy_export_audit from public, anon, authenticated;
create policy privacy_export_audit_dpo_read on public.privacy_export_audit for select to authenticated
  using (public.is_super_admin() and public.has_mfa_aal2());
grant select on public.privacy_export_audit to authenticated;

create function public.privacy_register_write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  insert into public.privacy_register_audit(register_name, record_id, action, actor_id, before_state, after_state)
  values (tg_table_name, new.id, tg_op, auth.uid(),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end $$;
revoke all on function public.privacy_register_write_audit() from public;

-- Browser access to compliance registers requires both super_admin and AAL2.
-- The pre-existing deletion and security-event policies remain unchanged.
do $$ declare t text; begin
  foreach t in array array['privacy_requests','privacy_incidents','privacy_consents','privacy_processors','privacy_retention_schedule'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('create policy privacy_dpo_select on public.%I for select to authenticated using (public.is_super_admin() and public.has_mfa_aal2())', t);
    execute format('create policy privacy_dpo_insert on public.%I for insert to authenticated with check (public.is_super_admin() and public.has_mfa_aal2())', t);
    execute format('create policy privacy_dpo_update on public.%I for update to authenticated using (public.is_super_admin() and public.has_mfa_aal2()) with check (public.is_super_admin() and public.has_mfa_aal2())', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create trigger privacy_register_write_audit before insert or update on public.%I for each row execute function public.privacy_register_write_audit()', t);
  end loop;
end $$;

-- A single, gated per-user read gives the DPO records otherwise hidden by
-- owner-only RLS. Fixed relation/column allowlist; never exports auth secrets.
create or replace function public.privacy_export_subject(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb := '{}'::jsonb; entry record; rows jsonb;
begin
  if not public.is_super_admin() or not public.has_mfa_aal2() then
    raise exception 'super_admin with AAL2 required' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'user id required'; end if;
  insert into public.privacy_export_audit(subject_id, actor_id) values (p_user_id, auth.uid());
  for entry in select * from (values
    ('listings','seller_id',array['id','seller_id','title','description','seller_name','seller_phone','status','created_at','updated_at','latitude','longitude']),
    ('businesses','owner_user_id',array['id','owner_user_id','name','phone','email','status','created_at','latitude','longitude']),
    ('applications','applicant_id',array['id','applicant_id','job_id','job_title','applicant_name','applicant_phone','applicant_email','message','status','applied_at']),
    ('reviews','reviewer_id',array['id','reviewer_id','seller_id','rating','body','created_at']),
    ('business_reviews','reviewer_id',array['id','reviewer_id','business_id','rating','comment','created_at']),
    ('notification_preferences','user_id',array['user_id','messages','listing_updates','approvals','promotions','favourites','price_drops','recommendations','verification_reminders','updated_at']),
    ('account_deletion_requests','user_id',array['id','user_id','email','reason','status','created_at','updated_at']),
    ('deletion_logs','user_id',array['id','user_id','request_id','deleted_tables','auth_user_deleted','created_at']),
    ('privacy_requests','user_id',array['id','user_id','request_type','status','received_at','due_at','completed_at','decision','created_at']),
    ('privacy_consents','user_id',array['id','user_id','purpose','policy_version','granted_at','withdrawn_at','source','created_at']),
    ('messages','sender_id',array['id','conversation_id','sender_id','sender_name','text','read','edited','deleted','created_at']),
    ('verifications','user_id',array['id','user_id','status','submitted_at','reviewed_at']),
    ('company_verifications','user_id',array['user_id','company_name','status','submitted_at','reviewed_at']),
    ('notifications','user_id',array['id','user_id','title','body','type','category','read','created_at']),
    ('push_tokens','user_id',array['user_id','updated_at']),
    ('support_tickets','requester_id',array['id','requester_id','subject','status','category','created_at','updated_at','resolved_at']),
    ('support_ticket_messages','author_id',array['id','ticket_id','author_id','body','created_at']),
    ('contact_requests','requester_id',array['id','requester_id','status','created_at','decided_at']),
    ('reports','reporter_id',array['id','reporter_id','target_type','target_id','reason','status','created_at']),
    ('rental_vehicle_leads','user_id',array['id','user_id','listing_id','status','created_at','contacted_at']),
    ('user_saves','user_id',array['id','user_id','listing_id','created_at']),
    ('saved_searches','user_id',array['id','user_id','query','filters','created_at']),
    ('viewed_listings','user_id',array['user_id','listing_id','category','view_count','viewed_at']),
    ('viewed_businesses','user_id',array['user_id','business_id','view_count','viewed_at']),
    ('business_staff','user_id',array['id','user_id','business_id','role','status']),
    ('business_leads','user_id',array['id','user_id','business_id','listing_id','type','status','created_at']),
    ('shop_orders','customer_id',array['id','customer_id','business_id','status','delivery_address','customer_name','customer_phone','customer_note','total','currency','created_at','updated_at']),
    ('play_purchases','user_id',array['id','user_id','listing_id','product_id','status','purchase_time','expiry_time','created_at']),
    ('paynow_payments','user_id',array['id','user_id','listing_id','product_id','amount_usd','status','paid_at','created_at']),
    ('rental_favorites','user_id',array['id','user_id','listing_id','created_at']),
    ('moderation_appeals','requester_id',array['id','requester_id','entity','entity_id','reason','status','created_at','decided_at']),
    ('rental_reports','reporter_id',array['id','reporter_id','listing_id','reason','detail','status','created_at']),
    ('rental_reviews','reviewer_id',array['id','reviewer_id','company_id','rating','title','body','status','created_at'])
  ) as x(tbl,col,allowed) loop
    execute format('select coalesce(jsonb_agg(filtered.obj), ''[]''::jsonb) from (select * from public.%I where %I::text = $1::text limit 5001) t cross join lateral (select jsonb_object_agg(k,v) as obj from jsonb_each(to_jsonb(t)) as f(k,v) where k = any($2)) filtered', entry.tbl, entry.col)
      into rows using p_user_id, entry.allowed;
    if jsonb_array_length(rows) > 5000 then
      raise exception 'SAR exceeds 5000 records in %, arrange a paged audited export', entry.tbl;
    end if;
    result := result || jsonb_build_object(entry.tbl, rows);
  end loop;
  select coalesce(jsonb_agg(filtered.obj), '[]'::jsonb)
    into rows from public.profiles p cross join lateral (
      select jsonb_object_agg(k, v) as obj from jsonb_each(to_jsonb(p)) as f(k,v)
      where k = any(array['id','name','email','phone','whatsapp_number','phone_for_calls',
      'role','status','verified','city','province','company','bio','avatar',
      'linkedin_url','github_url','website_url','cv_file_url','cv_file_path',
      'job_title','skills','sector','exp','admin_notes','privacy',
      'marketing_email_opt_out','created_at','last_seen','last_active_at',
      'mfa_enabled'])
    ) filtered where p.id = p_user_id;
  result := result || jsonb_build_object('profiles', rows);
  return result;
end $$;
revoke all on function public.privacy_export_subject(uuid) from public;
revoke all on function public.privacy_export_subject(uuid) from anon;
grant execute on function public.privacy_export_subject(uuid) to authenticated;
commit;
