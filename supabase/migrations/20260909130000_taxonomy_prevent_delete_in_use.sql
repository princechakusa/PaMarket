-- ============================================================
-- PaMarket — Stage 4 follow-up: DB-level guard against deleting a
-- category/province/city that existing listings still reference.
-- listings.category/province/city are plain TEXT (no FK), so this can't be
-- a foreign-key ON DELETE RESTRICT — enforced instead with a BEFORE DELETE
-- trigger that raises if any listing still uses the value. The admin panel
-- already checks this client-side; this is the same rule enforced
-- server-side so it can't be bypassed by a direct API call.
-- provinces additionally can't be deleted while any city still belongs to
-- them (the existing FK on cities.province_id already blocks that with
-- "on delete restrict" from the foundation migration — no new code needed
-- there).
-- Safe to run more than once.
-- ============================================================

create or replace function public.taxonomy_prevent_delete_if_in_use()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  in_use boolean;
begin
  if TG_TABLE_NAME = 'categories' then
    select exists(select 1 from public.listings where category = old.legacy_key) into in_use;
  elsif TG_TABLE_NAME = 'provinces' then
    select exists(select 1 from public.listings where province = old.name) into in_use;
  elsif TG_TABLE_NAME = 'cities' then
    select exists(select 1 from public.listings where city = old.name) into in_use;
  else
    in_use := false;
  end if;
  if in_use then
    raise exception 'Cannot delete % — still referenced by existing listings. Deactivate it instead.', TG_TABLE_NAME
      using errcode = '23503';
  end if;
  return old;
end;
$fn$;

revoke execute on function public.taxonomy_prevent_delete_if_in_use() from public, anon, authenticated;

drop trigger if exists trg_categories_prevent_delete on public.categories;
create trigger trg_categories_prevent_delete before delete on public.categories
  for each row execute function public.taxonomy_prevent_delete_if_in_use();

drop trigger if exists trg_provinces_prevent_delete on public.provinces;
create trigger trg_provinces_prevent_delete before delete on public.provinces
  for each row execute function public.taxonomy_prevent_delete_if_in_use();

drop trigger if exists trg_cities_prevent_delete on public.cities;
create trigger trg_cities_prevent_delete before delete on public.cities
  for each row execute function public.taxonomy_prevent_delete_if_in_use();
