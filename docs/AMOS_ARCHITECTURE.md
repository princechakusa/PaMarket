# AMOS — AI Marketing Operating System — Architecture

**Status:** Approved and in active build-out. Modules 0-4 shipped (see §9 roadmap for per-module status); Module 5 onward proceeding autonomously per approved architecture, stopping only for the four conditions defined at the start of that work phase (major security risk, destructive migration, architecture cannot support a requirement, missing external credential).
**Scope:** Full system design — services, agents, database schema, workflows, admin UI, integrations, security, rollout plan.
**Fits into:** the existing PaMarket stack (Supabase Postgres + Edge Functions, `www/admin.html` single-file admin panel, `pg_cron` + `pg_net` scheduling, manual SQL migrations). AMOS is additive — it does not replace or fork any of that, it's a new set of tables, edge functions, and one admin tab layered on top, following the same conventions as `ADMIN_ENTERPRISE_V2.sql` and `automation-runner`.

---

## 1. Design principles (carried over from the existing admin platform)

1. **Feature-detecting, additive migrations.** Every AMOS table/RPC is new. Nothing existing is touched. The admin tab and edge functions probe for AMOS tables the same way the panel already does (`hasTable()`) and show a "run the migration" notice if absent.
2. **Manual migrations, by hand, in the SQL Editor.** Per project convention, AMOS ships `.sql` files the user runs manually — never auto-applied. [[project_supabase_migrations_manual]]
3. **Secret-gated cron, not public endpoints.** Every AMOS edge function that runs on a schedule follows the `automation-runner` pattern exactly: `pg_cron` + `pg_net` call it with a Vault-stored shared secret in a custom header; the function 401s without it.
4. **Everything is a draft until approved, unless approval is explicitly turned off.** Publishing is gated by an `approval_required` setting per channel, stored in `app_settings` (already exists) or a new `amos_settings` table.
5. **Every external call fails safely and retries.** No integration is load-bearing for anything else — if Facebook's API is down, SEO content generation and email campaigns are unaffected. Each integration has its own row in a `amos_integrations` health table with `last_success_at`, `last_error`, `consecutive_failures`, feeding a circuit breaker (auto-pause after N consecutive failures, resume on manual re-enable or next successful health check).
6. **One content record, many placements.** A single `amos_content_items` row (say, a "Black Friday sale" idea) can fan out into a Facebook post, an Instagram caption, an X thread, and a push notification — all linked back to the same idea, not independently generated ("repurpose, don't duplicate" per the brief).
7. **Everything auditable.** Every AI-generated draft, every edit, every publish action, every research query is logged, same spirit as the admin panel's `auditLog`.
8. **Country-aware from day one.** Every content/campaign table carries a `country_code` (`ZW` initially), even though only Zimbabwe is active — so expansion to Zambia/Malawi/etc. is a config change, not a schema migration.

---

## 2. System overview

```
                     ┌─────────────────────────────────────────────┐
                     │           Admin Panel (www/admin.html)       │
                     │         New tab: "Marketing / AMOS"           │
                     └───────────────────┬───────────────────────────┘
                                          │ Supabase JS (RLS-checked)
                                          ▼
        ┌────────────────────────────────────────────────────────────┐
        │                    Supabase Postgres                        │
        │  amos_* tables · RPCs · RLS · pg_cron schedules              │
        └───────────────┬────────────────────────────┬─────────────────┘
                         │ pg_net (cron trigger)        │ read/write
                         ▼                              ▼
        ┌───────────────────────────┐      ┌─────────────────────────┐
        │   Edge Functions (Deno)    │      │  Admin panel direct RPC  │
        │  amos-research-runner      │      │  (approve/reject/edit/   │
        │  amos-content-generator    │◄────►│   publish/schedule)      │
        │  amos-publisher            │      └─────────────────────────┘
        │  amos-analytics-collector  │
        └──────────┬──────────────────┘
                    │ outbound (fail-safe, retried, circuit-broken)
                    ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ External APIs: Meta Graph (FB/IG), LinkedIn, TikTok, X, Google    │
   │ Trends/Analytics/Search Console, YouTube, OpenAI, Anthropic,      │
   │ Google Veo/Pika/Runway (video), Canva, Resend, Cloudflare R2      │
   └──────────────────────────────────────────────────────────────────┘
```

