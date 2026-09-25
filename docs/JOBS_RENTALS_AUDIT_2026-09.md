# PaMarket Jobs & Car Rental — Audit and Reconstruction Plan

Date: 2026-09-24
Scope: React Native app (`apps/mobile/`), Supabase schema/RPCs/RLS (`supabase/migrations`, `supabase/schema`), with the web pages (`jobs.html`, `job.html`, `post-job.html`, `applications.html`, `rentals.html`, `rental-detail.html`, `rental-fleet.html`) noted where they share the backend.

**Evidence limitation:** the Supabase MCP connection was unauthorised (no access token), so the live database was not queried. Everything below is derived from the migration files in the repo. Section K lists the read-only SQL to run in the SQL Editor to confirm live state before Phase 0 ships.

---

## A. Current state

### Jobs
| Area | What exists today |
|---|---|
| Storage | A job is a row in the generic `listings` table with `category = 'jobs'`. There is no jobs table. |
| Job fields | Company, job type, industry, salary, experience, skills, responsibilities, requirements and how-to-apply are all serialized into `listings.description` as `KEY: value` lines and parsed back client-side (`lib/jobs.ts` `parseJobField` / `parseJobBlock`). The field is capped at 5,000 characters for the whole blob. |
| Structured columns used | `title`, `city`, `province`, `price` (reused as salary), `currency`, `expires_at`, `attributes` (only `institution_visibility`), `custom_questions` (screening questions). |
| Posting | `create_job_listing()` RPC: verified employer only (`is_authorized_recruiter` → `profiles.company_verified`), 2 free active jobs, then job credits or a recruiter subscription. Inserts directly as `status='active'`. There are no drafts. |
| Search | `search_active_jobs(p_query, p_job_type)`: a single-phrase `ILIKE '%q%'` on title and description, plus job type matched as text (`'%JOB TYPE: x%'`). Sorted by `created_at` only. No location, industry, salary, experience or date filters. |
| Browse UI | `app/jobs/browse.tsx`: search box plus job-type chips. |
| Detail | `app/jobs/[id].tsx` (853 lines): parses the description blob into sections. Has save (generic `saves`), share and apply. |
| Applications | `public.applications`: statuses `pending / shortlisted / declined`, `answers` jsonb, unique `(job_id, applicant_id)`. Identity and employer are derived server-side (trigger `trg_00_authorize_job_application_write`), the insert is rate-limited, and a candidate profile is required. |
| Status updates | The employer can update `status` only (column-level grant). A notification is sent on shortlisted/declined. |
| Withdraw | **Not possible.** There is no delete policy, no applicant update and no `withdrawn` status. |
| Seeker profile | `profiles.cv` jsonb (headline, summary, skills[], experience[], education[], certifications[], languages[], portfolio, availability, expected salary, notice period, visibility) plus flat columns `job_title, skills (csv), sector, exp, open_to_work`. CV PDF lives in the private `cv-files` bucket and is read via the `get-cv-url` edge function with a relationship check. |
| Candidate search | `browse_recruitment_candidates()`: verified recruiters only, `ILIKE` on name/title/skills. Identity is redacted until an admin approves a contact request (`contact_requests`). |
| Employer workspace | `jobs/index.tsx` (hub), `jobs/applicants/[jobId].tsx` (per-job list with counts and shortlist/decline), `jobs/candidate/[id].tsx`, `jobs/hire-talent.tsx`, `jobs/recruiter-subscription.tsx`, `jobs/contact-requests.tsx`, `jobs/messages.tsx`. |
| Company profile | None. A company is `listings.seller_name` plus `profiles.company_verified`. `recruiter_profiles` holds only `plan_id`. |
| Alerts | The generic `saved_searches` table plus a notify trigger matching on `category` and the query. It can technically alert on "jobs" but knows nothing about job filters. |

### Car rental
| Area | What exists today |
|---|---|
| Schema | This is well structured: `rental_companies` (linked to `businesses`, admin-approved), `rental_company_profiles`, `rental_vehicle_listings` (daily/weekly/monthly rate, deposit, min days, driver rate, fuel policy, cross-border, insurance, status plus admin_status), `rental_vehicle_specs`, `rental_vehicle_features`, `rental_vehicle_media` (R2), `rental_vehicle_availability` (date blocks with a no-overlap trigger), `rental_reviews`, `rental_favorites`, `rental_reports`, `rental_featured_listings`, `rental_vehicle_leads`, `rental_conversation_context`, `rental_audit_logs`. Lookup tables: `rental_categories`, `rental_brands`, `rental_locations`. |
| RLS | Hardened in v1/v2: writes require an active company, and child tables are readable only for approved listings or by the owner. |
| Search | `rental_search_listings()`: category, city, brand, price, transmission, fuel, drive, `available_only` (a manual boolean), featured first, limit/offset. |
| Customer UI | `rentals/index.tsx` (list plus filters), `rentals/[id].tsx` (detail, a date picker that checks blocked days, estimated total, chat/call/WhatsApp). |
| "Booking" | `requestBooking()` inserts a `rental_vehicle_leads` row (`lead_source='booking_request'`, requested dates), then posts a chat message. There is no booking entity. |
| Provider UI | `rental-fleet/` has 9 screens: dashboard, setup, manage, add/edit vehicle, availability (block dates), analytics, leads, profile. |

