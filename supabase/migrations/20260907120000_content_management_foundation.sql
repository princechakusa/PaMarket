-- ============================================================
-- PaMarket — Content Management Foundation (Stage 1)
-- Creates public.content_pages, extends public.app_settings with typed
-- contact/social/store-link keys, tightens app_settings RLS (a stray
-- "anon write settings" policy allowed ANYONE to write it — removed),
-- and migrates the initial legal/FAQ/contact content unchanged from
-- apps/mobile/lib/legal.ts, apps/mobile/app/help.tsx and
-- delete-account.html. Safe to run more than once.
-- ============================================================

-- ── content_pages ───────────────────────────────────────────
create table if not exists public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  content_type text not null check (content_type in ('legal','faq','page')),
  locale text not null default 'en',
  title text not null,
  short_description text,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  version integer not null default 1,
  parent_id uuid references public.content_pages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  effective_date date,
  published_at timestamptz,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_pages_slug_locale_unique unique (slug, locale),
  constraint content_pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint content_pages_title_not_blank check (length(trim(title)) > 0)
);

create index if not exists content_pages_status_type_idx
  on public.content_pages (content_type, status);
create index if not exists content_pages_slug_idx on public.content_pages (slug);

comment on table public.content_pages is
  'Admin-managed public content: legal/policy documents, FAQ, and public pages. Draft rows are never publicly readable; only status=published rows are exposed to anon/authenticated readers.';

