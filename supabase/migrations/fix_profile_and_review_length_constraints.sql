-- Extends the text-length hardening in security_hardening_2026_06.sql
-- (messages/listings) to fields that only had a client-side maxlength.
-- Client-side limits are cosmetic — anyone posting straight to PostgREST
-- (browser devtools, curl) bypasses them entirely. These match the
-- maxlength already enforced in account-settings.html / post-ad.html so
-- legitimate traffic is unaffected.

do $$ begin
  alter table public.profiles
    add constraint profiles_name_length check (char_length(name) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_bio_length check (char_length(bio) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.rental_reviews
    add constraint rental_reviews_body_length check (char_length(body) <= 2000);
exception when duplicate_object then null; end $$;
