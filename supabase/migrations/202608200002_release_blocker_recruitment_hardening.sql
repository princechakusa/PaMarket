-- PaMarket release-blocker hardening: recruitment, rental context, and
-- business-category authority. Additive/idempotent; no matching architecture.

-- ---------------------------------------------------------------------------
-- Applications: the database derives identity and job ownership.
-- ---------------------------------------------------------------------------
create or replace function public.authorize_job_application_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.listings%rowtype;
begin
  if tg_op = 'INSERT' then
    if v_uid is null then
      raise exception 'Authentication required.' using errcode = '42501';
    end if;
    if new.applicant_id is distinct from v_uid then
      raise exception 'Applicant identity must match the authenticated user.' using errcode = '42501';
    end if;

    select * into v_job from public.listings where id = new.job_id;
    if not found or v_job.category <> 'jobs' then
      raise exception 'Job not found.' using errcode = '23503';
    end if;
    if v_job.status <> 'active'
       or (v_job.expires_at is not null and v_job.expires_at <= now()) then
      raise exception 'This job is not accepting applications.' using errcode = 'check_violation';
    end if;
    if v_job.seller_id = v_uid then
      raise exception 'You cannot apply to your own job.' using errcode = 'check_violation';
    end if;

    -- Client-supplied relationship and display fields are never authoritative.
    new.employer_id := v_job.seller_id;
    new.job_title := v_job.title;
    new.company := coalesce(nullif(btrim(v_job.seller_name), ''), 'Company');
    new.status := 'pending';
    new.applied_at := now();
    return new;
  end if;

  if new.applicant_id is distinct from old.applicant_id
     or new.job_id is distinct from old.job_id
     or new.employer_id is distinct from old.employer_id then
    raise exception 'Application relationship fields are immutable.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Preserve legitimate historical applications while repairing only their
-- denormalized owner/display fields from the authoritative job row. Abort for
-- any historical row that is not actually attached to a Jobs listing so it
-- can be reviewed rather than deleted or guessed at.
do $$
declare
  v_wrong_owner bigint;
  v_non_job bigint;
begin
  select count(*) into v_non_job
  from public.applications a
  join public.listings j on j.id = a.job_id
  where j.category <> 'jobs';
  if v_non_job > 0 then
    raise exception 'Migration blocked: % application rows reference non-job listings.', v_non_job;
  end if;

  select count(*) into v_wrong_owner
  from public.applications a
  join public.listings j on j.id = a.job_id
  where a.employer_id is distinct from j.seller_id;
  raise notice 'Applications requiring employer reconciliation: %', v_wrong_owner;

  update public.applications a
  set employer_id = j.seller_id,
      job_title = j.title,
      company = coalesce(nullif(btrim(j.seller_name), ''), 'Company')
  from public.listings j
  where j.id = a.job_id
    and a.employer_id is distinct from j.seller_id;
end $$;

drop trigger if exists trg_authorize_job_application_write on public.applications;
drop trigger if exists trg_00_authorize_job_application_write on public.applications;
-- PostgreSQL orders same-event triggers by name. This must precede the
-- existing rate-limit trigger so it always sees the authenticated applicant.
create trigger trg_00_authorize_job_application_write
  before insert or update on public.applications
  for each row execute function public.authorize_job_application_write();

drop policy if exists "applications: insert" on public.applications;
create policy "applications: insert"
  on public.applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and exists (
      select 1 from public.listings j
      where j.id = job_id
        and j.category = 'jobs'
        and j.status = 'active'
        and (j.expires_at is null or j.expires_at > now())
        and j.seller_id = employer_id
        and j.seller_id <> auth.uid()
    )
  );

drop policy if exists "applications: read" on public.applications;
create policy "applications: read"
  on public.applications for select to authenticated
  using (
    applicant_id = auth.uid()
    or exists (
      select 1 from public.listings j
      where j.id = job_id and j.seller_id = auth.uid()
    )
    or public.is_moderator()
  );

drop policy if exists "applications: employer update" on public.applications;
create policy "applications: employer update"
  on public.applications for update to authenticated
  using (
    exists (select 1 from public.listings j where j.id = job_id and j.seller_id = auth.uid())
  )
  with check (
    exists (select 1 from public.listings j where j.id = job_id and j.seller_id = auth.uid())
    and status in ('pending', 'shortlisted', 'declined')
  );

-- PostgREST may update only the employer-controlled workflow field.
revoke update on public.applications from authenticated;
grant update (status) on public.applications to authenticated;

-- One canonical in-app row also drives one push. The application webhook can
-- continue sending email independently.
create unique index if not exists notifications_job_application_received_unique
  on public.notifications ((meta->>'application_id'))
  where type = 'job_application_received';

