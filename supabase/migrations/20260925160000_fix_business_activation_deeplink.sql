-- Bug found 2026-09-25: tapping a "business approved"/"business rejected"
-- push notification opened the Home screen instead of the business. Root
-- cause: notify_business_activation_decision() (20260919062125) wrote
-- deep_link as the legacy Capacitor page name 'BusinessShop?id=<id>', but
-- the mobile app's legacy-route parser only ever recognized the bare page
-- name 'Business' (no "Shop" suffix), so it failed to parse and fell
-- through to the safe Home fallback. The app already has a purpose-built
-- "businessmanage:<id>" deep-link kind for exactly this decision (it routes
-- to the owner's Seller Center dashboard, which shows the rejection reason
-- + resubmit button for a decline) — this trigger was just never wired to
-- emit it. Switch both branches to that existing convention.
create or replace function public.notify_business_activation_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.status = 'pending_activation' and NEW.status = 'active' then
    insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
    values (
      NEW.owner_user_id::text,
      '🎉 Your business is live!',
      '"' || coalesce(NEW.name, 'Your business') || '" has been approved and is now visible to buyers.',
      'business_activated', 'businessmanage:' || NEW.id, now()
    );
  elsif OLD.status = 'pending_activation' and NEW.status = 'rejected' then
    insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
    values (
      NEW.owner_user_id::text,
      'Update on your business submission',
      '"' || coalesce(NEW.name, 'Your business') || '" was not approved.'
        || case when NEW.rejection_note is not null and NEW.rejection_note <> '' then ' Reason: ' || NEW.rejection_note else '' end
        || ' You can edit and resubmit it.',
      'business_rejected', 'businessmanage:' || NEW.id, now()
    );
  end if;
  return NEW;
end;
$$;
