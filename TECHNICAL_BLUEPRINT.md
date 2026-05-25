# PaMarket — Complete Technical Blueprint

---

## 1. APPLICATION CLASSIFICATION

**Type:** Progressive Web App (PWA) — Consumer marketplace for Zimbabwe. Combines classifieds, job board, real-time messaging, identity verification, wallet/payment requests, and paid advertising into one installable mobile-first web app.

**Architecture:** Modular monolith frontend + Backend-as-a-Service. All business logic lives in browser-executed JavaScript modules that communicate directly with Supabase. There is no application server — every client talks to Supabase PostgREST and Supabase Auth directly.

**Frontend:** Vanilla JavaScript (ES6+). No framework. Custom SPA router built on a global `window.H` object. Pages are functions that return HTML strings, injected into a single `<div id="app">`. Navigation uses a `pageStack` array for back/forward.

**Backend:** Supabase (PostgreSQL + PostgREST + GoTrue Auth + Realtime + Storage). Zero custom server code.

**Database:** PostgreSQL via Supabase. Tables accessed directly from the browser via PostgREST REST API using the anon/public key.

**Deployment:** GitHub Pages — static file host. GitHub Actions deploys the `./www` directory on push to `master`. Service worker (`sw.js`) provides offline capability and asset caching.

---

## 2. SUPABASE TABLES & COLUMNS (EXACT NAMES)

### TABLE: listings
- **Columns:** `id`, `seller_id`, `seller_name`, `seller_phone`, `title`, `description`, `price`, `currency`, `category`, `province`, `city`, `suburb`, `photos`, `status`, `boost`, `views`, `created_at`, `negotiable`
- **RLS:** Filtered by `status='active'` for public browsing
- **Operations:** SELECT (order by created_at DESC, limit 200), UPSERT (`saveListingToCloud`), DELETE (`deleteListingFromCloud`, `deleteListing`)

### TABLE: profiles
- **Columns:** `id`, `name`, `phone`, `email`, `avatar`, `verified`, `wallet_usd`, `language`, `role`, `status`, `created_at`, `joined_at`, `bio`, `settings`, `idDocs`, `selfie`, `verification_pending`, `twoFactorSecret`, `twoFactorEnabled`, `banReason`, `banUntil`, `cv`, `job_title`, `skills`, `updated_at`, `blocked_users` (array)
- **Operations:** SELECT (single), UPSERT (auth.js, profile.js), UPDATE (wallet, verification status, password)

### TABLE: conversations
- **Columns:** `id`, `members` (array), `listing_id`, `created_at`
- **Operations:** SELECT contains(members, [userId]), INSERT, UPDATE

### TABLE: messages
- **Columns:** `id`, `conversation_id`, `sender_id`, `sender_name`, `text`, `created_at`, `read`
- **Realtime:** Subscribed via `.on('postgres_changes', {event:'INSERT'...})`
- **Operations:** INSERT (from chat), SELECT order by created_at DESC

### TABLE: paid_ads
- **Columns:** `id`, `type`, `business_name`, `headline`, `tagline`, `image_url`, `bg_color`, `link_url`, `target_cat`, `starts_at`, `ends_at`, `active`, `priority`, `impressions`, `clicks`, `listing_id`
- **Operations:** SELECT (WHERE active=true), UPDATE (impressions, clicks)

### TABLE: app_settings
- **Columns:** `id` (key=1), `settings` (JSON blob)
- **Operations:** SELECT single (id=1)

### TABLE: user_saves
- **Columns:** `user_id`, `listing_id`, `saved_at`
- **Operations:** DELETE, UPSERT

### TABLE: reports
- **Columns:** `id`, `reporter_id`/`reported_by`, `target_type` ('listing', 'user', 'support', 'appeal'), `target_id`, `reason`, `status` ('open', 'resolved', 'closed'), `created_at`
- **Operations:** SELECT (order by created_at DESC, limit 300), INSERT