create or replace function public.notify_job_application_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_employer uuid;
begin
  select seller_id into v_employer from public.listings where id = new.job_id;
  if v_employer is null then
    raise warning 'notify_job_application_events: missing job % for application %', new.job_id, new.id;
    return new;
  end if;

  if tg_op = 'INSERT' then
    begin
      insert into public.notifications (id, user_id, title, body, type, category, meta)
      values (
        gen_random_uuid()::text,
        v_employer::text,
        'New job application',
        coalesce(nullif(new.applicant_name, ''), 'A candidate') || ' applied for "' || new.job_title || '".',
        'job_application_received',
        'jobs',
        jsonb_build_object(
          'application_id', new.id,
          'job_id', new.job_id,
          'deepLink', 'JobApplications?jobId=' || new.job_id
        )
      ) on conflict do nothing;
    exception when others then
      raise warning 'notify_job_application_events: insert notification failed for %: %', new.id, sqlerrm;
    end;
    return new;
  end if;

  if old.status is distinct from new.status and new.status in ('shortlisted', 'declined') then
    begin
      insert into public.notifications (id, user_id, title, body, type, category, meta)
      values (
        gen_random_uuid()::text,
        new.applicant_id::text,
        case when new.status = 'shortlisted' then 'You have been shortlisted!' else 'Application update' end,
        case when new.status = 'shortlisted'
          then coalesce(nullif(new.company, ''), 'The employer') || ' shortlisted you for "' || new.job_title || '".'
          else coalesce(nullif(new.company, ''), 'The employer') || ' decided not to move forward with your application for "' || new.job_title || '".'
        end,
        case when new.status = 'shortlisted' then 'job_shortlisted' else 'job_declined' end,
        'jobs',
        jsonb_build_object('application_id', new.id, 'job_id', new.job_id, 'status', new.status, 'deepLink', 'AppliedJobs')
      );
    exception when others then
      raise warning 'notify_job_application_events: status notification failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recruitment-safe candidate projection. Never returns email, phone, role,
-- account metadata, cv_file_path, or file/link keys embedded in profiles.cv.
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_public_cv(p_cv jsonb)
returns jsonb language sql immutable set search_path = public
as $$
  select coalesce(p_cv, '{}'::jsonb)
    - 'cvFilePath' - 'cv_file_path' - 'cvFileUrl' - 'cv_file_url'
    - 'filePath' - 'fileUrl' - 'storagePath';
$$;

create or replace function public.is_authorized_recruiter()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (coalesce(p.company_verified, false) or p.role in ('admin', 'moderator'))
  );
$$;