Three layers, same split the codebase already uses elsewhere:
- **Postgres** is the source of truth and the scheduler (`pg_cron`), same as `automation-runner`/`job_runs`.
- **Edge Functions** are stateless workers that do the actual research/generation/publishing/collection, secret-gated, retried, logged to `job_runs`-style tables.
- **Admin panel** is the human control surface — approve queue, calendar, dashboards — added as one more tab in the existing single-file panel, not a separate app.

---

## 3. Agents (logical roles, not separate services)

AMOS is not literally 11 different bots — that would mean 11 things to keep alive and debug. It's **one generation pipeline with role-scoped prompts**, matching the brief's list of responsibilities to *prompt profiles*, not infrastructure:

| Agent (role) | Implemented as | Primary inputs | Primary outputs |
|---|---|---|---|
| Trend Researcher | `amos-research-runner` function + `amos_trends` table | Google Trends, Meta/TikTok public trend signals, Zimbabwe news RSS, `search_logs` (already exists — zero-result searches = real user demand) | Ranked `amos_trends` rows with a score and rationale |
| Content Strategist | Planning step inside `amos-content-generator` | Today's trends, content calendar gaps, category performance | `amos_content_items` (the *idea*, platform-agnostic) |
| Copywriter (per platform) | Generation step inside `amos-content-generator`, one prompt profile per platform | A content item + brand voice rules | `amos_content_drafts` (one per platform/placement) |
| Video Producer | `amos-video-brief-generator` (script/storyboard/prompts only — no rendering in-house) | A content item flagged `needs_video` | A structured brief + provider-specific prompts (Veo/Pika/Runway/Canva), stored as a draft type |
| Image Prompt Writer | Same generation step, `image_prompt` draft type | A content item + asset spec (banner/carousel/story/etc.) | Brand-consistent prompt text, not a rendered image (rendering stays manual/Canva until an image API is connected) |
| SEO Manager | `amos-seo-runner` | Category/listing/job/vehicle/property page inventory, Search Console queries (once connected) | `amos_seo_recommendations` (metadata/schema/internal-link suggestions) + blog article drafts |
| Publisher/Scheduler | `amos-publisher` | Approved drafts + `amos_schedule` | Actual API calls to each platform; writes `amos_publish_log` |
| Analytics Collector | `amos-analytics-collector` | Each platform's insights API + PaMarket's own Supabase metrics | `amos_metrics_daily`, feeding the weekly report |
| Reporter | Scheduled job, no new infra | `amos_metrics_daily` aggregated weekly | `amos_reports` row + optional email to the founder |

This keeps the "11 employees" framing of the brief at the *prompt/role* level while keeping the actual system to **5 edge functions**, which is what's operable long-term.

---

## 4. Database schema (Postgres / Supabase)

All new tables prefixed `amos_`, all with `country_code text not null default 'ZW'`, all RLS-locked to admin/service-role only (same guard pattern as `is_admin_team()` in `ADMIN_ENTERPRISE_V2.sql`).

### 4.1 Configuration

**`amos_settings`** (singleton-per-country row)
- `country_code`, `approval_required boolean default true`, `daily_batch_enabled boolean`, `posting_hours jsonb` (per-platform optimal windows), `budget_monthly_cents int`, `brand_voice jsonb` (tone rules from the brief), `updated_by`, `updated_at`

**`amos_integrations`**
- `id`, `provider` (facebook/instagram/linkedin/tiktok/x/google_analytics/gsc/google_trends/youtube/openai/anthropic/veo/pika/runway/canva/resend/r2), `status` (connected/error/disabled), `credentials_ref` (Vault secret name, never the raw key), `last_success_at`, `last_error text`, `consecutive_failures int default 0`, `auto_disabled boolean default false`

### 4.2 Research