-- version history — one row per saved edit, so a previous version can be
-- restored (Section: "Restore a previous version if the existing audit
-- architecture supports it" — this piggybacks on admin_audit_logs'
-- before_state/after_state instead of a second table; see restore note
-- below). A dedicated snapshot table keeps restore simple and cheap.
create table if not exists public.content_page_versions (
  id uuid primary key default gen_random_uuid(),
  content_page_id uuid not null references public.content_pages(id) on delete cascade,
  version integer not null,
  title text not null,
  short_description text,
  body jsonb not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  effective_date date,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists content_page_versions_page_idx
  on public.content_page_versions (content_page_id, version desc);

comment on table public.content_page_versions is
  'Snapshot of a content_pages row taken on every admin save, so an admin can restore a previous version.';

alter table public.content_pages enable row level security;
alter table public.content_page_versions enable row level security;

drop policy if exists "content_pages: public read published" on public.content_pages;
create policy "content_pages: public read published"
  on public.content_pages for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "content_pages: admin write" on public.content_pages;
create policy "content_pages: admin write"
  on public.content_pages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "content_page_versions: admin read" on public.content_page_versions;
create policy "content_page_versions: admin read"
  on public.content_page_versions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "content_page_versions: admin write" on public.content_page_versions;
create policy "content_page_versions: admin write"
  on public.content_page_versions for insert
  to authenticated
  with check (public.is_admin());

grant select on public.content_pages to anon, authenticated;
grant insert, update, delete on public.content_pages to authenticated;
grant select, insert on public.content_page_versions to authenticated;

-- updated_at / version bump on every save, and a version-history snapshot
-- of the row as it stood BEFORE this update (so "version N" in the
-- snapshot table always means "what publishing looked like going into
-- version N+1"), matching how admin_audit_logs.before_state already works
-- elsewhere in this codebase.
create or replace function public.content_pages_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.content_page_versions
    (content_page_id, version, title, short_description, body, status, metadata, effective_date, updated_by, created_at)
  values
    (old.id, old.version, old.title, old.short_description, old.body, old.status, old.metadata, old.effective_date, old.updated_by, old.updated_at);
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$fn$;

drop trigger if exists trg_content_pages_before_update on public.content_pages;
create trigger trg_content_pages_before_update
  before update on public.content_pages
  for each row execute function public.content_pages_before_update();

-- ── app_settings: fix a pre-existing hole + add typed keys ─────────────
-- "anon write settings" (qual: true, roles: public, cmd: ALL) let literally
-- anyone — including unauthenticated users — overwrite app_settings. This
-- predates this migration and is unrelated to content_pages, but is being
-- fixed here because this migration extends the same table with new public
-- contact/social/store-link keys, and shipping those next to a wide-open
-- write policy would be unsafe.
drop policy if exists "anon write settings" on public.app_settings;

-- Re-assert the intended pair: public read, admin-only write (already
-- present from admin_security_hardening.sql; re-created defensively).
drop policy if exists "anon read settings" on public.app_settings;
create policy "anon read settings" on public.app_settings
  for select to anon, authenticated using (true);

drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write" on public.app_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed typed contact/social/store-link keys under settings.content, without
-- touching any existing key already in the settings jsonb blob. Values are
-- the SAME ones already hardcoded across the mobile app and website (see
-- the hardcoded-content audit) — moving here does not change anything
-- publicly visible yet; only the follow-up website/admin wiring in this
-- same stage starts reading from it.
insert into public.app_settings (id, settings)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

update public.app_settings
set settings = settings || jsonb_build_object(
  'content', jsonb_build_object(
    'supportEmail', 'support@pamarketzw.com',
    'whatsappNumber', '+971589772645',
    'socialLinks', jsonb_build_object(
      'tiktok', 'https://www.tiktok.com/@pamarketzw',
      'facebook', 'https://www.facebook.com/share/1BYRHcg9C9/?mibextid=wwXIfr',
      'instagram', 'https://www.instagram.com/pamarketzim'
    ),
    'appStoreUrl', 'https://apps.apple.com/app/id6794616959',
    'playStoreUrl', 'https://play.google.com/store/apps/details?id=com.pamarket.app',
    'websiteUrl', 'https://pamarketzw.com'
  )
),
updated_at = now()
where id = 1
  and not (settings ? 'content');

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'terms',
  'legal',
  'Terms of Service',
  'The agreement between you and PaMarket for using the app and website.',
  '{"sections":[{"heading":"","body":"These Terms of Service (\"Terms\") form a legally binding agreement between you (\"User\", \"you\") and PaMarket Zimbabwe (\"PaMarket\", \"we\", \"us\", \"our\"). By accessing or using the PaMarket mobile application or website you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must stop using the platform immediately."},{"heading":"1. Changes to These Terms","body":"We may update these Terms at any time. We will notify you of material changes by in-app notification or by posting the updated Terms with a new effective date. Your continued use of PaMarket after changes are posted constitutes your acceptance of the revised Terms. If you disagree with any change, your only remedy is to stop using the platform and delete your account."},{"heading":"2. Eligibility","body":"You must be at least 18 years old and have full legal capacity to enter into binding contracts under the laws of Zimbabwe. By creating an account you represent and warrant that you meet these requirements. We reserve the right to terminate any account we have reason to believe belongs to a person under 18, without notice or liability."},{"heading":"3. Account Registration and Security","body":"You may register using a valid email address, phone number, or a supported third-party sign-in provider (e.g. Google). You are solely responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must notify us immediately at info@pamarketzw.com if you become aware of any unauthorised access. We will not be liable for any loss caused by someone else using your account with or without your knowledge. You may hold only one account; duplicate accounts will be removed."},{"heading":"4. Nature of the Platform — PaMarket Is a Marketplace Only","body":"PaMarket is an online classifieds and services marketplace. We provide technology that enables users to list goods, services, jobs, and business profiles, and to communicate with each other. PaMarket is not a buyer, seller, employer, employee, broker, agent, or auctioneer. We do not own, inspect, store, or ship any item listed on the platform. We do not employ, represent, endorse, or guarantee any user, business, or job poster. Any contract for the purchase or sale of any item or service is made directly between the buyer and the seller. PaMarket is not a party to any such contract."},{"heading":"5. Licence You Grant PaMarket","body":"By submitting content to PaMarket (including photos, text, videos, business names, and descriptions) you grant PaMarket a worldwide, non-exclusive, royalty-free, sublicensable, and transferable licence to use, reproduce, modify, adapt, publish, translate, distribute, and display that content across all media formats, including within the app, on our website, and for promotional purposes, for as long as the content remains on our platform. You represent and warrant that you own or have the necessary rights to grant this licence and that your content does not infringe the rights of any third party."},{"heading":"6. Listing Rules","body":"All listings must meet the following requirements: you must own the item or have verifiable legal authority to sell it; the title, description, photos, price, and location must accurately represent the item, with no misleading statements, omissions of known defects, or inflated valuations; all prices must be quoted in United States Dollars (USD) — listings in any other currency will be removed; photos must be real images of the actual item — stock images, watermarked images, or images of a different item are not permitted; do not post duplicate listings for the same item across multiple categories or provinces; listings must be placed in the correct category — miscategorised listings will be moved or removed; remove or mark your listing as sold as soon as the item is no longer available. PaMarket reserves the right to edit, reclassify, reject, or remove any listing at any time, with or without notice, for any reason including but not limited to violation of these Terms."},{"heading":"7. Prohibited Items and Content","body":"The following are strictly prohibited: stolen goods or goods obtained through fraud or deception; counterfeit, fake, or unauthorised copies of branded goods; goods requiring ZIMRA import permits, licences, or customs clearance that the seller does not hold; illegal drugs, narcotics, controlled substances, or drug paraphernalia; unlicensed firearms, weapons, ammunition, explosives, or related accessories; wildlife, live animals, animal parts, or products protected under CITES or the Zimbabwe Parks and Wildlife Act; tobacco products, alcohol, or spirits sold without the required ZIMRA/Government of Zimbabwe retail licence; pornographic, sexually explicit, or adult content of any kind; content that promotes or incites violence, hatred, discrimination, or terrorism; pyramid schemes, MLM recruitment, advance fee fraud (419), Ponzi schemes, or any deceptive financial offer; impersonation of any individual, business, government body, or official institution; personal data or private information of third parties without their consent; human beings, human organs, or any service that constitutes human trafficking; prescription medicines or medical devices sold without a valid licence; hazardous chemicals, flammable materials, or radioactive substances; and any item or service whose listing, sale, or purchase is prohibited under the laws of Zimbabwe. This list is non-exhaustive. PaMarket retains sole discretion to determine what constitutes prohibited content and to remove any content we consider harmful, illegal, or contrary to the spirit of these Terms."},{"heading":"8. Business Shops","body":"Business accounts may create a verified Shop profile with a product catalogue and a dedicated business inbox. You must be the legitimate owner or an authorised representative of the business entity named in the Shop. All business details must be accurate and kept up to date. PaMarket may request proof of business registration at any time and reserves the right to downgrade or remove verification, suspend, or permanently close any Business Shop that provides false information or violates these Terms. PaMarket does not guarantee or warrant the legitimacy, quality, or delivery of any product or service offered by a Business Shop."},{"heading":"9. Hire Talent","body":"Employers may post job openings subject to admin review, typically completed within 24 hours. All job postings must be for genuine, existing vacancies at a real organisation operating lawfully within Zimbabwe. Charging job seekers any registration, application, training, or placement fee is strictly prohibited and will result in immediate permanent account suspension and may be reported to the Zimbabwe Republic Police. PaMarket is not an employment agency and is not responsible for the accuracy of job descriptions, the conduct of employers, or any employment relationship that arises from a listing."},{"heading":"10. Transactions — No Involvement by PaMarket","body":"PaMarket does not facilitate, guarantee, insure, or supervise any transaction between users. We do not process payments, hold escrow funds, or provide buyer or seller protection of any kind. All agreements, payments, and deliveries are arranged directly between the buyer and the seller. PaMarket expressly disclaims any liability for non-payment or delayed payment, non-delivery or late delivery of goods, defective or misdescribed or counterfeit or stolen goods, fraud or deceptive conduct by any user, loss/damage/injury arising from a meeting between users, and any dispute arising from a transaction conducted through or discovered on the platform."},{"heading":"10A. Paid Features and Platform Billing","body":"Separately from peer-to-peer marketplace transactions, PaMarket offers optional paid platform features — listing boosts, featured slot packs, Business Shop subscriptions, Recruiter subscriptions, job posting credit packs, job boosts, and featured rental slots — sold by PaMarket directly to you and processed exclusively through Google Play Billing or Apple''s In-App Purchase billing. All paid features are purchased and billed through Google Play Billing or Apple''s In-App Purchase billing; PaMarket does not receive, process, or store your card or payment details. Subscriptions renew automatically until cancelled via Google Play or the App Store (depending on your device); PaMarket cannot cancel a subscription on your behalf. One-time purchases do not renew automatically. Refund requests are handled through Google Play''s or Apple''s refund process. Posting listings, applying for jobs, messaging, and browsing remain entirely free."},{"heading":"11. Messaging and User Conduct","body":"PaMarket''s in-app messaging is provided to facilitate legitimate transactions. You agree not to use messaging to send spam, unsolicited bulk messages, harassment, threats, sexually explicit content, or any content that violates these Terms. We do not read your private messages as a matter of course; however, we may review messages if they are reported to us for abuse. Do not share your bank account details, national ID numbers, passwords, or other sensitive personal information through the messaging system."},{"heading":"12. Third-Party Links and Services","body":"The platform may contain links to third-party websites, services, or resources. PaMarket has no control over the content, privacy practices, or availability of such third-party sites. A link to a third-party site does not constitute an endorsement, sponsorship, or recommendation by PaMarket. You access any third-party links entirely at your own risk."},{"heading":"13. Our Intellectual Property","body":"The PaMarket name, logo, app design, user interface, proprietary software, written content, and all other intellectual property on the platform are owned by PaMarket or its licensors and are protected by copyright, trademark, and other intellectual property laws. You may not copy, reproduce, modify, distribute, create derivative works from, publicly display, or commercially exploit any part of our intellectual property without our prior written permission."},{"heading":"14. Copyright and IP Infringement — Takedown Requests","body":"If you believe that content on PaMarket infringes your copyright or other intellectual property rights, please contact us in writing at info@pamarketzw.com with a description of the work, the location of the allegedly infringing content, your contact details, and the required good-faith statements. We will review all valid takedown requests and act in accordance with applicable law."},{"heading":"15. Disclaimers — No Warranties","body":"To the fullest extent permitted by Zimbabwean law, PaMarket provides the platform \"as is\" and \"as available\" without any representation or warranty of any kind, whether express, implied, or statutory. We do not warrant that the platform will be uninterrupted, error-free, secure, or free of viruses; that any listing is accurate, complete, legal, or genuine; that the identity or creditworthiness of any user has been verified; or that any item or service listed is fit for its purpose. You use the platform entirely at your own risk."},{"heading":"16. Limitation of Liability","body":"To the fullest extent permitted by Zimbabwean law, PaMarket and its officers, directors, employees, agents, and licensors shall not be liable to you for any indirect, incidental, special, consequential, punitive, or exemplary damages arising out of or in connection with your use of or inability to use the platform. Our total aggregate liability to you for any claim shall not exceed the greater of the amount you paid to PaMarket in the 12 months preceding the claim, or USD 10."},{"heading":"17. Indemnification","body":"You agree to defend, indemnify, and hold harmless PaMarket and its officers, directors, employees, contractors, agents, licensors, and service providers from and against any claims, liabilities, damages, judgments, losses, costs, and fees arising out of or relating to your violation of these Terms, content you post, your conduct towards other users, your violation of any third-party right, any transaction facilitated by the platform, or your violation of applicable law."},{"heading":"18. Termination","body":"PaMarket reserves the right to suspend, restrict, or permanently terminate your access to the platform at any time, with or without notice, for any reason, including violation of these Terms, fraudulent activity, or conduct harmful to other users or to PaMarket. You may delete your account at any time via Settings."},{"heading":"19. Force Majeure","body":"PaMarket shall not be liable for any failure or delay in performance caused by circumstances beyond our reasonable control, including internet or telecommunications failures, power outages, natural disasters, civil unrest, government actions, cyberattacks, pandemics, or acts of God."},{"heading":"20. Governing Law and Dispute Resolution","body":"These Terms are governed by and construed in accordance with the laws of the Republic of Zimbabwe. Any dispute shall be subject to the exclusive jurisdiction of the courts of Zimbabwe. Before commencing formal proceedings, you agree to contact us in good faith to attempt to resolve the dispute informally."},{"heading":"21. Miscellaneous","body":"These Terms, together with our Privacy Policy and Community Guidelines, constitute the entire agreement between you and PaMarket. If any provision is found unenforceable, it will be limited or eliminated to the minimum extent necessary. Our failure to enforce any right is not a waiver. You may not assign your rights under these Terms without our prior written consent. By using PaMarket you consent to receive communications from us electronically."},{"heading":"22. Contact","body":"PaMarket Zimbabwe · Email: info@pamarketzw.com · WhatsApp: +971 589 772 645"}]}'::jsonb,
  'published',
  '2026-07-01',
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'privacy',
  'legal',
  'Privacy Policy',
  'What data PaMarket collects, why, and your rights over it.',
  '{"sections":[{"heading":"","body":"PaMarket Zimbabwe (\"PaMarket\", \"we\", \"us\", \"our\") is committed to protecting your privacy and handling your personal information responsibly. This Privacy Policy explains what data we collect, why we collect it, how we use and protect it, who we share it with, how long we keep it, and what rights you have over it. By using PaMarket you agree to the practices described in this Policy."},{"heading":"1. Who Is the Data Controller","body":"PaMarket Zimbabwe is the data controller responsible for your personal information collected through the PaMarket mobile application and website. This Policy is governed by the Zimbabwe Cyber Security and Data Protection Act [Chapter 12:07] and applicable Zimbabwean data protection law. Contact us at info@pamarketzw.com for any privacy-related enquiry."},{"heading":"2. Information We Collect","body":"Account and identity data (name, email, phone, profile photo); verification data (national ID/passport copy for verified badge requests, deleted within 30 days of review); listing data (photos, titles, descriptions, prices, categories, locations); business data (business name, type, description, logo, catalogue); job and CV data; message and communication data; push notification device tokens; usage and behavioural data; device and technical data (model, OS version, app version, IP address, crash logs); and purchase data (purchase token, product ID, purchase/subscription status from Google Play Billing on Android or Apple''s In-App Purchase system on iOS — we never receive your card number, bank details, Google account password, or Apple ID password)."},{"heading":"3. Legal Basis for Processing","body":"We process your personal data under: contract performance (registering your account, delivering core features); legitimate interests (fraud/abuse prevention, platform improvement, security monitoring); consent (push notifications, verification documents — withdrawable at any time); and legal obligation (complying with lawful requests from Zimbabwean authorities, including the Zimbabwe Republic Police and POTRAZ)."},{"heading":"4. How We Use Your Information","body":"To create and manage your account and verify your identity; display your listings, Business Shop, candidate profile, or job postings; deliver in-app and push notifications; moderate listings and enforce our Terms and Community Guidelines; investigate reports of abuse, fraud, or illegal content; improve the app based on aggregated usage analytics; detect and prevent security threats; and comply with legal obligations."},{"heading":"5. Sharing and Service Providers","body":"We do not sell, rent, or trade your personal information. We share data only with trusted sub-processors: Supabase Inc. (database, auth, storage, realtime — hosted on AWS eu-west-1/Ireland); Google LLC/Firebase (Android push notifications via FCM); Apple Inc. (iOS push via APNS); Google LLC Sign in with Google (name/email shared if you choose Google login); Sign in with Apple (name/email shared if you choose Apple login on iOS); Google LLC Google Play Billing (purchase token, product ID, subscription status for paid features on Android); Apple Inc. App Store billing (the same purchase data for paid features on iOS). All sub-processors are bound by data processing agreements. We may disclose data if required by a court order, warrant, or lawful request from a competent Zimbabwean authority."},{"heading":"6. Push Notifications","body":"We send push notifications to alert you to new messages, listing approvals, business enquiries, and account activity. You can disable push notifications at any time in your device''s notification settings."},{"heading":"7. Camera, Photos, and Media","body":"The app requests camera/photo library access only when you choose to upload photos for a listing, profile picture, or Business Shop images. We do not scan your photo library beyond images you explicitly select. Uploaded photos are stored in our file storage and are publicly accessible via the listing or profile where they appear."},{"heading":"8. Location Data","body":"PaMarket does not request or collect your precise GPS location automatically. Province and suburb information is entered manually. You may optionally share a location pin within in-app messaging, shared only with the specific recipient."},{"heading":"9. Cookies and Analytics","body":"The PaMarket web version may use strictly necessary cookies to maintain your session. We do not use advertising cookies or cross-site tracking. Aggregated, anonymised usage analytics are collected within the app; no analytics data is linked to your name or contact details."},{"heading":"10. Data Retention","body":"Account data: retained while active, deleted within 30 days of a deletion request. Listings: retained until deleted, may remain in server logs up to 90 days after removal. Messages: retained 24 months from last activity, then purged. Verification documents: deleted within 30 days of review outcome. Push tokens: deleted on logout/uninstall. Server/security logs: retained 90 days."},{"heading":"11. Security","body":"All data is transmitted using HTTPS/TLS encryption. Passwords are never stored in plain text; authentication is managed by Supabase Auth using industry-standard hashing. Our database tables are protected by row-level security (RLS) policies. We conduct periodic security reviews and apply patches promptly. If you become aware of a security vulnerability, report it to info@pamarketzw.com."},{"heading":"12. Your Rights and Choices","body":"Access: request a copy of your data by emailing us — we respond within 30 days. Correction: update your details via Settings at any time. Deletion: delete your account and all data via Settings — irreversible. Notification opt-out: disable push notifications in device Settings. Portability: request a machine-readable export by emailing us. Withdraw consent: where processing is based on consent, withdraw at any time without affecting prior processing lawfulness."},{"heading":"13. International Data Transfers","body":"Your data is stored and processed by Supabase on AWS infrastructure located in Ireland (EU). By using PaMarket you consent to this transfer, subject to appropriate contractual safeguards including Supabase''s standard data processing agreement."},{"heading":"14. Children''s Privacy","body":"PaMarket is intended for users aged 18 and over. We do not knowingly collect personal information from anyone under 18. If we become aware that a user is under 18, we will delete their account and all associated data without notice."},{"heading":"15. Marketing Communications","body":"We may occasionally send in-app notifications about new features, platform updates, or promotional offers. We do not send marketing emails or SMS without your explicit opt-in. You can opt out of in-app promotional notifications in Settings."},{"heading":"16. Changes to This Policy","body":"We may update this Privacy Policy to reflect changes in our practices, technology, legal requirements, or business operations. We will notify you of significant changes via in-app notification. The \"Last updated\" date always reflects the most recent revision."},{"heading":"17. Contact","body":"PaMarket Zimbabwe · Email: info@pamarketzw.com · WhatsApp: +971 589 772 645"}]}'::jsonb,
  'published',
  '2026-07-01',
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'community-guidelines',
  'legal',
  'Community Guidelines',
  'Rules for respectful, safe behaviour on PaMarket.',
  '{"sections":[{"heading":"","body":"PaMarket is a community marketplace built on trust. These guidelines set the standards of behaviour we expect from every user — buyers, sellers, business owners, job seekers, and employers. Violating these guidelines may result in your listing being removed, your account being suspended, or a permanent ban. Serious violations may be reported to law enforcement authorities in Zimbabwe."},{"heading":"1. Listing Honesty","body":"Every listing must be honest and complete: only list items you physically have in your possession and have the legal right to sell; your title, description, and photos must accurately represent the actual condition, age, brand, model, and any known defects of the item; do not use manufacturer stock photos or images downloaded from the internet — take real photos of the actual item under good lighting; clearly disclose any damage, scratches, faults, missing parts, or prior repairs in the description; remove or update your listing immediately when the item is sold, rented, or no longer available; do not repost the same item repeatedly to push it to the top of search results."},{"heading":"2. Prohibited Items and Services","body":"The following are never permitted on PaMarket, regardless of context or claimed purpose: stolen goods of any kind; counterfeit goods — fake branded clothing, replica watches, pirated software, unauthorised copies of any product; drugs and narcotics — any illegal substance, controlled drug, or drug paraphernalia; weapons — unlicensed firearms, illegal knives, ammunition, explosives, or weapons parts; wildlife — live wild animals, ivory, rhino horn, skins, or any product protected under the Zimbabwe Parks and Wildlife Act or CITES; adult content — pornographic images, videos, or services of any kind; unlicensed alcohol and tobacco sold without a valid government retail licence; prescription medicine sold without a valid pharmacist licence; financial scams — pyramid schemes, chain letters, MLM recruitment, Ponzi schemes, advance fee fraud (419), investment opportunities with guaranteed returns; counterfeit currency or any instrument used to commit fraud; rental or property listings for properties that do not exist or that the poster has no right to let; human trafficking or any offer of persons for sale, labour exploitation, or sexual services; personal data of third parties, including phone number lists, email databases, or identity documents; hazardous materials including toxic chemicals, flammable gases, or radioactive items."},{"heading":"3. Listing Quality Standards","body":"Title: be specific. Include brand, model, year, size, or condition where relevant. \"2019 Samsung Galaxy S10 128GB - Excellent Condition\" is better than \"Samsung phone for sale\". Description: write at least 3-4 sentences. Include why you are selling, the history of the item, any accessories included, and your preferred contact method. Price: set a realistic market price in USD. Check similar listings to calibrate. \"Price negotiable\" is acceptable as a note but every listing must have a price. Photos: upload at least 2 clear photos. Show multiple angles, include any damage, and photograph serial numbers on electronics. A listing with 5+ photos gets significantly more enquiries. Category: choose the most specific correct category. If your item fits multiple categories, choose the primary one. Location: select the actual province and suburb where the item is located. Do not list in a different area to attract more views."},{"heading":"4. Pricing Standards","body":"All prices on PaMarket must be in United States Dollars (USD). This is a platform-wide rule. Do not list items at deliberately misleading prices to attract clicks, then refuse to sell at that price. If your price changes, update your listing immediately. Do not attempt to collect payment in cryptocurrency, mobile money from a stranger before meeting, or any form that removes buyer protection, unless both parties have agreed in full knowledge of the risks."},{"heading":"5. Respectful Communication","body":"Treat every user with courtesy, even if a negotiation does not go your way. Do not send bulk or unsolicited messages. Do not use PaMarket messaging to advertise to strangers. Do not threaten, bully, harass, intimidate, or discriminate against any user on the basis of race, ethnicity, gender, religion, sexual orientation, disability, or any other characteristic. Do not share your bank account number, national ID, passport, or PIN through the chat. PaMarket will never ask for this information through chat. If someone is rude, threatening, or suspicious, use the Block and Report functions. Do not engage or retaliate."},{"heading":"6. Business Shop Standards","body":"Your Business Shop must represent a real, lawfully operating business registered or operating in Zimbabwe. Your business name, description, logo, contact details, and product listings must all be accurate. Do not impersonate another business, brand, or organisation. Do not use another company''s logo, name, or trademarks without written permission. If your business changes address, phone number, or closes, update or remove your Business Shop immediately. Featured listings in your Shop must represent products you actually stock and are ready to sell. Do not use your Business Shop to promote pyramid schemes, MLM downlines, or financial products without appropriate licensing."},{"heading":"7. Hire Talent Standards — Employers","body":"Job postings must be for genuine, existing vacancies at a real organisation. Fake job listings are fraud. Never charge candidates any fee to apply, register, train, or be placed. This is illegal under Zimbabwean labour law and is grounds for immediate permanent account suspension and referral to the Zimbabwe Republic Police. Job descriptions must be accurate regarding the role, responsibilities, remuneration, and required qualifications. Do not post the same job multiple times to appear at the top of search results. Mark your job as filled as soon as the vacancy is no longer open."},{"heading":"8. Hire Talent Standards — Job Seekers","body":"Your candidate profile must be accurate. Do not misrepresent your qualifications, experience, or skills. Do not create multiple profiles to increase visibility. Never pay any fee to apply for a job, attend an interview, or receive a job offer. Genuine employers do not charge candidates. If asked for money, report the listing immediately."},{"heading":"9. Fraud and Scam Awareness","body":"PaMarket is a free platform and we cannot screen every user. Protect yourself: advance fee fraud — if a buyer asks you to send an item before receiving payment, or offers to overpay by cheque and asks you to refund the difference, this is a scam — decline and report; fake rental deposits — never pay a deposit for a property before physically viewing it and verifying the landlord owns or manages it; too-good-to-be-true prices — a brand new iPhone for USD 50 is not a bargain, it is stolen or non-existent — walk away; urgency pressure — scammers create false urgency (\"I leave the country today, pay now\") — take your time, legitimate sellers will wait; impersonation — if someone claims to be a PaMarket employee or admin asking for your password or payment, this is a scam — PaMarket will never contact you through chat asking for payment or credentials."},{"heading":"10. Safe Transactions","body":"Always meet in a busy, public location during daylight hours. Shopping malls, filling station forecourts, and bank lobbies are recommended. Bring a friend or family member when meeting a stranger for a high-value transaction. Never invite a stranger to your home or travel alone to a stranger''s home for a first meeting. Inspect and verify goods before handing over any money. For vehicle sales, insist on a test drive and verify the log book matches the seller''s ID before paying. For electronics, test the device fully before payment — power it on, check IMEI against the box, verify the screen, camera, and ports work. Trust your instincts. If something feels wrong, walk away."},{"heading":"11. Reporting Violations","body":"If you see content that violates these guidelines: tap the \"...\" or Report icon on the listing, profile, or message and select a reason; for urgent safety or fraud concerns, email info@pamarketzw.com directly with as much detail as possible; for criminal matters (stolen goods, fraud, weapons), contact the Zimbabwe Republic Police and share the listing URL with them. All reports are reviewed by our moderation team. We may not be able to share the outcome of every report with the reporter, but we act on all valid reports."},{"heading":"12. How We Enforce These Guidelines","body":"We apply a graduated enforcement approach based on the severity and frequency of violations: warning — first minor violation (e.g. mislabelled category, missing price); listing is removed or corrected and you receive an in-app warning; temporary suspension (7-30 days) — repeated minor violations or first moderate violation (e.g. misleading description, duplicate listings, disrespectful messaging); permanent ban — serious violations including fraud, listing illegal items, charging job seekers fees, sharing prohibited content, or any criminal activity — permanent bans are not reversed and all listings and data are removed; law enforcement referral — where there is evidence of criminal activity (fraud, stolen goods, drugs, weapons, human trafficking), we will cooperate fully with the Zimbabwe Republic Police, POTRAZ, and other competent authorities, including providing user data under valid legal process."},{"heading":"13. Appeals","body":"If you believe your listing was removed or your account was actioned in error, you may appeal by emailing info@pamarketzw.com within 14 days of the action, stating your account details and the reason you believe the action was incorrect. We will review your appeal and respond within 14 business days. Appeals against permanent bans for serious violations (fraud, illegal content, criminal activity) will not be considered."},{"heading":"14. Contact","body":"PaMarket Zimbabwe · Email: info@pamarketzw.com · WhatsApp: +971 589 772 645"}]}'::jsonb,
  'published',
  '2026-07-01',
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'refund-cancellation',
  'legal',
  'Refund & Cancellation Policy',
  'How refunds and cancellations work for PaMarket''s paid features.',
  '{"sections":[{"heading":"","body":"PaMarket is a free classified advertising platform — we do not process payments or hold funds. This policy explains how to handle disputes and what PaMarket can and cannot do."},{"heading":"1. PaMarket''s Role in Disputes","body":"PaMarket is not a party to any transaction between a buyer and a seller. We do not hold escrow, process payments, or guarantee delivery. As a result, we cannot: force a seller to issue a refund; retrieve money paid to another user; guarantee that a transaction will be completed; act as an arbitrator in a payment dispute."},{"heading":"2. When a Deal Goes Wrong","body":"If you believe you have been defrauded: report the listing — use the flag icon on the listing; we will investigate and may remove the seller''s account; block the user — prevent further contact from the seller; contact support — email support@pamarketzw.com with full details including screenshots; report to police — for fraud involving money or goods, file a report with the Zimbabwe Republic Police, PaMarket will cooperate fully with law enforcement; contact your bank or mobile money provider — for EcoCash/OneMoney disputes, contact the provider directly as soon as possible."},{"heading":"3. Seller Refund Obligations","body":"While PaMarket cannot legally compel a seller to refund, sellers who: take payment and do not deliver goods; deliver goods materially different from their listing description; accept deposits for items they do not own or cannot deliver — are in breach of our Terms of Use and Zimbabwean consumer protection law. Confirmed cases will result in permanent account suspension and may be referred to the Zimbabwe Republic Police."},{"heading":"4. PaMarket Boost & Subscription Refunds","body":"For paid services within the PaMarket app (boosted listings, business subscriptions): refund requests must be submitted within 7 days of payment to support@pamarketzw.com; refunds are processed within 10 business days if approved; services already delivered (e.g. a completed boost campaign) are non-refundable; technical issues or errors that prevented delivery of a paid service qualify for a full refund."},{"heading":"5. Safety Tips to Avoid Disputes","body":"Always inspect the item before paying — even a partial inspection helps. Never pay a deposit for an item you have not seen unless you know the seller personally. Use in-person cash transactions where possible for high-value items. If a deal feels too good to be true, report it and walk away. Questions? Email support@pamarketzw.com"}]}'::jsonb,
  'published',
  '2026-07-01',
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'public-safety',
  'legal',
  'Safety & Fraud Prevention',
  'How to stay safe and avoid scams when buying, selling, or hiring on PaMarket.',
  '{"sections":[{"heading":"","body":"PaMarket is committed to being a safe platform for Zimbabweans to buy, sell, and find work. This policy explains how we detect and prevent fraud, and how you can protect yourself."},{"heading":"1. Common Scams on Classified Platforms","body":"Be alert to: non-delivery fraud — seller takes payment and disappears without delivering goods; advance fee fraud — buyer or seller asks you to pay a fee upfront to \"release\" payment or goods; overpayment scam — buyer sends more than the asking price and asks for change back; fake job scams — employer requests fees from job seekers disguised as training, uniforms, or background checks; rental deposit theft — fake landlords collect deposits for properties they do not own; vehicle scams — low prices for cars that do not exist or are heavily encumbered."},{"heading":"2. Warning Signs","body":"Price is significantly below market value without a clear reason. Seller or employer requests payment via Western Union, gift cards, crypto, or wire transfer. Seller refuses to meet in person or provide verification of ownership. Communication switches quickly to WhatsApp or personal email to avoid platform oversight. Employer promises very high salary for unskilled or vague work. Any party asks you to act urgently or secretly."},{"heading":"3. PaMarket''s Detection Measures","body":"Automated detection of patterns associated with fraudulent listings. Employer verification before job postings are approved. Identity verification (blue badge) for user trust signals. AI-assisted moderation flagging suspicious listing content. Community reporting — user flags reviewed within 24 hours. Cooperation with POTRAZ and Zimbabwe Republic Police on active investigations."},{"heading":"4. Your Protections","body":"Verified badges (blue) on user profiles indicate identity verification. Business verified badges indicate company registration and ZIMRA compliance. Report any suspicious listing or user immediately using the flag icon. Block any user who contacts you inappropriately."},{"heading":"5. If You Have Been Scammed","body":"Do not pay any more money — stop all further contact. Screenshot all messages, listings, and payment receipts. Email support@pamarketzw.com immediately with full details. Report to Zimbabwe Republic Police (ZRP) — bring all evidence. Contact your bank or mobile money provider (EcoCash, OneMoney) immediately for a possible chargeback. Report the user in-app using the flag icon."},{"heading":"6. PaMarket''s Commitment","body":"We will: investigate all fraud reports within 24-48 hours; permanently ban confirmed fraudulent accounts; cooperate fully with the Zimbabwe Republic Police and POTRAZ; share relevant user data with law enforcement under valid legal process; continue improving our detection systems to stay ahead of new fraud techniques. Questions? Email support@pamarketzw.com"}]}'::jsonb,
  'published',
  '2026-07-01',
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'account-deletion',
  'legal',
  'Account Deletion',
  'What happens when you request deletion of your PaMarket account.',
  '{"sections":[{"heading":"","body":"Use this page to request permanent deletion of your PaMarket account and associated data — profile, listings, messages, favorites, and analytics history. This does not delete your account immediately; our team reviews and processes every request."},{"heading":"This action is permanent","body":"Once processed, your listings, messages, conversations, favorites, and profile will be permanently removed and cannot be recovered."},{"heading":"What happens next","body":"Your request is logged as pending. A PaMarket administrator verifies the request and permanently deletes your profile, listings, messages, conversations, favorites, and analytics events, then deletes your login credentials. Account data is deleted within 30 days of a deletion request. See the Privacy Policy for details."}]}'::jsonb,
  'published',
  '2026-07-01',
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

insert into public.content_pages
  (slug, content_type, title, short_description, body, status, effective_date, published_at, metadata)
values (
  'faq',
  'faq',
  'Help & FAQ',
  'Answers to common questions about using PaMarket.',
  '{"items":[{"group":"Getting started","q":"How do I post an ad on PaMarket?","a":"Tap the \"Post\" button at the bottom of the screen. Choose your category, add clear photos, write a title and description, set your price, and select your location. Your listing goes live instantly — no waiting for review."},{"group":"Getting started","q":"Is PaMarket free to use?","a":"Yes — completely free. Posting ads, browsing listings, sending messages, applying for jobs, and getting verified are all 100% free. No subscriptions, no commission on sales, no hidden charges."},{"group":"Getting started","q":"How do I get my account verified?","a":"Go to Account → Verify Identity. Enter your ID number, take a selfie, and upload a photo of your National ID or passport. Our team reviews your submission within 24 hours and your blue verified badge appears automatically when approved."},{"group":"Managing listings","q":"How long do my listings stay active?","a":"Listings stay active for 30 days. You can renew any listing anytime by going to My Listings and tapping Renew. Renewing resets the 30-day timer and bumps your listing back to the top."},{"group":"Managing listings","q":"Can I edit or delete a listing after posting?","a":"Yes. Go to Account → My Listings, tap the listing you want to change, then tap Edit to update photos, price, or description. To remove a listing, tap Delete. Deleted listings are permanently removed and cannot be recovered."},{"group":"Managing listings","q":"Why is my listing not showing up?","a":"Make sure your listing is set to \"Active\" in My Listings. Check that it was saved successfully — you should have received a confirmation. If your listing was removed by our moderation team, you will receive a notification with the reason. Contact support if you believe this was an error."},{"group":"Buying & safety","q":"How do payments work?","a":"PaMarket does not process or hold any payments. All payments are arranged directly between the buyer and seller — cash on collection, EcoCash, OneMoney, or bank transfer. Always inspect the item in person before paying, and never send money upfront for something you have not seen."},{"group":"Buying & safety","q":"How do I stay safe from scams?","a":"Never pay in advance without seeing the item. Avoid sellers who refuse to meet in person or who ask you to pay via gift cards or Western Union. If a deal feels too good to be true, it probably is. Use the in-app Report button to flag suspicious listings immediately."},{"group":"Buying & safety","q":"How do I contact a seller?","a":"Tap any listing, then tap \"Send Message\" to chat in-app, or tap \"Call\" or \"WhatsApp\" to contact the seller directly. All messages are stored in your Messages tab so you never lose a conversation."},{"group":"Buying & safety","q":"How do I report a listing or block a user?","a":"To report a listing: open the listing and tap the flag icon or scroll to the bottom and tap \"Report\". To block a user: tap their name on a listing or in Messages, then tap \"Block User\". Blocked users cannot see your listings or message you."},{"group":"Jobs & account","q":"How do I post a job as a company?","a":"Your company must be verified before you can post jobs on PaMarket. Go to Post → Jobs and follow the Company Verification steps. You will need your Certificate of Incorporation, Tax Clearance Certificate from ZIMRA, owner ID, and a photo of your premises. Verification takes up to 2 business days."},{"group":"Jobs & account","q":"How do I delete my account?","a":"Go to Settings → Security → Delete Account. Type DELETE to confirm. Your account, listings, and messages are permanently removed within 30 days. This action cannot be undone — download any data you need before proceeding."}]}'::jsonb,
  'published',
  null,
  now(),
  '{}'::jsonb
)
on conflict (slug, locale) do nothing;

-- Record this initial migration as an administrator content action, per
-- "Record the initial migration as an administrator content migration."
-- actor_id/actor_email are null here (this ran as a one-off migration, not
-- through the admin UI) — the reason field makes that explicit.
insert into public.admin_audit_logs (action, entity, entity_id, after_state, reason)
select 'migrate_initial_content', 'content_pages', null,
  jsonb_build_object('slugs', (select jsonb_agg(slug) from public.content_pages)),
  'Stage 1 content-management migration: seeded content_pages from apps/mobile/lib/legal.ts, apps/mobile/app/help.tsx and delete-account.html. No wording changed, only structure.'
where exists (select 1 from public.content_pages);
