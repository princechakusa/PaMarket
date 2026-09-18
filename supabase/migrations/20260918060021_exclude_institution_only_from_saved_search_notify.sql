-- Real bug found while auditing whether institution listings get the same
-- notifications as regular ones: notify_saved_search_match() (originally
-- from marketplace_notifications_phase1.sql) never checked
-- attributes->>'institution_visibility', so an "Institution Only" listing
-- (meant to stay inside that institution's own hub) still triggered a
-- push notification to any arbitrary PaMarket user elsewhere with a
-- matching saved search -- leaking its existence outside the institution,
-- defeating the entire point of that visibility choice.
create or replace function public.notify_saved_search_match()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  -- There's no "this user belongs to this institution" concept for
  -- ordinary buyers, so the only correct fix is excluding institution_only
  -- listings from this notification entirely. A public/default listing
  -- (attributes key absent, or set to "public") is unaffected and keeps
  -- notifying exactly as before.
  if NEW.attributes->>'institution_visibility' = 'institution_only' then
    return NEW;
  end if;

  for rec in
    select ss.user_id, ss.name
    from public.saved_searches ss
    where ss.user_id <> NEW.seller_id
      and (ss.category is null or ss.category = '' or ss.category = NEW.category)
      and (ss.query is null or ss.query = ''
           or NEW.title ilike '%' || ss.query || '%'
           or NEW.description ilike '%' || ss.query || '%')
    limit 200
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.user_id::text,
        '🔎 New ' || NEW.category || ' match for you!',
        '"' || NEW.title || '" just listed for ' || NEW.currency || ' ' || NEW.price || ' in ' || NEW.city
          || ' — matches your saved search "' || coalesce(nullif(rec.name,''), 'Saved search') || '". Tap to view before it''s gone.',
        'saved_search_match', 'Detail?id=' || NEW.id, now()
      );
    exception when others then
      raise warning 'notify_saved_search_match: insert failed for listing % / user %: %', NEW.id, rec.user_id, sqlerrm;
    end;
  end loop;

  return NEW;
end;
$$;