### TABLE: notifications
- **Columns:** `id`, `user_id`, `title`, `body`, `type`, `read`, `created_at`
- **Note:** `created_at` is **bigint** (Unix milliseconds), NOT timestamptz
- **Realtime:** `.on('postgres_changes', {event:'INSERT', filter:'user_id=eq.X'})`
- **Operations:** SELECT, INSERT, UPDATE (read status)

### TABLE: verifications (optional — wrapped in try/catch)
- **Columns:** `user_id`, `id_doc`, `selfie`, `status` ('pending'), `submitted_at`
- **Operations:** UPSERT (with `onConflict: 'user_id'`)

### TABLE: topup_requests
- **Columns:** `id`, `status` ('approved')
- **Operations:** UPDATE (status='approved')

### TABLE: applications (Jobs feature)
- **Columns:** `id`, `job_id`, `job_title`, `company`, `applicant_id`, `applicant_name`, `applicant_phone`, `applicant_email`, `message`, `status` ('pending'), `employer_id`, `applied_at`
- **Operations:** SELECT (OR conditions), UPSERT, UPDATE (status)

### TABLE: saved_searches
- **Columns:** `user_id`, `query`, `category`
- **Operations:** INSERT

---

## 3. H.STATE STRUCTURE (COMPLETE)

```javascript
H.state = {
  // Core data
  users: [],                          // Local user cache (array of profile objects)
  listings: [],                       // All listings (active + pending + sold)
  conversations: [],                  // Message threads
  reports: [],                        // User/listing reports
  txns: [],                           // Transactions

  // User-specific (keyed by user ID)
  saves: { [userId]: [listingIds] },  // H.state.saves[uid] = ['id1','id2',...]
  notifs: { [userId]: [notifObjs] },  // H.state.notifs[uid] = [{id,t,title,body,...}]

  // Session
  currentUserId: null,                // UUID of logged-in user
  adminSession: { at, via },          // { at: timestamp, via: 'supabase' }

  // Filtering & UI state
  cityFilter: 'All Zimbabwe',         // Current location filter string
  _sortMode: 'newest',                // 'newest'|'oldest'|'price_asc'|'price_desc'|'views'
  _priceMin: '',                      // String, parsed as float
  _priceMax: '',                      // String, parsed as float

  // Admin
  adminLogs: [],                      // Action audit trail (max 300)
  supportTickets: [],                 // Help requests
  topupRequests: [],                  // Wallet topup queue
  paidAds: [],                        // Active paid advertisements

  // Meta/feature flags
  language: 'English',                // Global default
  signupPaused: false,                // Feature flag
  requireListingApproval: true,       // Moderation flag
  autoApproveVerified: false,         // Quick-approve for verified sellers
  deletedConvIds: [],                 // Soft-deleted conversation IDs
  applications: [],                   // Job applications (synced from cloud)
  savedSearches: {},                  // User saved searches { [userId]: [...] }
}
```

**Conversation object shape:**
```javascript
{
  id: 'conv_abc123_def456_xyz789',    // Deterministic ID
  members: [userId1, userId2],
  listingId: 'listing-uuid',
  messages: [{ id, senderId, senderName, text, t, read }],
  otherName: 'John Buyer',            // Stored at creation for display
}
```

**Notification object shape:**
```javascript
{ id, t: Date.now(), read: false, title, body, type }
```

---

## 4. KEY FUNCTIONS — ALL SIGNATURES & OPERATIONS

### app.js — Core Initialization & Listing Sync

