create or replace function public.run_message_noreply_reminders()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      select c.members into v_members
      from public.conversations c
      where c.id = rec.conversation_id;

      if v_members is null then
        update public.messages set reminder_sent_at = now() where id = rec.id;
        continue;
      end if;

      v_sender_name := coalesce(nullif(rec.sender_name, ''), 'Someone');

      foreach v_recipient in array v_members loop
        if v_recipient::text = rec.sender_id then
          continue;
        end if;

        insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
        values (
          v_recipient::text,
          '💬 Unread message from ' || v_sender_name,
          left(coalesce(nullif(rec.text, ''), 'You have an unread message.'), 120),
          'message_noreply_reminder',
          'chat:' || rec.conversation_id,
          now()
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
$function$;;
