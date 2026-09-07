-- ============================================================
-- PaMarket — Content Management Stage 3 (follow-up):
--   1. Schema guarantee that a reconciliation "variant" row (metadata ?
--      'variantOf') can never itself be published — closes the gap where
--      an admin with API access (not just the admin-panel UI) could
--      otherwise publish a competing wording for the same document/locale
--      at the same time as the canonical row. The only path to publish a
--      variant's wording stays: apply it onto the canonical row as a
--      draft (admin "Use this version"), review, then Publish that row.
--   2. Corrects the one confirmed stale "pamarket.app" domain reference in
--      published content (content-moderation-policy, Section 5
--      "Transparency") to pamarketzw.com. Only the domain string changes —
--      no other wording. The existing content_pages_before_update trigger
--      snapshots the pre-correction text into content_page_versions
--      automatically, so the previous wording is preserved, not deleted.
-- Safe to run more than once.
-- ============================================================

alter table public.content_pages drop constraint if exists content_pages_variant_never_published;
alter table public.content_pages add constraint content_pages_variant_never_published
  check (not ((metadata ? 'variantOf') and status = 'published'));

-- Domain correction — single confirmed occurrence.
update public.content_pages
set body = replace(body::text, 'pamarket.app', 'pamarketzw.com')::jsonb
where slug = 'content-moderation-policy'
  and body::text like '%pamarket.app%';

insert into public.admin_audit_logs (action, entity, entity_id, reason)
select 'correct_stale_domain_reference', 'content_pages', id::text,
  'Stage 3: corrected "pamarket.app" -> "pamarketzw.com" in content-moderation-policy Section 5 (Transparency). Domain reference only, legal meaning unchanged. Previous wording preserved automatically in content_page_versions by the existing update trigger.'
from public.content_pages where slug = 'content-moderation-policy';