| Function | Purpose | Supabase Operation |
|---|---|---|
| `H.boot()` | App startup, loads listings | SELECT from listings (active, limit 200) |
| `H.fetchListingsFromSupabase()` | Full listings refresh | SELECT * FROM listings WHERE status='active' ORDER BY created_at DESC LIMIT 200 |
| `H.saveListingToCloud(listing)` | Persist new/updated listing | UPSERT listings |
| `H.deleteListingFromCloud(id)` | Remove from cloud | DELETE FROM listings WHERE id=X |
| `H.fetchAdsFromSupabase()` | Load paid ads | SELECT FROM paid_ads WHERE active=true ORDER BY priority |
| `H.fetchAppSettings()` | Load config flags | SELECT FROM app_settings WHERE id=1 SINGLE |
| `H.syncConversations()` | Merge cloud conversations | SELECT FROM conversations CONTAINS members |
| `H.syncReports()` | Load reports & tickets | SELECT FROM reports LIMIT 300 |
| `H.syncApplications()` | Sync job applications | SELECT FROM applications WHERE applicant_id OR employer_id |
| `H._setupRealtimeMessages()` | Subscribe to incoming messages | Channel 'messages-rt' on INSERT to messages |
| `H.trackAdImpression(id)` | Increment ad view counter | UPDATE paid_ads SET impressions=X WHERE id=Y |
| `H.trackAdClick(id, url)` | Log ad click & redirect | UPDATE paid_ads SET clicks=X WHERE id=Y |
| `H.ensureConversationInCloud(conv)` | Sync conversation header | UPSERT conversations (id, members, listing_id) |
| `H.saveMessageToCloud(convId, msg)` | Persist message | INSERT messages (id, conversation_id, sender_id, sender_name, text, created_at) |
| `H.saveApplicationToCloud(app)` | Persist job application | UPSERT applications |
| `H.updateApplicationStatusCloud(appId, status)` | Update application state | UPDATE applications SET status WHERE id=appId |

### auth.js — Authentication & Profile Loading

| Function | Details |
|---|---|
| `H.authStepEmail()` | Render email/Google login form |
| `H.authStepSignUp()` | Render registration form |
| `H.authSignIn()` | `auth.signInWithPassword({email, password})` → calls `H.loadProfile(userId)` |
| `H.authSignUp()` | `auth.signUp({email, password, options:{data:{full_name}}})` then `profiles.upsert({id, name, phone})` |
| `H.loadProfile(userId)` | `profiles.select('*').eq('id',userId).single()` → merges into H.state.users |
| `H.logout()` | Clear currentUserId, call `auth.signOut()`, reload page |
| `H.authGoogle()` | OAuth via `auth.signInWithOAuth({provider:'google'})` |
| `H.authApple()` | OAuth via `auth.signInWithOAuth({provider:'apple'})` |
| `H.authAdminSignInPage()` | Admin-only route, validates role='admin' |
| `H.authShow2FA(userId)` | Prompt for TOTP code validation |
| `H.authVerify2FA()` | TOTP verification against `u.twoFactorSecret` |
| `H.authShowOtp(email)` | Email OTP prompt |
| `H.authVerifyOtp()` | `auth.verifyOtp({email, token, type:'signup'})` |
| `H.authSendReset()` | `auth.resetPasswordForEmail(email)` |
| `H.authDoSetPassword()` | `auth.updateUser({password})` |

**Rate Limiting:** Max 5 failed attempts → 30-second lockout stored in `sessionStorage`

### wallet.js / ads.js — Listing Creation

| Function | Details |
|---|---|
| `pages.AdsCreate({category})` | Render ad creation form |
| `H._adsCreate.submit()` | Set status='pending', ID=uid(), save to H.state.listings, call saveListingToCloud() |
| `H._adv.deleteAd(id)` | Filter from H.state.listings, call deleteListingFromCloud() |
| `H.openBoostPage(listingId)` | Navigate to boost selection |

**Ad Creation State (`_cs`):**
```javascript
_cs = { cat, title, desc, price, currency, company, prov, city, suburb, contact, photos }
```

### messages.js — Chat & Conversations