---

## B. Problems (ranked)

### Critical: correctness or security
1. **Customers cannot see availability, so every vehicle looks free.** `rentals/[id].tsx:209` selects `rental_vehicle_availability`, but the only select policy (`avail_select`, v1) is owner-only. For a customer the query returns `[]`, so `rangeHasBlockedDate` always passes and they can request dates the provider has blocked.
2. **The VIN, engine number and registration plate are publicly readable.** `specs_select` exposes the whole `rental_vehicle_specs` row (including `vin` and `engine_number`) for any approved listing, and no column-level revoke exists. `rental_vehicle_listings.registration` is likewise readable by anyone. RLS is row-level only, so the fact that the app doesn't select these columns gives no protection: any anon-key client can read them.
3. **Bookings don't exist as data.** A booking request is an analytics lead. Nothing reserves dates, there is no confirm or decline, and nothing stops two customers requesting the same dates. The lead status (`new/contacted/converted/lost`) is a sales funnel, not a rental lifecycle. The customer has no screen showing their requests.
4. **Job data is unstructured.** Because every job attribute lives inside a text blob, filtering by location/industry/salary/experience is impossible in SQL, the job-type filter is a text match, edits can corrupt the parse, and the 5,000-character cap covers all fields combined.
5. **Applicants cannot withdraw**, and the application lifecycle stops at three states. There is no interview, offer, hired or withdrawn state, and no history of transitions.

### High
6. Job search is exact-substring only. "hotel receptionist" misses "Front Office Agent – Hotel". There is no synonym vocabulary, stemming or ranking.
7. Rental search ignores dates entirely. `available_only` reads a manual `is_available` flag, so a vehicle booked next week shows as "Available". The mobile client always sends `p_city: null`, so there is no location search. There is no text query, no seats filter and no pagination beyond 30.
8. Jobs go live instantly: no drafts, no closing date on the posting form, no "close/filled" state. Expiry relies on the generic listing expiry.
9. There is no company/employer profile, so job seekers cannot evaluate who is hiring beyond a name and a verified tick.
10. Job alerts are category-level only and can't express "Hospitality jobs in Harare".
11. Reviews for rentals are one per user per company and are not tied to a completed rental, so anyone can review any company.

### Medium
12. `applications` denormalizes `applicant_phone/email` at apply time. That is fine for the employer, but it stays on the row after withdrawal or account deletion (check that `DELETE_ACCOUNT.sql` covers it).
13. The only employer dashboard metrics are counts per job. There is no cross-job pipeline view.
14. Rental price estimates are computed client-side (`estimatedTotal`) and never persisted or validated, and weekly/monthly rates are not applied consistently.
15. A rental vehicle has no maintenance/rented status tied to real bookings. `is_available` is manual.
16. There are two parallel customer UIs (web and RN) over the same backend. Every backend change must keep both working (see J, Phase 9).

---

## C. User experience gaps
- **Jobs detail:** section content comes from parsing, so jobs posted before the structured post form (or edited by hand) fall back to one "About the role" wall of text. Salary shows "Negotiable" whenever parsing fails.
- **Jobs browse:** there's no filter sheet, sort, location picker, result count or "posted N days ago / closing soon" cues.
- **Applications (seeker):** a flat list with three pills. There's no timeline, no "what happens next", no withdraw and no link to the chat thread.
- **Applicants (employer):** a two-button shortlist/decline. There's no stages, bulk actions, notes, interview scheduling or filter by answers.
- **Rentals detail:** the calendar is misleading (see B1). There's no breakdown of the total (days × rate, deposit, driver), no pickup/return time, and no rental terms block (fuel policy, mileage, cancellation, license requirements).
- **Rentals:** there's no "My rentals" screen for customers, and providers see booking requests mixed with analytics clicks in Leads.
- **Empty and loading states** exist (EmptyState/ErrorState/Skeleton are used consistently). This is a strength to keep.

