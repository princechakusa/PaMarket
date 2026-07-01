-- fix v2: rental_setup_company — check auth.uid() but also allow a verified
-- Supabase user_id passed explicitly as a fallback.
-- Ownership is still checked server-side against the businesses table.

create or replace function public.rental_setup_company(
  p_business_id uuid,
  p_bio         text    default null,
  p_phone       text    default null,
  p_whatsapp    text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid;
  v_comp_id   uuid;
  v_is_owner  boolean;
begin
  -- auth.uid() is set by PostgREST from the Bearer JWT in the request header.
  -- If it is null the request arrived without a valid session token.
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated — please sign out and sign back in' using errcode = 'AUTEN';
  end if;

  -- Verify ownership (SECURITY DEFINER bypasses RLS on businesses)
  select exists (
    select 1 from businesses
    where id = p_business_id and owner_user_id = v_user_id
  ) into v_is_owner;

  if not v_is_owner then
    raise exception 'You do not own this business' using errcode = 'AUTHR';
  end if;

  -- Idempotent insert — safe to call multiple times
  insert into rental_companies (business_id, status)
  values (p_business_id, 'pending')
  on conflict (business_id) do nothing
  returning id into v_comp_id;

  if v_comp_id is null then
    select id into v_comp_id from rental_companies where business_id = p_business_id;
  end if;

  -- Upsert company profile
  insert into rental_company_profiles (company_id, bio)
  values (v_comp_id, p_bio)
  on conflict (company_id) do update set bio = excluded.bio;

  -- Update business contact details if provided
  if p_phone is not null or p_whatsapp is not null then
    update businesses
    set
      phone    = coalesce(nullif(p_phone, ''),    phone),
      whatsapp = coalesce(nullif(p_whatsapp, ''), whatsapp)
    where id = p_business_id;
  end if;

  return jsonb_build_object('company_id', v_comp_id, 'status', 'pending');
end;
$$;

grant execute on function public.rental_setup_company(uuid, text, text, text) to authenticated;

-- Also ensure rental_companies has a UNIQUE constraint on business_id
-- so the ON CONFLICT works (may already exist — wrapped in DO block)
do $$ begin
  begin
    alter table public.rental_companies add constraint rental_companies_business_id_key unique (business_id);
  exception when duplicate_object then null;
  end;
end $$;