| Function | Supabase Operation |
|---|---|
| `H.syncConversations()` | SELECT FROM conversations WHERE members contains userId |
| `H.startChatWith(otherId, listingId)` | Create conv if not exists, call ensureConversationInCloud() |
| `H.sendChat()` | Append local, INSERT INTO messages, call pushNotif() |
| `H._deleteConversation(convId)` | Add to H.state.deletedConvIds (soft delete only) |
| `H._chat.blockUser(userId)` | Add to H.currentUser().blockedUsers array |
| `H._chat.reportUser(userId)` | INSERT INTO reports |

**Deterministic Conversation ID Formula:**
```javascript
'conv_' + [uid1,uid2].sort()[0].slice(-6) + '_' + [uid1,uid2].sort()[1].slice(-6) + '_' + listingId.slice(-6)
```

**Realtime Message Subscription:**
```javascript
channel('messages-rt').on('postgres_changes', {
  event: 'INSERT',
  table: 'messages'
}, payload => { /* append to conv.messages */ })
```

### detail.js — Listing Display & Actions

| Function | Details |
|---|---|
| `H.toggleSave(id)` | UPSERT/DELETE user_saves, updates H.state.saves[userId] |
| `H.deleteListing(id)` | DELETE FROM listings WHERE id=id |
| `H.reportListing(id)` | INSERT INTO reports (target_type='listing') |
| `H.reportUser(id)` | INSERT INTO reports (target_type='user') |
| `H.openPhotoViewer(photos, idx)` | Pinch-zoom, swipe gallery (no DB) |
| `H.startChatWith(sellerId, listingId)` | Opens in-app chat |

### profile.js — User Profiles

| Function | Supabase Operation |
|---|---|
| `H._editProfile.save()` | UPSERT profiles (name, phone, bio, avatar, updated_at) |
| `H._editProfile.deleteCV()` | UPDATE profiles (cv=null, job_title=null, skills=null) |
| `H._editProfile.deleteAccount()` | Filter user from state.users, call auth.signOut() |
| `H._myListings.markSold(id)` | UPDATE listings (status='sold', soldAt) |
| `H._myListings.reactivate(id)` | UPDATE listings (status='active') |

### verify.js — Identity Verification

| Function | Supabase Operation |
|---|---|
| `H._verify.submitForReview()` | UPSERT verifications + UPDATE profiles (verification_pending=true) |
| `H._verify.cancelPending()` | UPDATE profiles (verification_pending=false) |

### notifications.js — Notifications

| Function | Supabase Operation |
|---|---|
| `H.pushNotif(uid, title, body, type)` | INSERT notifications (created_at: Date.now() — bigint) |
| `H.syncNotifications()` | SELECT notifications WHERE user_id=uid ORDER BY created_at DESC LIMIT 100 |
| `H.markNotifRead(notifId)` | UPDATE notifications (read=true) WHERE id |
| `H.markAllNotifsRead()` | UPDATE notifications (read=true) WHERE user_id |
| `H._setupRealtimeNotifs()` | Channel subscribe: `filter: 'user_id=eq.' + userId` |

---

## 5. NAVIGATION PATTERNS

### `H.navTo(name, btn)` — Root-level tabs
- Pages: `'Home'`, `'Browse'`, `'Messages'`, `'Post'`, `'Account'`
- Auth-gated: `['Post', 'Messages']`

### `H.openInner(name, params)` — Modal/inner pages
Auth-gated inner pages:
```
Messages, Chat, MyListings, Favorites, Profile, EditProfile, Settings,
Ads, AdsCreate, AdsBoost, AdsContact, MyAds, Wallet, Boost, Security,
SecuritySettings, DeleteAccount, TopUp, JobSeekerProfile, CandidateProfile,
AppliedJobs, JobApplications, PostJob
```

### `H.goBack()` — Pop pageStack, restore scroll, clear camera stream

---

## 6. USER FLOWS