## D. Data/backend gaps
| Gap | Required change |
|---|---|
| Structured job data | New `job_postings` table (1:1 with `listings.id`) holding typed columns. Keep `listings` as the parent row so saves, reports, boosts, moderation, sitemap and feeds keep working. |
| Job taxonomy | `job_industries`, `job_categories` (FK industry), `skills` (canonical plus aliases), `job_search_terms` (term → related terms/category) for synonym expansion. |
| Application lifecycle | Expand the status enum, add an `application_events` history table, an employer-only `application_notes` table, `application_interviews`, and a `withdraw_application()` RPC. |
| Seeker preferences | Add `job_seeker_preferences` (employment types[], locations[], salary min, work arrangement, categories[]). Keep `profiles.cv` for the CV body. |
| Company profile | Reuse `businesses` (already verified and has an owner, logo and description) as the employer entity: `job_postings.business_id` is nullable, falling back to the individual employer. Do not create a third company table. |
| Job alerts | Add `job_alerts` with typed filters, matched by a trigger on `job_postings` publish. Reuse the `notifications` table and push pipeline. |
| Rental bookings | Add `rental_bookings` (vehicle, customer, company, pickup/return timestamps, pickup location, extras, quoted price breakdown, status, cancellation fields). Enforce no double booking with a `btree_gist` exclusion constraint on `tstzrange` for held statuses, checked against `rental_vehicle_availability` in the RPC. |
| Public availability | Add a `rental_vehicle_busy_ranges(listing_id, from, to)` SECURITY DEFINER RPC returning only date ranges (no reason/note/customer). |
| Rental pricing | Add a server-side `rental_quote()` function (days, best of daily/weekly/monthly, driver, deposit). The booking stores the quote snapshot. |
| Reviews | Allow `rental_reviews` only from a customer with a `completed` booking with that company. |

## E. Search and keyword gaps
- **Jobs:** add a generated `tsvector` on `job_postings` (title A, skills/category B, company C, body D) with a GIN index, plus `pg_trgm` on the title for typo tolerance. Query expansion goes through `job_search_terms`: "hotel receptionist" expands to {receptionist, front office, guest relations, reception} ∧ {hotel, hospitality}, then gets ranked by `ts_rank` plus recency. Seed the vocabulary with the roles listed in the brief (accountant through mechanic) and their Zimbabwean variants ("till operator", "general hand", "bookkeeper").
- **Candidate search:** use the same vocabulary over `profiles.job_title`, `cv->skills` and experience titles, through the existing `browse_recruitment_candidates` gate.
- **Rentals:** add a `rental_search_terms` vocabulary that maps free text to structured filters: brands/models (Toyota, Corolla, Fit, Demio, X-Trail), body type (SUV, sedan, hatchback, minibus, 4x4 → category/drive), transmission, fuel, "7 seater" → seats ≥ 7, "airport" → `airport_transfer`, "wedding" → feature tag, "long-term/weekly" → rate present. Add `p_query`, `p_start`, `p_end`, `p_seats_min` and `p_city` to the search RPC, and exclude vehicles with overlapping busy ranges.

## F. Customer experience (seekers and renters)
- **Seeker:** structured profile (preferences), one-tap apply that reuses the CV, a timeline for each application, withdraw, alerts ("Hospitality in Harare"), deterministic recommendations (category plus skills overlap plus location plus preferences; no fake ML), closing-soon cues and a company page.
- **Renter:** location and dates first on the rentals home, then results that are actually available, then a detail page with a true calendar and price breakdown, then a booking sheet (pickup/return date-time, pickup vs delivery, driver option, notes), then a confirmation. A "My rentals" screen shows status, cancel (per policy) and a chat link. Reviews unlock after completion.

## G. Business experience (employers and providers)
- **Employer:** a workspace dashboard where every metric is tappable (new applicants → filtered pipeline); jobs by state (draft/active/closed/filled); a multi-step post form with structured fields and live preview; duplicate/close/repost; a pipeline view per job with stages, private notes, interview scheduling, bulk reject with a template message; and a company profile backed by `businesses`.
- **Provider:** a bookings inbox (requests → accept/decline with reason), a calendar per vehicle showing bookings plus blocks, active rentals (pickup/return check-offs), completed/cancelled history, earnings from completed bookings, and vehicle status derived from bookings (available/reserved/rented/maintenance). Leads remain as the analytics funnel only.

## H. Security gaps
1. VIN/engine/registration are public (B2). Fix: `revoke select (vin, engine_number) on rental_vehicle_specs from anon, authenticated` and the same for `registration`. Owners read them through a SECURITY DEFINER owner RPC. Then check that no client selects `*` on these tables (the web `rental-fleet.js` and RN edit screens need updating).
2. Availability is owner-only while the client depends on it (B1). Fix with the busy-ranges RPC; never widen the table policy, because `note` can contain customer names.
3. Bookings must be created only through an RPC that derives the customer from `auth.uid()`, computes the price server-side and re-checks overlap under a lock. There should be no direct insert grant, and the provider can change only allowed transitions (a transition table enforced in the trigger).
4. Application status transitions should also be enforced in the trigger. Today any of the three values can be set in any order. The applicant can only move to `withdrawn`, and only from non-terminal states.
5. Employer notes must be readable by the job owner only and never exposed to the applicant, which requires a separate table (not a column on `applications`).
6. The verification boundary is sound today: posting requires `company_verified`, and candidate identity is redacted until the contact request is approved. Keep it.

