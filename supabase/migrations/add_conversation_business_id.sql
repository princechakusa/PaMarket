-- Business conversations (a buyer messaging a shop) were only distinguishable
-- from personal 1:1 conversations by an ad-hoc conversation-id naming
-- convention ("biz_<id8>_<id6>" vs "conv_<id8>_<id8>") baked into the mobile
-- app's messageShop() function. Nothing in the schema actually marked a
-- conversation as belonging to a business, so the Messages list and chat
-- header always resolved "who am I talking to" from the other member's
-- personal profile — a business conversation displayed the shop owner's
-- personal name/avatar, with no visual indication the user was messaging
-- the shop rather than that person directly.
--
-- Adds an explicit business_id so the app can render the business identity
-- (name/logo) instead of the owner's personal profile whenever it's set.
-- Nullable — existing personal conversations are unaffected.

alter table public.conversations
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists conversations_business_id_idx
  on public.conversations (business_id);

notify pgrst, 'reload schema';
