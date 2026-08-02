-- Fixes two real, confirmed production issues on public.business_leads
-- found during a pre-launch security/functionality audit:
--
-- 1. FUNCTIONAL BUG: the live table only had (id, business_id, user_id,
--    status, message, created_at), but the client (lib/business-leads.ts)
--    has always read/written listing_id, user_name, and type as well.
--    Every recordLead()/recordShopLead() insert was silently failing
--    ("column does not exist"), and fetchBusinessLeads() failed the same
--    way — meaning the shop-owner Leads dashboard
--    (app/business-leads/[id].tsx) never actually showed real leads, and
--    WhatsApp/Call/Chat contact clicks were never recorded at all.
--
-- 2. SECURITY BUG: the live INSERT policy ("leads_insert") had
--    `with check (true)` — any authenticated user could insert a lead row
--    with an arbitrary user_id, impersonating any other user, or spam any
--    business with fake leads. Fixed to require user_id = auth.uid().
--    Also consolidates two functionally-identical duplicate SELECT
--    policies ("leads_owner_select" and "owner_read_leads") into one, adds
--    a policy so the lead's own creator can read their own lead (not just
--    the business owner/admin), and revokes the overly broad anon-role
--    table grants that RLS already made unreachable but shouldn't exist
--    regardless (defense in depth).
--
-- Deliberately NOT wrapped in a single begin/commit block — run and
-- verified as discrete statements against production; each is independently
-- idempotent (if not exists / drop if exists everywhere).

alter table public.business_leads
  add column if not exists listing_id uuid references public.listings(id) on delete set null,
  add column if not exists user_name text,
  add column if not exists type text;

alter table public.business_leads drop constraint if exists business_leads_type_check;
alter table public.business_leads add constraint business_leads_type_check check (type in ('whatsapp', 'call', 'chat'));

alter table public.business_leads drop constraint if exists business_leads_status_check;
alter table public.business_leads add constraint business_leads_status_check check (status in ('new', 'active', 'closed'));

revoke all on public.business_leads from anon;

drop policy if exists "leads_insert" on public.business_leads;
create policy "leads_insert"
  on public.business_leads for insert to authenticated
  with check (user_id = auth.uid());

-- Consolidates leads_owner_select + owner_read_leads (identical logic,
-- duplicated) and adds read access for the lead's own creator.
drop policy if exists "leads_owner_select" on public.business_leads;
drop policy if exists "owner_read_leads" on public.business_leads;
drop policy if exists "leads_select" on public.business_leads;
create policy "leads_select"
  on public.business_leads for select to authenticated
  using (
    user_id = auth.uid()
    or business_id in (select id from public.businesses where owner_user_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- leads_update (business-owner-only status changes) is already correct —
-- left untouched.

notify pgrst, 'reload schema';