## I. Recommended architecture
```
listings (parent row: moderation, saves, reports, boosts, sitemap, feeds)
  └─ job_postings (1:1)  → job_categories → job_industries
       │                  → skills[] (canonical ids)   → business_id (company profile)
       │                  → status draft|published|closed|filled, closes_at
       └─ applications → application_events (history)
                       → application_notes (employer-private)
                       → application_interviews
profiles.cv (CV body) + job_seeker_preferences → recommendations, alerts
job_search_terms (vocabulary) → search_jobs_v2 / candidate search

rental_vehicle_listings → rental_bookings (EXCLUDE overlapping held ranges)
                        → rental_vehicle_availability (provider blocks)
   busy ranges = bookings(held) ∪ blocks  → rental_vehicle_busy_ranges() (public)
   rental_quote() → request_rental_booking() → provider transition RPCs
   rental_search_terms → rental_search_listings_v2(p_query, dates, seats, city)
rental_reviews gated on completed booking
```
Principles: keep `listings` as the jobs parent so no existing feature breaks; make every new write path an RPC with server-derived identity; keep new SQL additive and idempotent with the old RPCs retained until both clients migrate (per the manual-migration rule, the frontend must tolerate a missing RPC during rollout).

## J. Implementation phases
Each phase follows DATABASE → SECURITY → BACKEND → UI → TEST, and ships as one SQL file you run manually plus the app changes.

| Phase | Scope | Why this order |
|---|---|---|
| **0: Rental hotfix** | Revoke the VIN/engine/registration columns, add the busy-ranges RPC, switch the detail screen to it (RN plus web). | Live correctness and privacy bugs; small and isolated. |
| **1: Rental bookings core** | `rental_bookings`, exclusion constraint, `rental_quote`, `request_rental_booking`, provider accept/decline/cancel/pickup/return/complete RPCs, notifications, customer "My rentals", provider bookings inbox. | The biggest product hole on the rental side. |
| **2: Rental discovery** | Search v2 (dates, text vocabulary, seats, city, pagination, sort), location/date-first rentals home, price breakdown, terms block, vehicle status derived from bookings, provider calendar. | Depends on Phase 1's busy ranges. |
| **3: Jobs data model** | Taxonomy tables, `job_postings`, backfill from the description parser (idempotent, logged, blob kept as fallback), `create_job_listing` extended to write structured fields plus drafts/close. | The foundation for every Jobs improvement. |
| **4: Jobs search and discovery** | Vocabulary seed, `search_jobs_v2` with filters and sort, filter sheet, rebuilt detail page, company profile via `businesses`. | Needs Phase 3 data. |
| **5: Application lifecycle** | Status expansion plus transition trigger, events, withdraw, notes, interviews, notifications, seeker timeline, employer pipeline. | Independent of search; can run in parallel with 4 if needed. |
| **6: Seeker tools** | Preferences, job alerts, deterministic recommendations, profile completeness. | Needs structured jobs (3) and the vocabulary (4). |
| **7: Employer workspace** | Dashboard, multi-step post form with preview, duplicate/repost, candidate search on the vocabulary. | Builds on 3–5. |
| **8: Trust and safety** | Job scam heuristics (fees requested, WhatsApp-only, salary outliers) flagged to moderation, duplicate detection (same employer, title and city within 14 days), auto-close past `closes_at`, rental reviews gated on completion, report reasons for jobs and candidates. | Needs the structured data. |
| **9: Web parity** | Port the changed flows to `jobs.html`/`rentals.html`/`rental-fleet.html`, or keep the web read-only and point to the app for transactional flows (your call). | Keeps both clients consistent. |

Monetization (existing rails, no new mechanisms): featured job slots on the existing job credits, recruiter plan gating on the pipeline and candidate search (already partly gated), rental featured slots (exist), and later an optional booking-deposit collection once payments are in scope.

## K. Live verification to run first (read-only)
```sql
-- 1. Confirm specs/registration exposure (expect true = exposed)
select has_column_privilege('anon','public.rental_vehicle_specs','vin','select') as vin_public,
       has_column_privilege('anon','public.rental_vehicle_listings','registration','select') as reg_public;
-- 2. Confirm availability policies (expect only owner/admin)
select policyname, cmd, qual from pg_policies where tablename='rental_vehicle_availability';
-- 3. Size the jobs backfill
select count(*) total, count(*) filter (where description ~* '^(COMPANY|JOB TYPE):') structured
from listings where category='jobs';
-- 4. Application status distribution
select status, count(*) from applications group by 1;
```
