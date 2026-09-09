-- ─────────────────────────────────────────────────────────────
-- Business activation approval: decline-with-note + owner cancel — 2026-09-09
--
-- Today's admin panel can only Approve a pending_activation business (or
-- silently leave it pending forever) — there is no way to decline it with
-- a reason the owner can see, and the owner has no way to cancel their own
-- pending request. Adds a distinct 'rejected' status (separate from
-- 'suspended', which means "was live, now disabled" — a different concept
-- and message than "never approved") plus a note field the admin fills in
-- on decline.
-- ─────────────────────────────────────────────────────────────

alter table public.businesses drop constraint if exists businesses_status_check;
alter table public.businesses add constraint businesses_status_check
  check (status = any (array['draft'::text, 'pending_activation'::text, 'active'::text, 'suspended'::text, 'rejected'::text]));

alter table public.businesses add column if not exists rejection_note text;

-- Owner update policy already allows the owner to change their own
-- business's status to anything the check constraint permits (see
-- "businesses: owner update"), so cancelling a pending request (owner sets
-- status back to 'draft') needs no new policy. Admin decline (setting
-- 'rejected' + rejection_note) is already covered by "businesses: admin
-- all". No RLS changes needed — just the schema above.

notify pgrst, 'reload schema';