### Flow 1: User Signup
1. Account tab → Sign In → "Create Account"
2. Form: name, phone, email, password
3. Validation: email regex, Zimbabwe phone `/^(\+263|0)[0-9]{9}$/`, password (min 8 + uppercase + number/special)
4. `supabase.auth.signUp()` → OTP email sent
5. `profiles.upsert({id, name, phone, role:'user', status:'active', wallet_usd:0})`
6. OTP verified → session established
7. `H.loadProfile(userId)` → `H.state.currentUserId` set → `H.boot()` re-runs

### Flow 2: Post a Listing
1. Tap "+" → auth gate → `openInner('AdsCreate', {category})`
2. Fill form → tap Submit:
   - Generates `id = H.uid()`, sets `status: 'pending'`
   - Pushes to `H.state.listings[]`
   - `listings.upsert(listing)` → Supabase
3. If `requireListingApproval = true` → toast "Your ad will go live after admin review"
4. Admin approves → `listings.update({status:'active'})` + notification to seller
5. Listing appears in Home/Browse feed

### Flow 3: Submit Identity Verification
1. Account → Verify Identity
2. Step 1: Upload ID doc → base64 → stored in `u.idDocs` (localStorage)
3. Step 2: Take selfie via `getUserMedia()` → base64 → stored in `u.selfie`
4. Step 3: Submit:
   - `verifications.upsert({user_id, id_doc, selfie, status:'pending'}, {onConflict:'user_id'})`
   - If table missing → error caught silently → photos NOT saved (known bug)
   - `profiles.update({verification_pending:true})`
5. Admin sees user in Verifications tab (may see name only, no photos if table missing)
6. Admin approves → `profiles.update({verified:true, verification_pending:false})` + notification

### Flow 4: Buyer Messages Seller
1. Open listing → tap "Message in App"
2. `H.startChatWith(seller.id, listing.id)`:
   - Deterministic `convId` generated
   - `conversations.upsert({id, members, listing_id})`
3. Buyer sends message:
   - Appended to local `c.messages[]` and DOM directly
   - `messages.upsert({id, conversation_id, sender_id, sender_name, text, created_at, read:false})`
4. Seller's realtime channel fires INSERT → appended to their conversation
5. Unread badge updates on Messages tab

### Flow 5: Admin Sends Notification
1. Admin opens Send Notification tab → selects user(s) → fills title + message
2. `notifications.insert([{user_id, title, body, type, read:false, created_at: Date.now()}])`
   - `created_at` MUST be `Date.now()` (bigint milliseconds) — NOT ISO string
3. Target users see notification via realtime channel or next sync

### Flow 6: Admin Reviews Listing
1. Admin logs into admin.html → Listings tab → filter "Pending"
2. `loadListings()` → `listings.select(*)` (requires admin RLS policy)
3. Admin taps Approve → `listings.update({status:'active'})` + notification to seller
4. Listing visible in app feed within next poll/refresh

---

## 7. API STRUCTURE

**Base URL:** `https://gxgytumhknmnwspxjzxw.supabase.co`

### PostgREST Endpoints

| Table | Method | Auth | Notes |
|---|---|---|---|
| `listings?status=eq.active` | GET | No | Public read |
| `listings` | POST/PATCH/DELETE | Yes | Owner or admin |
| `profiles?id=eq.X` | GET | Yes | Own or admin |
| `profiles` | POST (upsert) | Yes | Own only |
| `messages?conversation_id=eq.X` | GET | Yes | Participant or admin |
| `messages` | POST | Yes | `sender_id = auth.uid()` |
| `conversations` | GET/POST | Yes | Member of conversation |
| `verifications` | POST (upsert) | Yes | `user_id = auth.uid()` |
| `paid_ads?active=eq.true` | GET | No | Public |
| `notifications` | POST | Yes | Admin for bulk |
| `notifications?user_id=eq.X` | GET | Yes | Own |
| `reports` | POST | Yes | Any authenticated |
| `topup_requests` | GET/PATCH | Yes | Admin only |
| `applications` | GET/POST | Yes | Participant |