**`amos_trends`**
- `id`, `country_code`, `source` (google_trends/facebook/tiktok/reddit/news/internal_search), `topic text`, `score numeric`, `rationale text`, `raw jsonb`, `collected_at`, `expires_at`
- Internal source folds in `search_logs.query` where `result_count = 0` — real unmet demand, already flagged as a gap in the existing Analytics Center doc.

### 4.3 Content pipeline

**`amos_content_items`** (the platform-agnostic idea)
- `id`, `country_code`, `title text`, `category` (marketplace/jobs/vehicles/properties/rentals/brand/seasonal), `trend_id → amos_trends`, `spotlight_listing_id`, `spotlight_business_id`, `spotlight_seller_id`, `status` (idea/drafted/approved/scheduled/published/archived), `created_by` (system/admin_user_id), `created_at`

**`amos_content_drafts`** (one row per placement)
- `id`, `content_item_id → amos_content_items`, `channel` (facebook/instagram/linkedin/x/tiktok/blog/seo_article/push/email/promo), `draft_type` (post/reel_script/story/carousel/thread/article/video_brief/image_prompt/notification/email), `body text`, `media_prompts jsonb`, `hashtags text[]`, `cta text`, `performance_rationale text` (the "why this should perform well," required by the brief), `ai_provider`, `ai_model`, `version int default 1`, `status` (draft/edited/approved/rejected), `reviewed_by`, `reviewed_at`

**`amos_content_revisions`** — append-only history of edits to a draft (who changed what, when), so admin edits aren't destructive.

### 4.4 Scheduling & publishing

**`amos_schedule`**
- `id`, `draft_id → amos_content_drafts`, `scheduled_for timestamptz`, `status` (pending/publishing/published/failed/cancelled), `attempts int default 0`, `last_attempt_at`, `last_error text`

**`amos_publish_log`**
- `id`, `schedule_id`, `channel`, `external_post_id text`, `external_url text`, `published_at`, `raw_response jsonb`

### 4.5 SEO

**`amos_seo_recommendations`**
- `id`, `country_code`, `page_type` (homepage/category/listing/job/vehicle/property/business), `page_ref text`, `recommendation_type` (metadata/schema/internal_link/keyword/backlink/technical), `current_value text`, `suggested_value text`, `status` (open/applied/dismissed), `impact_estimate text`

### 4.6 Analytics & reporting

**`amos_metrics_daily`**
- `id`, `country_code`, `date`, `channel`, `metric` (reach/views/ctr/downloads/installs/retention/conversions/listings_created/active_users/revenue_cents), `value numeric`, `source` (api/internal)

**`amos_reports`**
- `id`, `country_code`, `period_start`, `period_end`, `summary jsonb` (what worked/what failed/why/how to improve — the exact structure the brief asks for), `generated_at`, `emailed_at`

### 4.7 Operational logging

**`amos_job_runs`** — mirrors the existing `job_runs` table exactly (job_name, started_at, finished_at, status, summary jsonb, error text), one row per cron invocation of any `amos-*` function. Reuses the Automation Center's existing UI pattern rather than inventing a new one.

**`amos_audit_log`** — mirrors the admin panel's `auditLog()` calls: `actor` (system or admin_user_id), `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `created_at`.

---

## 5. Workflows

### 5.1 Daily batch (research → draft → queue for approval)
1. `pg_cron` fires `amos-research-runner` once daily (early morning ZW time).
2. It pulls Google Trends (unauthenticated public endpoint / SerpAPI-style scrape — needs a provider decision, see §7), Zimbabwe news RSS, and internal `search_logs` zero-result queries; writes ranked `amos_trends`.
3. `pg_cron` fires `amos-content-generator` ~30 min later.
4. For each of the day's top trends + calendar slots (spotlight seller/listing/business rotate on a fixed schedule so they don't depend on trends), it creates one `amos_content_items` row and generates the full draft set the brief specifies: 1 FB, 1 IG, 1 LinkedIn, 1 X, 1 TikTok idea, 1 blog article, 1 SEO article, 1 push notification, 1 email campaign, 1 promo, 1 marketplace spotlight, 1 seller spotlight, 1 featured listing — each a row in `amos_content_drafts`, each carrying its `performance_rationale`.
5. Drafts land in `status = 'draft'`. If `amos_settings.approval_required = true` (default), nothing publishes until an admin acts. If false, step 6 is automatic.

