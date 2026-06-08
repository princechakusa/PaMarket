-- ============================================================
-- PaMarket — Account deletion function
-- Lets a signed-in user permanently delete their own account and
-- ALL personal data, including the auth login, in one call.
-- The app calls this via supabase.rpc('delete_my_account').
-- Safe to run more than once.
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;

  delete from public.listings               where seller_id    = uid;
  delete from public.messages               where sender_id    = uid::text;
  delete from public.applications           where applicant_id = uid or employer_id = uid;
  delete from public.reviews                where reviewer_id  = uid or seller_id = uid;
  delete from public.user_saves             where user_id      = uid;
  delete from public.saves                  where user_id      = uid::text;
  delete from public.saved_searches         where user_id      = uid;
  delete from public.notifications          where user_id      = uid::text;
  delete from public.conversation_deletions where user_id      = uid;
  delete from public.verifications          where user_id      = uid;
  delete from public.company_verifications  where user_id      = uid;
  delete from public.topup_requests         where user_id      = uid;
  delete from public.transactions           where user_id      = uid;
  delete from public.reports                where reporter_id  = uid::text;
  delete from public.profiles               where id           = uid;

  -- Finally remove the login itself
  delete from auth.users where id = uid;
end;
$$;

revoke all     on function public.delete_my_account() from public;
grant  execute on function public.delete_my_account() to authenticated;