create or replace function public.browse_recruitment_candidates(
  p_query text default null,
  p_sector text default null,
  p_experience text default null,
  p_city text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table (
  id uuid, name text, avatar text, verified boolean, job_title text,
  skills text, sector text, exp text, province text, city text,
  open_to_work boolean, cv jsonb, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_authorized_recruiter() then
    raise exception 'Verified employer access required.' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, p.avatar, p.verified, p.job_title, p.skills,
           p.sector, p.exp, p.province, p.city, p.open_to_work,
           public.recruitment_public_cv(p.cv), p.updated_at
    from public.profiles p
    where p.status = 'active'
      and p.open_to_work is true
      and (nullif(btrim(p_query), '') is null or
        p.name ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.job_title ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.sector ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.skills ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.city ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
      and (nullif(p_sector, '') is null or p.sector = p_sector)
      and (nullif(p_experience, '') is null or p.exp = p_experience)
      and (nullif(p_city, '') is null or p.city = p_city)
    order by p.updated_at desc nulls last, p.id
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_recruitment_candidate(p_candidate_id uuid)
returns table (
  id uuid, name text, avatar text, verified boolean, job_title text,
  skills text, sector text, exp text, province text, city text,
  open_to_work boolean, cv jsonb, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if auth.uid() <> p_candidate_id
     and not public.is_authorized_recruiter()
     and not exists (
       select 1 from public.applications a
       join public.listings j on j.id = a.job_id
       where a.applicant_id = p_candidate_id and j.seller_id = auth.uid()
     ) then
    raise exception 'Candidate profile access denied.' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, p.avatar, p.verified, p.job_title, p.skills,
           p.sector, p.exp, p.province, p.city, p.open_to_work,
           public.recruitment_public_cv(p.cv), p.updated_at
    from public.profiles p
    where p.id = p_candidate_id
      and p.status = 'active'
      and (p.id = auth.uid() or p.open_to_work is true or exists (
        select 1 from public.applications a
        join public.listings j on j.id = a.job_id
        where a.applicant_id = p.id and j.seller_id = auth.uid()
      ));
end;
$$;

revoke all on function public.browse_recruitment_candidates(text,text,text,text,integer,integer) from public, anon;
revoke all on function public.get_recruitment_candidate(uuid) from public, anon;
grant execute on function public.browse_recruitment_candidates(text,text,text,text,integer,integer) to authenticated;
grant execute on function public.get_recruitment_candidate(uuid) to authenticated;

-- Safe literal job search and server-side job-type filtering before paging.
create or replace function public.search_active_jobs(
  p_query text default null,
  p_job_type text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns setof public.listings
language sql stable security invoker set search_path = public
as $$
  select l.* from public.listings l
  where l.category = 'jobs'
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and (nullif(btrim(p_query), '') is null or
      l.title ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
      l.description ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
    and (nullif(p_job_type, '') is null or
      l.description ilike '%JOB TYPE: ' || replace(replace(replace(p_job_type, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
  order by l.created_at desc, l.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.search_active_jobs(text,text,integer,integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rental lead status and listing/company integrity.
-- ---------------------------------------------------------------------------
create or replace function public.rental_capture_lead(
  p_listing_id uuid,
  p_lead_source text,
  p_conversation_id text default null,
  p_requested_start_date date default null,
  p_requested_end_date date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_lead_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_lead_source not in ('chat','whatsapp_click','call_click','favorite','share','view_detail','booking_request') then
    raise exception 'Invalid rental lead source.';
  end if;
  if p_requested_start_date is not null and p_requested_end_date is not null
     and p_requested_end_date < p_requested_start_date then
    raise exception 'Invalid requested rental dates.';
  end if;
  select company_id into v_company_id from public.rental_vehicle_listings where id = p_listing_id;
  if v_company_id is null then raise exception 'Listing not found.'; end if;

  insert into public.rental_vehicle_leads
    (listing_id, company_id, user_id, lead_source, status, conversation_id, requested_start_date, requested_end_date)
  values
    (p_listing_id, v_company_id, v_user_id, p_lead_source, 'new', p_conversation_id, p_requested_start_date, p_requested_end_date)
  on conflict (listing_id, user_id) do update set
    lead_source = excluded.lead_source,
    conversation_id = coalesce(excluded.conversation_id, rental_vehicle_leads.conversation_id),
    requested_start_date = coalesce(excluded.requested_start_date, rental_vehicle_leads.requested_start_date),
    requested_end_date = coalesce(excluded.requested_end_date, rental_vehicle_leads.requested_end_date),
    updated_at = now()
  returning id into v_lead_id;
  return v_lead_id;
end;
$$;

create or replace function public.get_or_create_rental_conversation(
  p_listing_id uuid,
  p_company_id uuid,
  p_user_id uuid
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_conv_id text;
  v_company_uid uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;

  select b.owner_user_id into v_company_uid
  from public.rental_vehicle_listings l
  join public.rental_companies rc on rc.id = l.company_id
  join public.businesses b on b.id = rc.business_id
  where l.id = p_listing_id and l.company_id = p_company_id
  limit 1;
  if v_company_uid is null then
    raise exception 'Listing does not belong to the supplied rental company.' using errcode = '42501';
  end if;
  if v_user_id = v_company_uid then raise exception 'Cannot open a conversation with your own company.'; end if;

  select conversation_id into v_conv_id
  from public.rental_conversation_context
  where user_id = v_user_id and listing_id = p_listing_id;
  if v_conv_id is not null then return v_conv_id; end if;

  v_conv_id := 'rental_' || least(v_user_id::text, v_company_uid::text)
    || '_' || greatest(v_user_id::text, v_company_uid::text)
    || '_' || replace(p_listing_id::text, '-', '');
  insert into public.rental_conversation_context (conversation_id, listing_id, company_id, user_id)
  values (v_conv_id, p_listing_id, p_company_id, v_user_id)
  on conflict (user_id, listing_id) do update set conversation_id = excluded.conversation_id
  where rental_conversation_context.company_id = excluded.company_id;
  return v_conv_id;
end;
$$;

revoke all on function public.rental_capture_lead(uuid,text,text,date,date) from public, anon;
grant execute on function public.rental_capture_lead(uuid,text,text,date,date) to authenticated;
revoke all on function public.get_or_create_rental_conversation(uuid,uuid,uuid) from public, anon;
grant execute on function public.get_or_create_rental_conversation(uuid,uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Business category authority. Any combination is valid; unknown/empty IDs
-- are not. Current production preflight: zero invalid rows and zero non-draft
-- rows without a category.
-- ---------------------------------------------------------------------------
create or replace function public.valid_business_category_string(p_categories text)
returns boolean language sql immutable set search_path = public as $$
  select p_categories is not null
    and btrim(p_categories) <> ''
    and not exists (
      select 1 from unnest(string_to_array(p_categories, '|')) as c(id)
      where btrim(c.id) = '' or btrim(c.id) <> all(array[
        'property','vehicles','rooms','electronics','jobs','furniture',
        'fashion','services','agriculture','pets','kids','other'
      ])
    );
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and conname = 'businesses_valid_categories'
  ) then
    alter table public.businesses add constraint businesses_valid_categories
      check (
        (status = 'draft' and category is null)
        or public.valid_business_category_string(category)
      ) not valid;
  end if;
end $$;
alter table public.businesses validate constraint businesses_valid_categories;

notify pgrst, 'reload schema';
