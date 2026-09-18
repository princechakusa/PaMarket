-- P0 fix: businesses.verification_level was writable by any authenticated
-- owner via the row-scoped "businesses: owner update" RLS policy, with no
-- column-level distinction between ordinary fields and verification_level.
-- Mirrors the existing protect_business_plan_id() trigger pattern: admin
-- writes pass through untouched, the one legitimate self-service transition
-- (phone-confirm, 0 -> 1) is allowed, and any other attempted change
-- (self-grant to 2/3, downgrade, tamper) is silently reverted to the
-- current value rather than erroring out an unrelated save.

create or replace function public.protect_business_verification_level()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or public.is_admin() then
    return NEW;
  end if;

  if NEW.verification_level is distinct from OLD.verification_level then
    if NEW.verification_level = 1 and OLD.verification_level < 1 then
      NEW.verification_level := 1;
    else
      NEW.verification_level := OLD.verification_level;
    end if;
  end if;

  return NEW;
end;
$function$;

create trigger trg_protect_business_verification_level
  before update on public.businesses
  for each row
  execute function public.protect_business_verification_level();