### Auth Endpoints (GoTrue)
```
POST /auth/v1/signup
POST /auth/v1/token?grant_type=password
POST /auth/v1/logout
POST /auth/v1/otp
POST /auth/v1/verify
POST /auth/v1/recover
PUT  /auth/v1/user
GET  /auth/v1/user
```

### Realtime (WebSocket)
```
wss://gxgytumhknmnwspxjzxw.supabase.co/realtime/v1/websocket
```
- Channel `messages-rt`: `postgres_changes` INSERT on `messages`
- Channel `notifications:{userId}`: INSERT on `notifications` filtered by `user_id`

---

## 8. PAID ADS COLUMN MAPPING

Critical: DB uses snake_case, app state uses camelCase.

| DB Column | State Field | Notes |
|---|---|---|
| `business_name` | `businessName` | |
| `image_url` | `imageUrl` | Previously was `image` — caused display bug |
| `bg_color` | `bgColor` | |
| `link_url` | `linkUrl` | |
| `target_cat` | `targetCat` | |
| `starts_at` | `startsAt` | Converted via `.getTime()` |
| `ends_at` | `endsAt` | null → defaults to `9999999999999` |

---

## 9. ADMIN DASHBOARD (admin.html)

Standalone HTML page, separate from PWA. Authenticates independently via Supabase, requires `role='admin'` in profile.

### DATA Object
```javascript
var DATA = {
  users: [], listings: [], verifications: [], reports: [],
  topups: [], ads: [], settings: {}, notifHistory: [], chats: []
};
```

### Tabs & Data Sources

| Tab | Supabase Query | Key Operations |
|---|---|---|
| Overview | Aggregates from DATA arrays | Counts, recent activity |
| Listings | `listings.select(*)` | Approve/reject/delete |
| Users | `profiles.select(*)` (3-tier fallback) | Ban, verify, role change |
| Verifications | `verifications` + `profiles` | Approve/reject ID docs |
| Send Notification | `notifications.insert(...)` | Bulk send |
| Top-ups | `topup_requests.select(*)` | Approve/reject wallet credits |
| Reports | `reports.select('*')` | Review/dismiss |
| Ads & Boosts | `paid_ads.select('*')` | Create/toggle/delete |
| Analytics | Client-side aggregation of DATA | Charts, trends |
| Settings | `app_settings` | Feature flags |

### Users Tab — 3-Tier Fallback Query
```javascript
// Tier 1: Full columns including verification_pending
profiles.select('id,name,email,phone,role,status,verified,verification_pending,banReason,...')

// Tier 2: Without verification_pending (if column missing)
profiles.select('id,name,email,phone,role,status,verified,...')

// Tier 3: Bare minimum
profiles.select('id,name,email,role,status')
```

---

## 10. STATE MANAGEMENT

### Storage
All state persisted via `localStorage` through `H.saveState()` / `H.loadState()`. Entire `H.state` object is JSON-serialized.

**Warning:** Base64 photos (ID docs, selfies) stored in `H.state.users[].idDocs` and `.selfie` can push localStorage toward 5MB limit. `H.saveState()` failure is not caught — state silently not persisted.

### UI Update Patterns

**Pattern A — Full re-render (all pages except Chat):**
```javascript
await supabase.from('X').update({...});
H.state.Y = updatedValue;
H.saveState();
H.renderPage('CurrentPage');
```

**Pattern B — DOM append (Chat page only):**
```javascript
const div = document.createElement('div');
div.innerHTML = escHtml(text);
thread.appendChild(div);
thread.scrollTop = thread.scrollHeight;
```

---

## 11. VALIDATION RULES

