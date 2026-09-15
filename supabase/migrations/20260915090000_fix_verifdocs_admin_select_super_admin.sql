-- Fix: the "verifdocs admin select" storage.objects policy on the private
-- verification-docs bucket checked profiles.role = 'admin' literally, so a
-- super_admin account (the only staff role that currently exists in
-- production) could never generate a signed URL for a KYC id_doc/selfie
-- upload -- every pending verification's documents were invisible to every
-- real admin session. Same bug class as the C2E-15 business_payments fix:
-- replace the literal-role check with is_admin(), which already covers
-- both 'admin' and 'super_admin'.

drop policy if exists "verifdocs admin select" on storage.objects;

create policy "verifdocs admin select" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'verification-docs' and public.is_admin());