### 5.2 Approval
1. Admin opens the AMOS tab → Approval Queue.
2. Reviews each draft inline (edit body, regenerate, approve, reject with reason).
3. Approve → `amos_schedule` row created for the platform's next optimal posting window (from `amos_settings.posting_hours`), or immediate if marked urgent.
4. Reject → `amos_content_revisions` logs the reason; optionally triggers regeneration with that feedback folded into the next prompt.

### 5.3 Publishing
1. `pg_cron` fires `amos-publisher` every 15 minutes (same cadence as `automation-runner`).
2. Claims due `amos_schedule` rows (`status='pending' and scheduled_for <= now()`), same claim-and-lock pattern as the existing notification dispatch queue.
3. Calls the relevant platform API. On success: `amos_publish_log` + `status='published'`. On failure: increment `attempts`, backoff, mark `failed` after N tries and surface in the admin Notification Center.
4. Push notifications and emails reuse the **existing** `send-push` function and Resend integration (`_shared/email.ts`) instead of building new senders.

### 5.4 Analytics & weekly report
1. `amos-analytics-collector` runs daily, pulling each connected platform's insights API plus PaMarket's own Supabase counts (downloads via store consoles are manual-entry for now — no public API — see §7).
2. Every Monday, a report job aggregates the prior week into `amos_reports` with the required "what worked / what failed / why / how to improve" structure, and emails it via Resend if `amos_settings` has a recipient set.

### 5.5 Repurposing
`amos_content_items` is the fan-out point: a video brief's script auto-generates a blog-article draft and 3 short-form hooks as *additional drafts on the same content item*, not a new idea — this is what makes "one piece of content becomes multiple" actually happen mechanically rather than by convention.

---

## 6. Admin UI — "Marketing / AMOS" tab

