-- ============================================================
-- fix_rental_audit_triggers.sql
--
-- BUG: rental_hardening.sql created audit trigger functions that
-- insert into rental_audit_logs (actor_id, action, target_table,
-- target_id, meta) — but the table has before_state/after_state
-- columns, not meta. Every admin status change on rental_companies
-- or rental_vehicle_listings therefore failed with:
--   column "meta" of relation "rental_audit_logs" does not exist
-- blocking ALL approvals from admin.html.
--
-- FIX: recreate both trigger functions using the real columns.
-- Run once in Supabase SQL Editor.
-- ============================================================

create or replace function public.rental_listing_audit_trigger()
returns trigger language plpgsql security definer as $$
begin
  if OLD.admin_status is distinct from NEW.admin_status
  or OLD.status is distinct from NEW.status then
    insert into public.rental_audit_logs (
      actor_id, action, target_table, target_id, before_state, after_state
    ) values (
      auth.uid(),
      'status_change:' || coalesce(OLD.admin_status,'?') || '->' || NEW.admin_status,
      'rental_vehicle_listings',
      NEW.id,
      jsonb_build_object('status', OLD.status, 'admin_status', OLD.admin_status),
      jsonb_build_object('status', NEW.status, 'admin_status', NEW.admin_status)
    );
  end if;
  return NEW;
end;
$$;

create or replace function public.rental_company_audit_trigger()
returns trigger language plpgsql security definer as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.rental_audit_logs (
      actor_id, action, target_table, target_id, before_state, after_state
    ) values (
      auth.uid(),
      'company_status:' || coalesce(OLD.status,'?') || '->' || NEW.status,
      'rental_companies',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  end if;
  return NEW;
end;
$$;

-- Triggers themselves are unchanged; replacing the functions is enough.
-- ============================================================
