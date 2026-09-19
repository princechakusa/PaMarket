-- Real gap found 2026-09-19: approving/declining a pending_activation
-- business in the admin panel updated the row but never told the owner --
-- no notification of any kind existed for this decision, even though
-- every comparable admin decision elsewhere in the app (verification
-- approval, job application decisions, etc.) notifies the affected user.
create or replace function public.notify_business_activation_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.status = 'pending_activation' and NEW.status = 'active' then
    insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
    values (
      NEW.owner_user_id::text,
      '🎉 Your business is live!',
      '"' || coalesce(NEW.name, 'Your business') || '" has been approved and is now visible to buyers.',
      'business_activated', 'BusinessShop?id=' || NEW.id, now()
    );
  elsif OLD.status = 'pending_activation' and NEW.status = 'rejected' then
    insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
    values (
      NEW.owner_user_id::text,
      'Update on your business submission',
      '"' || coalesce(NEW.name, 'Your business') || '" was not approved.'
        || case when NEW.rejection_note is not null and NEW.rejection_note <> '' then ' Reason: ' || NEW.rejection_note else '' end
        || ' You can edit and resubmit it.',
      'business_rejected', 'BusinessShop?id=' || NEW.id, now()
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_business_activation_decision on public.businesses;
create trigger trg_notify_business_activation_decision
  after update of status on public.businesses
  for each row
  when (NEW.status is distinct from OLD.status)
  execute function public.notify_business_activation_decision();