One new tab in `www/admin.html`, lazy-loaded like every other module (per the panel's own principle #1). Sub-views, as tabs-within-the-tab:

1. **Command Center** — today's batch status, integration health strip (green/amber/red per provider), pending-approval count, this week's KPIs at a glance.
2. **Approval Queue** — the daily drafts, grouped by content item, inline edit/approve/reject/regenerate, diff view against the previous revision.
3. **Content Calendar** — month/week view of scheduled + published items across all channels, drag-to-reschedule.
4. **Campaign Manager** — group content items into named campaigns (e.g. "Back to School 2026"), track budget vs `amos_settings.budget_monthly_cents`.
5. **Trend Dashboard** — ranked `amos_trends`, with the internal zero-result-search signal called out separately since it's PaMarket's own proprietary demand signal, not a scrape.
6. **SEO Manager** — `amos_seo_recommendations` list, apply/dismiss actions, links straight to the page.
7. **Analytics & Growth Dashboard** — `amos_metrics_daily` charted, downloads/installs entered manually until store APIs are wired (see §7), weekly report archive.
8. **Competitor Dashboard** — manual-entry + periodic AI-summarized notes for now (no reliable public competitor API for Zimbabwe marketplaces).
9. **Country Selector** — filters every view above by `country_code`; disabled options for unlaunched countries, ready to flip on.
10. **API Manager** — the `amos_integrations` table as a UI: connect/disconnect, health, rotate secret (writes to Vault, never displays the raw key), manual "test connection."
11. **AI Settings** — model/provider choice per generation task (OpenAI vs Anthropic), temperature/tone presets tied to `amos_settings.brand_voice`.
12. **Automation Center (AMOS)** — reuses the exact same `job_runs`-style UI pattern as the existing Automation Center, pointed at `amos_job_runs`, with manual "run now" triggers per function.
13. **Audit Log** — `amos_audit_log`, filterable.

All of it follows the existing panel's non-negotiables: **feature-detect** (`hasTable('amos_content_items')` before rendering, else a "run AMOS_SETUP.sql" notice), **every write RLS-checked + audited**, **destructive actions re-authenticate**.

---

## 7. External integrations — connection plan & known gaps

| Integration | Use | Auth | Notes / gaps |
|---|---|---|---|
| Meta Graph API (FB + IG) | Publish posts/reels/stories, pull insights | OAuth long-lived page token, stored in Vault | Needs a Meta Business app + page admin access — **requires user action**, not buildable blind |
| LinkedIn | Company page posts | OAuth | LinkedIn's API access for company-page posting requires app review — budget lead time |
| TikTok | Posting via Content Posting API | OAuth | TikTok's API has strict app-review + business-account requirements; short-term, TikTok drafts may stay "generate script, post manually" until approved |
| X (Twitter) | Posts/threads | OAuth 2.0 / API key | Paid tier required for posting via API since 2023 — budget decision |
| Google Trends | Research input | No official API — uses unofficial libraries or SerpAPI | Flag as best-effort; internal `search_logs` signal is the reliable fallback |
| Google Analytics / Search Console | Traffic + SEO metrics | OAuth service account | Straightforward once GA/GSC are confirmed set up on the site |
| YouTube | Video metrics, Shorts posting | OAuth | Only needed once video rendering is actually wired (Veo/Pika/Runway are prompt-only in phase 1) |
| OpenAI / Anthropic | Content generation | API key in Vault | Both supported per-task via `amos_settings`/AI Settings tab; Anthropic Claude is the default per this being a Claude-run system |
| Google Veo / Pika / Runway / Canva | Video/image generation | API key (where available) or manual (Canva has no reliable public creation API — [[project_marketing_campaign]] already hit this quota wall) | Phase 1 ships **prompts only**; actual rendering stays a manual step until/unless a provider's API is confirmed usable |
| Resend | Email sending | Already integrated (`_shared/email.ts`) | Reuse, don't rebuild |
| Cloudflare R2 | Media asset storage for generated images/video | Already integrated (`get-r2-upload-url`) | Reuse, don't rebuild |
| Firebase Cloud Messaging | Push notifications | Already integrated (`send-push`) | Reuse, don't rebuild |
| App Store / Play Console download stats | Growth metrics | No simple public API for either | Manual entry into `amos_metrics_daily` via a small admin form, phase 1 |

**Every integration is optional at the schema level.** `amos_content_generator` produces the draft regardless of whether a channel is connected; `amos-publisher` simply can't push it live until `amos_integrations.status = 'connected'` for that provider, and the admin UI makes that obvious rather than failing silently.

---

## 8. Security model

- **RLS on every `amos_*` table**, admin-team-only, reusing the existing `is_admin_team()` guard function — no new auth system.
- **No raw API keys in the database.** `amos_integrations.credentials_ref` points to a Supabase Vault secret name; edge functions read the secret server-side only.
- **Cron endpoints are secret-gated**, identical to `automation-runner`: `x-automation-secret`-style header checked against a Vault-stored value, 401 otherwise, never a public/anonymous-callable endpoint.
- **CORS locked to `pamarketzw.com`** on any function that could theoretically be browser-reachable, matching the existing pattern; cron-only functions accept no browser origin at all.
- **Publish actions are logged and attributable** — even in auto-publish mode, every `amos_publish_log` row traces back to the draft, the content item, and (if human-edited) the admin who touched it.
- **Circuit breaker on outbound calls** — `amos_integrations.consecutive_failures` auto-disables a provider after a threshold (e.g. 5) to stop hammering a broken/rate-limited API, surfaced as a red status in API Manager, manual re-enable.
- **Role permissions** reuse the admin panel's existing role matrix (Security Center) — AMOS actions (approve/publish/edit budget) get their own permission keys rather than a blanket "admin" check, so a support-only admin can't accidentally publish.
- **Least privilege for AI providers** — content-generation calls send only the minimal context needed (trend text, content item metadata), never raw user PII, matching PaMarket's existing privacy posture.

---

## 9. Implementation roadmap

Each module below is a self-contained increment — built, tested, and shipped one at a time per your instruction, in this order because each one unblocks the next:

**Module 0 — Foundation ✅ shipped**
`AMOS_MODULE_0_FOUNDATION.sql` (all core tables, RLS, `is_admin_team()` reuse), `amos_settings` seeded with `approval_required=true`, "Marketing (AMOS)" admin tab shell with feature-detection notices.

**Module 1 — Research ✅ shipped**
`amos-research-runner` (internal `search_logs` gap analysis + `amos_zw_calendar` upcoming-event signals — zero external auth needed), Market Intelligence Dashboard, daily `pg_cron` schedule, run-status verification layer (`job_runs.started_at`/`trigger_type`).

**Module 2 — Content generation (draft-only, no publishing) ✅ shipped**
`amos-content-generator` producing all 7 placements per topic into `amos_content_drafts`, real Approval Queue (Approve/Edit/Reject), self-reported quality scores, real marketplace categories, `amos_content_feedback` learning-data capture, rate limiting.

**Module 3 — Human-in-the-loop publishing groundwork ✅ shipped**
Publishing Queue (formerly the Content Calendar stub), "Schedule All Approved" per content idea, manual publish confirmation workflow, `amos_publish_audit` timeline, full retry/cancel support. No external platform API calls.

**Module 4 — First live channel ✅ shipped (Facebook connected pending a real Page token)**
`FacebookPublisher` fully implemented against the Meta Graph API, credential storage via Vault-backed `amos_set_integration_credential`/`amos_get_vault_secret` RPCs, API Manager Connect/Disconnect UI. Dispatcher auto-routes to the real adapter only when `amos_integrations.status='connected'`; falls back to manual otherwise — verified safe with Facebook in its real default disconnected state. **Blocked on a real Facebook Page access token** (no such credential exists in this project) — code is production-ready, connect via System Health → API Manager once a token is available.

**Module 5 — Remaining channels ✅ shipped**
`PushPublisher` (fully live — reuses the existing `send-push` function/FCM setup, no new secret needed, ships with a deliberately conservative default audience rather than "all users"), `EmailPublisher` (real Resend integration, blocked on `RESEND_API_KEY` — falls back to manual until set), `InstagramPublisher` (real Graph API wiring sharing Facebook's connection, but Instagram has no text-only post type and AMOS doesn't generate media yet, so it always fails cleanly to manual). **Added along the way, not originally scoped**: a marketing-email unsubscribe mechanism (`marketing_email_opt_out`, per-user unsubscribe tokens, public `amos-unsubscribe` endpoint) — found missing during this module's build and fixed before `EmailPublisher` could responsibly go live, since no such mechanism existed anywhere in this codebase before. LinkedIn/X/TikTok remain stubs — none of their prerequisites (app review, paid API tier) exist yet.

**Module 6 — Analytics & reporting**
`amos-analytics-collector`, `amos_metrics_daily`, Analytics & Growth Dashboard, weekly `amos_reports` + email digest.

**Module 7 — SEO**
`amos-seo-runner`, `amos_seo_recommendations`, SEO Manager tab, GA/GSC integration.

**Module 8 — Campaigns, budget, competitor tracking, country expansion**
Campaign Manager, Budget Tracker, Competitor Dashboard (manual-entry first), Country Selector activated for a second market once Zimbabwe operations are stable.

---

## 10. Open decisions needed before Module 0

1. **AI provider budget** — OpenAI, Anthropic, or both wired simultaneously? (Affects `amos_settings.brand_voice` prompt routing and API Manager scope.)
2. **Meta Business/Page access** — does a PaMarket Facebook Page + Business Manager already exist, or does that need to be created first? Blocks Module 4.
3. **Approval default** — confirm `approval_required = true` at launch (recommended) vs auto-publish from day one.
4. **Who receives the weekly report email** — founder only, or a distribution list?

---

*This document is the baseline for build sign-off. Once approved, work proceeds module by module per §9, each with its own migration file and PR, following the same manual-migration and additive conventions as every other recent change to this codebase.*