| Field | Rule |
|---|---|
| Email | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` |
| Phone (Zimbabwe) | `/^(\+263\|0)[0-9]{9}$/` |
| Password | Min 8 chars + 1 uppercase + (1 number OR 1 special char) |
| Auth attempts | Max 5 failures → 30-second lockout (sessionStorage) |

---

## 12. KNOWN BUGS & WEAK POINTS

### BUG 1 — notifications.js ISO string (FIXED)
`H.pushNotif()` was inserting `created_at: new Date(n.t).toISOString()` into a `bigint` column.
**Fix:** Changed to `created_at: n.t` (Unix milliseconds integer). Fixed in both `admin.html` and `notifications.js`.

### BUG 2 — Admin Listings/Users/Verifications empty (RLS)
Admin portal authenticates as a user with `role='admin'` but uses the anon key. Tables without an admin-bypass RLS policy return 0 rows with no error.

**SQL fix to run in Supabase:**
```sql
CREATE POLICY "admin_read_listings" ON listings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_read_profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_read_verifications" ON verifications
  FOR SELECT TO authenticated USING (true);
```

### BUG 3 — Verification photos silently lost
If the `verifications` table doesn't exist, `verify.js` catches the error and silently continues. `profiles.verification_pending = true` is set, so the admin sees the user as pending, but no photos are stored.

**Fix:** Create the `verifications` table in Supabase:
```sql
CREATE TABLE verifications (
  user_id uuid PRIMARY KEY REFERENCES profiles(id),
  id_doc text,
  selfie text,
  status text DEFAULT 'pending',
  submitted_at timestamptz DEFAULT now(),
  admin_note text
);
```

### BUG 4 — 200-listing hard cap
`fetchListingsFromSupabase` uses `.limit(200)`. Listings 201+ are permanently invisible. No pagination or infinite scroll exists.

### BUG 5 — Base64 photos filling localStorage
ID docs and selfies stored as base64 in H.state. A photo can be 300–800KB. Two photos can reach 1.6MB. With conversation history, localStorage quota (5MB on iOS Safari) can be exhausted silently.

### BUG 6 — Deterministic conversation ID collisions
`convId` uses the last 6 characters of each user ID and listing ID. Two different listings with the same last 6 characters share the same conversation thread.

### BUG 7 — No server-side validation
All validation is client-side JavaScript. Direct PostgREST calls bypass all validation (negative prices, empty titles, invalid phones).

### BUG 8 — No admin service role
Admin uses anon key through RLS — not the service role key. Any table without an explicit admin policy blocks admin reads/writes silently.

---

## 13. MONITORING AGENTS NEEDED (PRIORITY ORDER)

| # | Agent | What it Monitors | Why Critical |
|---|---|---|---|
| 1 | Admin Access Validator | DATA.users.length > 0, DATA.listings.length > 0 after admin login | Root cause of most admin complaints |
| 2 | Verification Flow Tracer | verifications row exists + profile.verification_pending=true after submit | Blocking user badge feature |
| 3 | Schema Drift Detector | JS column names vs information_schema.columns | Source of silent failures |
| 4 | Notification Pipeline Monitor | Insert success rate, created_at type correctness | Admin's primary communication tool |
| 5 | Listing Visibility Agent | Listing lifecycle: pending → active → appears in feed | Core marketplace function |
| 6 | RLS Auditor | Per-table: anon reads only public, admin reads all | Systemic root cause |
| 7 | Messaging Integrity Agent | Message persistence + realtime delivery < 5s | Core chat feature |
| 8 | State Size Monitor | JSON.stringify(H.state).length > 3MB alert | Prevents localStorage corruption |
| 9 | Paid Ad Pipeline Monitor | Ad creation → display in app | Revenue feature |

---

## 14. PROJECT INFO

- **Supabase Project:** `gxgytumhknmnwspxjzxw.supabase.co`
- **GitHub Pages URL:** Served from `./www` directory on `master` branch
- **Service Worker Cache:** `pamarket-v53` (increment version string to force cache clear)
- **Font:** Inter (Google Fonts)
- **Build year:** © 2026 PaMarket
- **Offline support:** Service worker caches all JS/CSS/HTML on first load

---

*Generated: 2026-05-25*
