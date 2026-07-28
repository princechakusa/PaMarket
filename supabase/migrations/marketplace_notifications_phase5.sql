-- ============================================================================
-- PaMarket — Marketplace notifications, phase 5
-- ----------------------------------------------------------------------------
-- Continues marketplace_notifications_phase1-4.sql. Adds:
--
--   1. Unread message reminder — a buyer/seller sends a chat message and the
--      other side never opens it. Poll-driven (automation-runner), reminds
--      the recipient once, 4 hours after the message was sent, only if it's
--      still unread AND still the newest message in the conversation (a
--      reply, from either side, cancels the reminder).
--
--   2. Rental lead / booking-request alert — rental_vehicle_leads had no
--      push notification to the fleet owner on new inserts; owners only saw
--      new inquiries by opening app/rental-fleet/leads.tsx themselves. This
--      adds the missing push, same event-driven pattern as phase 1's listing
--      status change notification.
--
-- Idempotent. Run once in the Supabase SQL Editor, after phases 1-4.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Unread message reminder
-- ============================================================================
alter table public.messages
  add column if not exists reminder_sent_at timestamptz;

create index if not exists messages_unread_reminder_idx
  on public.messages (conversation_id, created_at desc)
  where read = false and reminder_sent_at is null;

create or replace function public.run_message_noreply_reminders()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_recipient uuid;
  v_members uuid[];
  v_sender_name text;
  v_count integer := 0;
begin
  for rec in
    select m.id, m.conversation_id, m.sender_id, m.sender_name, m.text
    from public.messages m
    where m.read = false
      and m.reminder_sent_at is null
      and m.created_at <= now() - interval '4 hours'
      and m.created_at >= now() - interval '14 days'
      and not exists (
        select 1 from public.messages newer
        where newer.conversation_id = m.conversation_id
          and newer.created_at > m.created_at
      )
    limit 300
  loop
    begin
      select c.members into v_members from public.conversations c where c.id = rec.conversation_id;
      if v_members is null then
        update public.messages set reminder_sent_at = now() where id = rec.id;
        continue;
      end if;

      v_sender_name := coalesce(nullif(rec.sender_name, ''), 'Someone');

      foreach v_recipient in array v_members loop
        if v_recipient = rec.sender_id then
          continue;
        end if;
        insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
        values (
          v_recipient::text,
          '💬 Unread message from ' || v_sender_name,
          left(coalesce(nullif(rec.text, ''), 'You have an unread message.'), 120),
          'message_noreply_reminder', 'chat:' || rec.conversation_id, now()
        );
      end loop;

      update public.messages set reminder_sent_at = now() where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_message_noreply_reminders: failed for message %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('reminded', v_count);
end;
$$;

revoke all on function public.run_message_noreply_reminders() from public, anon, authenticated;
grant execute on function public.run_message_noreply_reminders() to service_role;

-- ============================================================================
-- 2. Rental lead / booking-request alert → notify the fleet owner
-- ============================================================================
create or replace function public.notify_rental_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner_id uuid;
  v_vehicle text;
  v_source_label text;
begin
  select b.owner_user_id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = NEW.company_id;

  if v_owner_id is null then
    return NEW;
  end if;

  select coalesce(nullif(rb.label, '') || ' ', '') || rvl.model into v_vehicle
  from public.rental_vehicle_listings rvl
  left join public.rental_brands rb on rb.id = rvl.brand_id
  where rvl.id = NEW.listing_id;

  v_source_label := case NEW.lead_source
    when 'booking_request' then 'requested to book'
    when 'whatsapp_click' then 'messaged you on WhatsApp about'
    when 'call_click' then 'called about'
    else 'is interested in'
  end;

  begin
    insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
    values (
      v_owner_id::text,
      case when NEW.lead_source = 'booking_request' then '🚗 New booking request' else '🚗 New rental inquiry' end,
      'A customer ' || v_source_label || ' ' || coalesce(nullif(v_vehicle, ''), 'your vehicle')
        || case when NEW.requested_start_date is not null and NEW.requested_end_date is not null
             then ' (' || NEW.requested_start_date || ' → ' || NEW.requested_end_date || ')'
             else ''
           end || '.',
      'rental_lead', 'RentalLeads?bizId=' || (select business_id::text from public.rental_companies where id = NEW.company_id), now()
    );
  exception when others then
    raise warning 'notify_rental_lead: insert failed for lead %: %', NEW.id, sqlerrm;
  end;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_rental_lead on public.rental_vehicle_leads;
create trigger trg_notify_rental_lead
  after insert on public.rental_vehicle_leads
  for each row execute function public.notify_rental_lead();

commit;

-- ============================================================================
-- Companion edit needed: add these two lines to the RPC-call block in
-- supabase/functions/automation-runner/index.ts (already done in this repo
-- alongside this migration):
--   const noreplyReminders = await db.rpc('run_message_noreply_reminders')
--   summary.messages_noreply_reminded = Number(noreplyReminders.data?.reminded || 0)
--
-- Verification (run manually):
--   select run_message_noreply_reminders();
--   select target, title, body from scheduled_notifications where type = 'message_noreply_reminder' order by created_at desc limit 5;
--   insert into rental_vehicle_leads (listing_id, company_id, user_id, lead_source, status)
--     values ('<listing-uuid>', '<company-uuid>', '<user-uuid>', 'booking_request', 'new');
--   select target, title, body from scheduled_notifications where type = 'rental_lead' order by created_at desc limit 1;
-- ============================================================================
