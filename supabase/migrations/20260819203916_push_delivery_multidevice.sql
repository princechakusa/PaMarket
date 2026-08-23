-- Push delivery coverage hardening.
--
-- This migration is intentionally data-preserving: all existing push_tokens
-- rows remain, each receiving a synthetic installation id. The legacy
-- profiles.push_token column is not imported because live verification found
-- three values absent from push_tokens whose freshness cannot be proven.

begin;

alter table public.push_tokens
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists device_id uuid default gen_random_uuid(),
  add column if not exists platform text default 'unknown',
  add column if not exists created_at timestamptz default now();

update public.push_tokens
set id = coalesce(id, gen_random_uuid()),
    device_id = coalesce(device_id, gen_random_uuid()),
    platform = coalesce(platform, 'unknown'),
    created_at = coalesce(created_at, updated_at, now());

alter table public.push_tokens
  alter column id set not null,
  alter column device_id set not null,
  alter column platform set not null,
  alter column created_at set not null;

alter table public.push_tokens drop constraint if exists push_tokens_pkey;
alter table public.push_tokens add constraint push_tokens_pkey primary key (id);
alter table public.push_tokens add constraint push_tokens_token_key unique (token);
alter table public.push_tokens add constraint push_tokens_user_device_key unique (user_id, device_id);
alter table public.push_tokens add constraint push_tokens_platform_check
  check (platform in ('ios', 'android', 'unknown'));

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- A definer RPC lets an authenticated installation atomically replace its
-- prior token, including the account-switch case, without gaining arbitrary
-- access to another user's token rows.
create or replace function public.register_push_token(
  p_token text,
  p_device_id uuid,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_token is null or btrim(p_token) = '' or length(p_token) > 4096 then
    raise exception 'Invalid push token';
  end if;
  if p_device_id is null then raise exception 'Device id required'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Invalid platform'; end if;

  delete from public.push_tokens
  where token = p_token
     or (user_id = v_user_id and device_id = p_device_id);

  insert into public.push_tokens (user_id, token, device_id, platform, created_at, updated_at)
  values (v_user_id, p_token, p_device_id, p_platform, now(), now());
end;
$$;

create or replace function public.unregister_push_token(p_device_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens
  where user_id = auth.uid()
    and device_id = p_device_id;
$$;

create or replace function public.unregister_all_push_tokens()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, uuid, text) from public, anon;
revoke all on function public.unregister_push_token(uuid) from public, anon;
revoke all on function public.unregister_all_push_tokens() from public, anon;
grant execute on function public.register_push_token(text, uuid, text) to authenticated;
grant execute on function public.unregister_push_token(uuid) to authenticated;
grant execute on function public.unregister_all_push_tokens() to authenticated;

-- Keep the legacy boolean for compatibility, but record explicit terminal
-- states so no-token/opt-out/failure can never masquerade as delivered.
alter table public.notifications
  add column if not exists push_status text not null default 'pending';

update public.notifications
set push_status = case
  when push_sent then 'sent'
  when push_error is not null then 'failed'
  else 'pending'
end;

alter table public.notifications
  add constraint notifications_push_status_check
  check (push_status in ('pending', 'sending', 'sent', 'no_token', 'opted_out', 'failed'));

create or replace function public.dispatch_pending_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_service_key text;
begin
  if coalesce(new.push_sent, false) = false and new.push_status = 'pending' then
    begin
      select decrypted_secret into v_secret
        from vault.decrypted_secrets where name = 'automation_secret';
      select decrypted_secret into v_service_key
        from vault.decrypted_secrets where name = 'pamarket_automation_anon_key';

      perform net.http_post(
        url := 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/dispatch-notification-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(v_service_key, ''),
          'x-automation-secret', coalesce(v_secret, '')
        ),
        body := jsonb_build_object('notificationId', new.id)
      );
    exception when others then
      update public.notifications
      set push_status = 'failed', push_error = left(sqlerrm, 500)
      where id = new.id;
      raise warning 'dispatch_pending_notification_push failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

commit;
;
