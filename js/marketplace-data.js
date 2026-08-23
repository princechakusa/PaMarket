// Public, read-only PaMarket marketplace data layer.
// Talks directly to Supabase PostgREST with the anon key — same pattern as delete-account.html.
// No supabase-js needed for simple selects/filters.
(function (global) {
  var sharedClient = global.PMSupabaseClient && global.PMSupabaseClient.get();
  var SB_URL = sharedClient ? sharedClient.url : global.SUPABASE_URL;
  var SB_KEY = sharedClient ? sharedClient.publishableKey : global.SUPABASE_ANON_KEY;

  function pgFetch(path, token) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + (token || SB_KEY) },
    }).then(function (res) {
      if (!res.ok) throw new Error('Supabase request failed: ' + res.status);
      return res.json();
    });
  }

  function esc(v) {
    return encodeURIComponent(v);
  }

  // POST to a PostgREST RPC (security-definer function). Best-effort; never throws.
  function pgRpc(fn, body) {
    return fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    }).catch(function () {});
  }

  // ── General listings (public.listings) ──────────────────────────
  // opts: { category, q, province, city, limit, offset, order }
  function fetchListings(opts) { return global.PMListings.fetchListings(opts); }
  function fetchListingById(id) { return global.PMListings.fetchListingById(id); }
  function fetchSimilarListings(category, excludeId, limit) { return global.PMListings.fetchSimilarListings(category, excludeId, limit); }
  function fetchListingCount(category) { return global.PMListings.fetchListingCount(category); }

  // Generic exact-count helper for real homepage/trust stats — table plus a
  // raw PostgREST filter string, e.g. fetchExactCount('businesses','status=eq.active').
  function fetchExactCount(table, filter, column) {
    var qp = [filter, 'select=' + (column || 'id'), 'limit=0'].filter(Boolean);
    return fetch(SB_URL + '/rest/v1/' + table + '?' + qp.join('&'), {
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    }).then(function (res) {
      var range = res.headers.get('content-range');
      var total = range && range.indexOf('/') > -1 ? parseInt(range.split('/')[1], 10) : 0;
      return total || 0;
    });
  }

  // ── Rental vehicle listings ───────────────────────────────────────
  function fetchRentalListings(opts) { return global.PMRentals.fetchRentalListings(opts); }
  function fetchRentalListingById(id) { return global.PMRentals.fetchRentalListingById(id); }

  // ── Job listings (category = 'jobs' on public.listings) ──────────
  function jobFilters(opts) {
    var qp = ['status=eq.active', 'expires_at=gt.' + esc(new Date().toISOString()), 'category=eq.jobs'];
    if (opts.q) qp.push('title=ilike.*' + esc(opts.q) + '*');
    if (opts.city) qp.push('city=ilike.*' + esc(opts.city) + '*');
    if (opts.province) qp.push('province=ilike.*' + esc(opts.province) + '*');
    return qp;
  }
  var JOB_SELECT = 'select=id,title,price,currency,city,province,attributes,created_at,seller_name,featured_until,expires_at';

  function fetchJobs(opts) {
    opts = opts || {};
    var limit = opts.limit || 12;
    var qp = jobFilters(opts);
    qp.push(JOB_SELECT);
    qp.push('order=' + (opts.order || 'created_at.desc'));
    qp.push('limit=' + limit);
    var base = pgFetch('listings?' + qp.join('&'));
    // Boosted job posts rank first — same paid placement as fetchListings.
    if (!opts.featuredFirst || opts.order) return base;
    var fqp = jobFilters(opts);
    fqp.push('featured_until=gt.' + encodeURIComponent(new Date().toISOString()));
    fqp.push(JOB_SELECT);
    fqp.push('order=featured_until.desc');
    fqp.push('limit=' + limit);
    return Promise.all([pgFetch('listings?' + fqp.join('&')).catch(function () { return []; }), base])
      .then(function (results) {
        var featured = results[0] || [], rest = results[1] || [];
        var seen = {};
        featured.forEach(function (l) { seen[l.id] = true; });
        return featured.concat(rest.filter(function (l) { return !seen[l.id]; })).slice(0, limit);
      });
  }

  // ── Public user profiles (public.profiles_public) ─────────────────
  function fetchProfileById(id) { return global.PMProfiles.fetchProfileById(id); }

  // ── Business shops (public.businesses) ────────────────────────────
  function fetchBusinesses(opts) { return global.PMBusinesses.fetchBusinesses(opts); }

  // Not-yet-active businesses (pending_activation/draft/suspended) are only
  // visible to their owner or a moderator — enforced by the businesses RLS
  // policy (status='active' OR owner_user_id=auth.uid() OR is_admin()). That
  // policy can only recognise the caller as the owner if the request carries
  // their own access token, so a signed-in viewer's session token is used
  // when available; anonymous visitors fall back to the anon key, which RLS
  // limits to active rows only.
  function fetchBusinessById(id) { return global.PMBusinesses.fetchBusinessById(id); }

  // Reviews for a seller (a business's owner_user_id). Real user-generated
  // reviews only — used for the business profile rating + review list and its
  // AggregateRating/Review JSON-LD. Returns [] when the seller has none.
  function fetchSellerReviews(sellerId, limit) {
    if (!sellerId) return Promise.resolve([]);
    return pgFetch(
      'reviews?seller_id=eq.' + esc(sellerId) +
        '&select=reviewer_id,reviewer_name,rating,body,created_at&order=created_at.desc&limit=' +
        (limit || 20)
    ).catch(function () { return []; });
  }

  // ── Advertisements (public.paid_ads) ──────────────────────────────
  // Same live table the app renders, so an ad an admin activates (e.g. on
  // behalf of a rental company) appears on the website too — no separate ad
  // store, no hardcoded banners. Filters to currently-active ads: active=true
  // AND (starts_at is null OR starts_at <= now) AND (ends_at is null OR
  // ends_at >= now). PostgREST cannot express the null-or-compare in one param,
  // so the date-window filtering is finished client-side after the active fetch.
  // opts: { placement, limit }
  function fetchActiveAds(opts) {
    opts = opts || {};
    var qp = ['active=eq.true'];
    if (opts.placement) qp.push('target_section=eq.' + esc(opts.placement));
    qp.push('select=id,headline,image_url,link_url,target_section,starts_at,ends_at');
    qp.push('order=created_at.desc');
    qp.push('limit=' + (opts.limit || 10));
    return pgFetch('paid_ads?' + qp.join('&')).then(function (rows) {
      var now = Date.now();
      return (rows || []).filter(function (a) {
        var startsOk = !a.starts_at || new Date(a.starts_at).getTime() <= now;
        var endsOk = !a.ends_at || new Date(a.ends_at).getTime() >= now;
        return startsOk && endsOk;
      });
    });
  }

  // Impression/click tracking via security-definer RPCs (add_ad_tracking_rpc.sql).
  // The anon key cannot UPDATE paid_ads directly (admin-write RLS); these RPCs
  // increment the counters safely. Best-effort — never blocks the UI.
  // kind: 'impression' | 'click'
  function trackAdEvent(id, kind) {
    if (!id) return Promise.resolve();
    var fn = kind === 'click' ? 'track_ad_click' : 'track_ad_impression';
    return pgRpc(fn, { p_ad_id: id });
  }

  // ── Session-aware access (Phase D) ────────────────────────────────
  // js/session.js is the website's single source of truth for the Supabase
  // session. When present, its current access_token lets PostgREST/RLS treat
  // the request as that user (needed for private account data and own listings).
  function sharedSession() {
    return global.PMSession && typeof global.PMSession.getSession === 'function'
      ? global.PMSession.getSession()
      : null;
  }

  // Latest public site announcement. RLS enforces active state and the
  // starts_at/ends_at window for anonymous and authenticated visitors.
  function fetchActiveSiteAnnouncement() {
    return pgFetch(
      'site_announcements?is_active=eq.true' +
      '&select=id,message,link_url,link_label,starts_at,ends_at' +
      '&order=created_at.desc&limit=1'
    ).then(function (rows) { return rows[0] || null; });
  }

  function fetchPublishedBlogVideos() {
    return pgFetch(
      'blog_videos?is_published=eq.true' +
      '&select=id,title,description,provider,embed_id,sort_order,created_at' +
      '&order=sort_order.asc,created_at.desc&limit=100'
    );
  }
  function authHeaders() {
    var h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
    var s = sharedSession();
    if (s && s.access_token) h.Authorization = 'Bearer ' + s.access_token;
    return h;
  }

  // Coarse public moderation state for an old /detail URL whose listing is no
  // longer publicly visible. Uses the read-only security-definer RPC so the
  // page can show the right message WITHOUT exposing any private listing data
  // and WITHOUT bypassing row visibility. Returns one of:
  // 'active' | 'review' | 'removed' | 'sold' | 'unavailable' (falls back to
  // 'unavailable' on any error).
  function fetchListingState(id) {
    if (!id) return Promise.resolve('unavailable');
    return fetch(SB_URL + '/rest/v1/rpc/listing_public_state', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: String(id) }),
    }).then(function (res) {
      if (!res.ok) return 'unavailable';
      return res.json();
    }).then(function (v) {
      return (typeof v === 'string' && v) ? v : 'unavailable';
    }).catch(function () { return 'unavailable'; });
  }

  // Fetch a listing the current viewer owns, regardless of moderation status.
  // Sent with the user's token so RLS returns the row only when the caller is
  // the seller (or it is active). Non-owners get null. Used to show sellers the
  // status of their own under-review / flagged / removed listing (Phase D #6).
  function fetchOwnListingById(id) {
    var s = sharedSession();
    if (!id || !s || !s.access_token) return Promise.resolve(null);
    return fetch(SB_URL + '/rest/v1/listings?id=eq.' + esc(id) + '&select=*', {
      headers: authHeaders(),
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (rows) {
      return (rows && rows[0]) || null;
    }).catch(function () { return null; });
  }

  function currentUserId() {
    var s = sharedSession();
    return (s && s.user && s.user.id) || null;
  }

  // Submit a content report to the EXISTING reports table (no separate system).
  // Works logged-in (reporter_id = auth.uid()) or anonymously (reporter_id null,
  // which the table's INSERT policy permits). targetType: 'listing' | 'user'.
  function submitReport(opts) {
    opts = opts || {};
    if (!opts.targetType || !opts.targetId || !opts.reason) {
      return Promise.reject(new Error('missing report fields'));
    }
    var s = sharedSession();
    var row = {
      target_type: opts.targetType,
      target_id: String(opts.targetId),
      reason: String(opts.reason),
      status: 'open',
      reporter_id: (s && s.user && s.user.id) || null,
      reported_by: (s && s.user && (s.user.email || s.user.id)) || 'website-anon',
    };
    return fetch(SB_URL + '/rest/v1/reports', {
      method: 'POST',
      headers: Object.assign({ Prefer: 'return=minimal' }, authHeaders()),
      body: JSON.stringify(row),
    }).then(function (res) {
      // 23505 = duplicate report from the same reporter on the same target;
      // treat as success so the user sees "reported" rather than an error.
      if (res.ok || res.status === 409) return true;
      return res.text().then(function (t) {
        if (/duplicate key|23505/i.test(t)) return true;
        throw new Error('report failed: ' + res.status);
      });
    });
  }

  // Submit (or update) a review for a seller, into the EXISTING reviews
  // table (no separate system) — mirrors the app's eligibility rule (one
  // review per reviewer per seller, upserted on resubmit) and its columns.
  // NOTE: the live column is `body`, not `text` (the repo's schema file and
  // the app's own insert code say `text`, but that column does not exist in
  // production — confirmed by testing; using `body` here matches the real
  // table and the existing read path in fetchSellerReviews()).
  function submitReview(sellerId, rating, text) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.reject(new Error('not-authenticated'));
    if (!sellerId) return Promise.reject(new Error('missing seller'));
    var r = Math.round(Number(rating));
    if (!(r >= 1 && r <= 5)) return Promise.reject(new Error('invalid rating'));
    if (String(sellerId) === s.user.id) return Promise.reject(new Error('cannot-review-self'));
    var row = {
      seller_id: String(sellerId),
      reviewer_id: s.user.id,
      reviewer_name: (s.user.user_metadata && s.user.user_metadata.full_name) || (s.user.email || 'User'),
      rating: r,
      body: String(text || '').slice(0, 1000),
    };
    return fetch(SB_URL + '/rest/v1/reviews?on_conflict=seller_id,reviewer_id', {
      method: 'POST',
      headers: Object.assign(
        { Prefer: 'resolution=merge-duplicates,return=minimal' },
        authHeaders()
      ),
      body: JSON.stringify(row),
    }).then(function (res) {
      if (res.ok) return true;
      return res.text().then(function (t) {
        throw new Error('review failed: ' + res.status + ' ' + t);
      });
    });
  }

  // ── Listing creation (website posting) ───────────────────────────
  // Upload one image blob to Cloudflare R2 via the same security-definer
  // edge function the app uses (get-r2-upload-url → presigned PUT → public
  // URL). Requires a signed-in session (RLS: the function checks auth.uid()).
  function uploadListingPhoto(blob, contentType) {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    var userId = (s.user && s.user.id) || 'anon';
    var key = 'listings/' + userId + '/' + Date.now() + '-' +
      Math.random().toString(36).slice(2, 9) + '.jpg';
    return fetch(SB_URL + '/functions/v1/get-r2-upload-url', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, contentType: contentType || 'image/jpeg' }),
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) {
        throw new Error('upload-url: ' + (j.error || res.status));
      });
      return res.json();
    }).then(function (payload) {
      return fetch(payload.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'image/jpeg' },
        body: blob,
      }).then(function (up) {
        if (!up.ok) throw new Error('R2 PUT failed: ' + up.status);
        return payload.publicUrl;
      });
    });
  }

  // Upload a signed-in user's profile photo through the same R2 edge function.
  // Keep this separate from listing uploads so the object key stays inside the
  // server-approved profiles/{auth.uid()}/ prefix. Only the returned hosted
  // URL should ever be persisted to public.profiles.avatar.
  function uploadProfilePhoto(blob, contentType) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user || !s.user.id) {
      return Promise.reject(new Error('not-authenticated'));
    }
    var type = contentType || 'image/jpeg';
    var key = 'profiles/' + s.user.id + '/avatar_' + Date.now() + '.jpg';
    return fetch(SB_URL + '/functions/v1/get-r2-upload-url', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, contentType: type }),
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) {
        throw new Error('upload-url: ' + (j.error || res.status));
      });
      return res.json();
    }).then(function (payload) {
      return fetch(payload.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: blob,
      }).then(function (up) {
        if (!up.ok) throw new Error('R2 PUT failed: ' + up.status);
        return payload.publicUrl;
      });
    });
  }

  // Upload a signed-in user's resume/CV through the same R2 edge function,
  // under the cv/{auth.uid()} prefix it already allow-lists for CVs
  // specifically (get-r2-upload-url/index.ts: "PDF uploads only permitted
  // under cv/ prefix") — same object key scheme the app's Job Seeker Profile
  // uses (www/js/jobs.js), so a CV uploaded on either platform is visible
  // on both. PDF only, matching the edge function's content-type allowlist.
  function uploadCV(blob, filename) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user || !s.user.id) {
      return Promise.reject(new Error('not-authenticated'));
    }
    var key = 'cv/' + s.user.id + '/' + Date.now() + '_' + String(filename || 'resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    return fetch(SB_URL + '/functions/v1/get-r2-upload-url', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, contentType: 'application/pdf' }),
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) {
        throw new Error('upload-url: ' + (j.error || res.status));
      });
      return res.json();
    }).then(function (payload) {
      return fetch(payload.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: blob,
      }).then(function (up) {
        if (!up.ok) throw new Error('R2 PUT failed: ' + up.status);
        return payload.publicUrl;
      });
    });
  }

  // Upload an identity verification document (ID photo or selfie) through
  // the same R2 edge function, under the verification/{auth.uid()} prefix —
  // the ONE prefix get-r2-upload-url deliberately never returns a publicUrl
  // for (isVerification check in that function), since these are private and
  // only ever readable via a signed GET gated to the owner or an admin (see
  // www/js/verify.js H.signedVerificationUrl for the app's read-side
  // equivalent — the website doesn't need a read helper yet since it only
  // submits, it doesn't display the uploaded images back).
  function uploadVerificationDoc(blob, label) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user || !s.user.id) {
      return Promise.reject(new Error('not-authenticated'));
    }
    var type = (blob && blob.type) || 'image/jpeg';
    var key = 'verification/' + s.user.id + '/' + (label || 'doc') + '_' + Date.now() + '.jpg';
    return fetch(SB_URL + '/functions/v1/get-r2-upload-url', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, contentType: type }),
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) {
        throw new Error('upload-url: ' + (j.error || res.status));
      });
      return res.json();
    }).then(function (payload) {
      return fetch(payload.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: blob,
      }).then(function (up) {
        if (!up.ok) throw new Error('R2 PUT failed: ' + up.status);
        return key; // return the object KEY, never a public URL — matches the app's convention
      });
    });
  }

  // Insert a new listing. Mirrors the app's saveListingToCloud column map so
  // both clients write identical rows, and honours the backend Phase A
  // moderation trigger: a prohibited/banned INSERT raises a Postgres error,
  // which we surface as { blocked:true } rather than a generic failure. The
  // trigger may also downgrade status active→flagged; we read it back.
  // opts: { title, description, price, currency, category, province, city,
  //         suburb, photos:[url], attributes:{} }
  function createListing(opts) {
    opts = opts || {};
    var s = sharedSession();
    if (!s || !s.access_token || !s.user || !s.user.id) {
      return Promise.reject(new Error('not-authenticated'));
    }
    var meta = (s.user.user_metadata) || {};
    var row = {
      seller_id: s.user.id,
      // sellerName override lets a job show the company as the employer
      // (or post anonymously) instead of the poster's personal name.
      seller_name: (opts.sellerName && String(opts.sellerName).trim()) || meta.full_name || meta.name || s.user.email || '',
      seller_phone: meta.phone || s.user.phone || '',
      title: String(opts.title || '').trim(),
      description: String(opts.description || '').trim(),
      price: Number(opts.price) || 0,
      currency: opts.currency || 'USD',
      category: opts.category || 'other',
      province: opts.province || '',
      city: opts.city || '',
      suburb: opts.suburb || '',
      photos: Array.isArray(opts.photos) ? opts.photos : [],
      status: 'active',
      views: 0,
      created_at: new Date().toISOString(),
    };
    if (opts.attributes && typeof opts.attributes === 'object') row.attributes = opts.attributes;
    // Screening questions for a job (LinkedIn-style), same jsonb shape the app
    // writes: [{ id, question, type:'text'|'yesno'|'select', options:[], required }].
    if (Array.isArray(opts.customQuestions) && opts.customQuestions.length) row.custom_questions = opts.customQuestions;

    function insert(body) {
      return fetch(SB_URL + '/rest/v1/listings', {
        method: 'POST',
        headers: Object.assign({ Prefer: 'return=representation' }, authHeaders()),
        body: JSON.stringify(body),
      });
    }
    // Strip whichever optional jsonb column the DB complains about (attributes
    // or custom_questions may predate their migrations) and retry, so posting
    // never breaks before a migration lands — same contract as the app.
    function insertWithFallback(body) {
      return insert(body).then(function (res) {
        if (res.ok) return res.json().then(function (rows) { return { ok: true, listing: rows[0] || null }; });
        return res.text().then(function (t) {
          var stripped = Object.assign({}, body);
          var didStrip = false;
          if (body.custom_questions && /custom_questions|column|schema cache|PGRST204/i.test(t)) { delete stripped.custom_questions; didStrip = true; }
          else if (body.attributes && /attributes|column|schema cache|PGRST204/i.test(t)) { delete stripped.attributes; didStrip = true; }
          if (didStrip) return insertWithFallback(stripped);
          throw moderationOrError(t, res.status);
        });
      });
    }
    return insertWithFallback(row);
  }

  // A Phase A moderation block surfaces as a raised exception (P0001 / message
  // mentioning prohibited/suspended/banned). Flag those so the UI can show the
  // real reason instead of a generic error.
  function moderationOrError(text, status) {
    var e = new Error(text || ('insert failed: ' + status));
    if (/prohibited|suspend|banned|blocked|not allowed|P0001|moderation/i.test(text || '')) {
      e.blocked = true;
    }
    e.status = status;
    return e;
  }

  // ── Paynow listing boosts (website checkout) ─────────────────────
  // Prices MUST match the app's Google Play products (www/js/
  // billing-products.js) and the server catalogue (supabase/functions/
  // _shared/paynow.ts) — the server is authoritative; these are for the
  // picker UI only.
  var BOOST_PRODUCTS = [
    { productId: 'boost_1day',  days: 1,  label: '1 day',   tag: '',           priceUsd: 2 },
    { productId: 'boost_7day',  days: 7,  label: '7 days',  tag: 'Popular',    priceUsd: 10 },
    { productId: 'boost_30day', days: 30, label: '30 days', tag: 'Best value', priceUsd: 30 },
  ];
  var JOB_BOOST_PRODUCTS = [
    { productId: 'job_boost_7day',  days: 7,  label: '7 days',  tag: '',           priceUsd: 8 },
    { productId: 'job_boost_30day', days: 30, label: '30 days', tag: 'Best value', priceUsd: 20 },
  ];
  var SLOT_PACK_PRODUCTS = [
    { productId: 'featured_slot_pack_1', extraSlots: 1, label: '+1 slot',  tag: '',           priceUsd: 2 },
    { productId: 'featured_slot_pack_3', extraSlots: 3, label: '+3 slots', tag: 'Best value', priceUsd: 5 },
  ];
  var JOB_CREDIT_PRODUCTS = [
    { productId: 'job_credit_pack_1', credits: 1, label: '1 job post',  tag: '',           priceUsd: 3 },
    { productId: 'job_credit_pack_5', credits: 5, label: '5 job posts', tag: 'Best value', priceUsd: 12 },
  ];

  // Generic Paynow checkout starter. `body` is { productId, listingId? |
  // businessId? } depending on the product. Resolves { paymentId,
  // redirectUrl } — the caller redirects to redirectUrl (Paynow page).
  function createPayment(body) {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/functions/v1/paynow-create-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || !j.ok) throw new Error(j.error || ('payment failed: ' + res.status));
        return j;
      });
    });
  }
  function createBoostPayment(listingId, productId) { return createPayment({ listingId: listingId, productId: productId }); }
  function createSlotPackPayment(businessId, productId) { return createPayment({ businessId: businessId, productId: productId }); }
  function createJobCreditPayment(productId) { return createPayment({ productId: productId }); }

  // Current user's job-credit balance (server-side, auth.uid()-scoped RPC).
  function fetchJobCreditBalance() {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.resolve(0);
    return fetch(SB_URL + '/rest/v1/rpc/get_job_credit_balance', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function (res) { return res.ok ? res.json() : 0; }).then(function (v) { return Number(v) || 0; }).catch(function () { return 0; });
  }

  // ── Job applications (website) ───────────────────────────────────
  // Insert an application for a job. RLS requires applicant_id = auth.uid(),
  // and the table's unique (job_id, applicant_id) blocks duplicates (surfaced
  // as { duplicate:true }). Mirrors the app's applications column map.
  function applyToJob(opts) {
    opts = opts || {};
    var s = sharedSession();
    if (!s || !s.access_token || !s.user || !s.user.id) return Promise.reject(new Error('not-authenticated'));
    var meta = (s.user.user_metadata) || {};
    var row = {
      job_id: opts.jobId,
      job_title: String(opts.jobTitle || '').slice(0, 200),
      company: String(opts.company || '').slice(0, 200),
      applicant_id: s.user.id,
      applicant_name: String(opts.name || meta.full_name || meta.name || '').slice(0, 200),
      applicant_phone: String(opts.phone || meta.phone || s.user.phone || '').slice(0, 60),
      applicant_email: String(opts.email || s.user.email || '').slice(0, 200),
      message: String(opts.message || '').slice(0, 4000),
      employer_id: opts.employerId,
    };
    // Screening-question answers, same jsonb shape the app writes:
    // [{ questionId, question, answer }].
    if (Array.isArray(opts.answers) && opts.answers.length) row.answers = opts.answers;

    function post(body) {
      return fetch(SB_URL + '/rest/v1/applications', {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body),
      }).then(function (res) {
        if (res.ok) return res.json().then(function (rows) { return { ok: true, application: rows[0] || null }; });
        return res.text().then(function (t) {
          if (/duplicate|unique|23505/i.test(t)) return { ok: false, duplicate: true };
          // answers column not migrated yet → retry without it.
          if (body.answers && /answers|column|schema cache|PGRST204/i.test(t)) {
            var bare = Object.assign({}, body); delete bare.answers;
            return post(bare);
          }
          throw new Error(t || ('apply failed: ' + res.status));
        });
      });
    }
    return post(row);
  }

  // ── Seller / owner dashboard ─────────────────────────────────────
  // The signed-in user's dashboard listings across all visible statuses.
  // Soft-deleted rows remain in Postgres for moderation/audit history, but do
  // not belong in the owner's active My Ads view.
  function fetchMyListings() {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.resolve([]);
    return fetch(SB_URL + '/rest/v1/listings?seller_id=eq.' + esc(s.user.id) +
      '&status=neq.deleted&select=id,title,category,price,currency,status,views,boost,featured_until,created_at,photos&order=created_at.desc&limit=200', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });
  }

  // The user's own Paynow payment history (own-read RLS).
  function fetchMyPayments() {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.resolve([]);
    return fetch(SB_URL + '/rest/v1/paynow_payments?user_id=eq.' + esc(s.user.id) +
      '&select=id,product_id,amount_usd,status,created_at,paid_at&order=created_at.desc&limit=100', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });
  }

  // Mark one of the caller's own listings sold (RLS: owner update only).
  function markListingSold(listingId) {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/rest/v1/listings?id=eq.' + esc(listingId), {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'sold' }),
    }).then(function (res) {
      if (res.ok) return res.json().then(function (rows) { return { ok: true, listing: rows[0] || null }; });
      return res.text().then(function (t) { throw new Error(t || ('update failed: ' + res.status)); });
    });
  }

  // Owner-scoped listing mutations. RLS remains the authority; the explicit
  // seller_id filter also prevents an accidental broad update in the browser.
  function updateListing(listingId, patch) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.reject(new Error('not-authenticated'));
    var allowed = ['title','description','category','subcategory','price','currency','condition','province','city','suburb','phone','whatsapp','photos','attributes','custom_questions','status'];
    var body = {};
    allowed.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(patch || {}, key)) body[key] = patch[key]; });
    if (!Object.keys(body).length) return Promise.reject(new Error('no-valid-fields'));
    return fetch(SB_URL + '/rest/v1/listings?id=eq.' + esc(listingId) + '&seller_id=eq.' + esc(s.user.id), {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    }).then(function (res) {
      if (res.ok) return res.json().then(function (rows) { return { ok: true, listing: rows[0] || null }; });
      return res.text().then(function (t) { throw new Error(t || ('update failed: ' + res.status)); });
    });
  }

  function setListingStatus(listingId, status) {
    var valid = { active: 1, paused: 1, sold: 1, deleted: 1 };
    if (!valid[status]) return Promise.reject(new Error('invalid-status'));
    return updateListing(listingId, { status: status });
  }

  // Soft-delete preserves the listing for moderation/audit history.
  function deleteListing(listingId) { return setListingStatus(listingId, 'deleted'); }

  // ── Favourites ──────────────────────────────────────────────────
  // ── Saved searches ──────────────────────────────────────────────
  // ── Website notification centre ────────────────────────────────
  function listNotifications() {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.resolve([]);
    return fetch(SB_URL + '/rest/v1/notifications?user_id=eq.' + esc(s.user.id) + '&select=*&order=created_at.desc&limit=200', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { if (!res.ok) throw new Error('notifications-read-failed'); return res.json(); });
  }
  function updateNotification(id, patch) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/rest/v1/notifications?id=eq.' + esc(id) + '&user_id=eq.' + esc(s.user.id), {
      method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).then(function (res) { if (res.ok) return { ok: true }; return res.text().then(function (t) { throw new Error(t || 'notification-update-failed'); }); });
  }
  function markAllNotificationsRead() {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/rest/v1/notifications?user_id=eq.' + esc(s.user.id) + '&read=eq.false', {
      method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }),
    }).then(function (res) { if (res.ok) return { ok: true }; return res.text().then(function (t) { throw new Error(t || 'notifications-update-failed'); }); });
  }

  // Aggregate platform stats for the owner dashboard — returns null for
  // non-admins (the RPC is gated by is_admin() server-side).
  function fetchPlatformStats() {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.resolve(null);
    return fetch(SB_URL + '/rest/v1/rpc/get_platform_stats', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; });
  }

  // The signed-in user's role ('user' | 'admin' | 'moderator'); '' if unknown.
  function currentUserRole() {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.resolve('');
    return fetch(SB_URL + '/rest/v1/profiles?id=eq.' + esc(s.user.id) + '&select=role', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) { return (rows && rows[0] && rows[0].role) || 'user'; }).catch(function () { return ''; });
  }

  // ── Employer applications inbox (website) ────────────────────────
  // Every application to jobs owned by the caller. RLS lets an employer read
  // applications where employer_id = auth.uid(), so this is naturally scoped
  // to the signed-in employer's own postings.
  function fetchApplicationsForEmployer() {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user) return Promise.resolve([]);
    return fetch(SB_URL + '/rest/v1/applications?employer_id=eq.' + esc(s.user.id) +
      '&select=id,job_id,job_title,company,applicant_name,applicant_phone,applicant_email,message,answers,status,applied_at&order=applied_at.desc&limit=1000', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });
  }

  // Employer updates an application's status (pending → shortlisted/declined).
  // RLS "applications: employer update" restricts this to the employer.
  function updateApplicationStatus(applicationId, status) {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/rest/v1/applications?id=eq.' + esc(applicationId), {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status: status }),
    }).then(function (res) {
      if (res.ok) return res.json().then(function (rows) { return { ok: true, application: rows[0] || null }; });
      return res.text().then(function (t) { throw new Error(t || ('update failed: ' + res.status)); });
    });
  }

  // Whether the current user already applied to a job (to pre-disable the form).
  function hasAppliedToJob(jobId) {
    var s = sharedSession();
    if (!s || !s.access_token || !s.user || !jobId) return Promise.resolve(false);
    return fetch(SB_URL + '/rest/v1/applications?job_id=eq.' + esc(jobId) + '&applicant_id=eq.' + esc(s.user.id) + '&select=id', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { return res.ok ? res.json() : []; }).then(function (rows) { return !!(rows && rows.length); }).catch(function () { return false; });
  }

  // Spend one job credit on a listing the caller owns (server-side RPC,
  // guarded by balance + a unique-per-listing constraint). Called right
  // after a job listing is created when the recruiter is over the free
  // post limit. Resolves the RPC's { ok, remaining?, msg? }.
  function spendJobCredit(listingId) {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/rest/v1/rpc/spend_job_credit', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_listing_id: listingId }),
    }).then(function (res) { return res.json().catch(function () { return { ok: false }; }); });
  }

  // Sum of a business's purchased extra featured slots (owner-read RLS).
  function fetchExtraSlotBalance(businessId) {
    var s = sharedSession();
    if (!s || !s.access_token || !businessId) return Promise.resolve(0);
    return fetch(SB_URL + '/rest/v1/featured_slot_packs?business_id=eq.' + esc(businessId) + '&status=eq.consumed&select=extra_slots', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) { return (rows || []).reduce(function (a, r) { return a + (Number(r.extra_slots) || 0); }, 0); })
      .catch(function () { return 0; });
  }

  // Asks the server to re-verify a payment with Paynow. Resolves
  // { state: 'pending'|'boosted'|'slots_added'|'credits_added'|'cancelled'|'failed', ... }.
  function checkBoostPayment(paymentId) {
    var s = sharedSession();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return fetch(SB_URL + '/functions/v1/paynow-check-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: paymentId }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || !j.ok) throw new Error(j.error || ('check failed: ' + res.status));
        return j;
      });
    });
  }

  function money(n, currency) {
    if (global.PMFormat) return global.PMFormat.money(n, currency);
    var num = Number(n) || 0;
    return (currency === 'ZWG' ? 'ZWG ' : '$') + num.toLocaleString();
  }

  function timeAgo(iso) {
    if (global.PMDates) return global.PMDates.timeAgo(iso);
    var d = new Date(iso);
    var diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  global.PM = global.PM || {};
  global.PM.fetchListings = fetchListings;
  global.PM.fetchListingById = fetchListingById;
  global.PM.fetchSimilarListings = fetchSimilarListings;
  global.PM.fetchListingCount = fetchListingCount;
  global.PM.fetchExactCount = fetchExactCount;
  global.PM.fetchRentalListings = fetchRentalListings;
  global.PM.fetchRentalListingById = fetchRentalListingById;
  global.PM.fetchProfileById = fetchProfileById;
  global.PM.fetchBusinesses = fetchBusinesses;
  global.PM.fetchBusinessById = fetchBusinessById;
  global.PM.fetchSellerReviews = fetchSellerReviews;
  global.PM.fetchJobs = fetchJobs;
  global.PM.fetchActiveAds = fetchActiveAds;
  global.PM.fetchActiveSiteAnnouncement = fetchActiveSiteAnnouncement;
  global.PM.fetchPublishedBlogVideos = fetchPublishedBlogVideos;
  global.PM.trackAdEvent = trackAdEvent;
  global.PM.money = money;
  global.PM.timeAgo = timeAgo;
  // Phase D — moderation-aware website helpers.
  global.PM.getSession = sharedSession;
  global.PM.currentUserId = currentUserId;
  global.PM.fetchListingState = fetchListingState;
  global.PM.fetchOwnListingById = fetchOwnListingById;
  global.PM.submitReport = submitReport;
  global.PM.submitReview = submitReview;
  // Website posting (create listing + R2 image upload).
  global.PM.createListing = createListing;
  global.PM.uploadListingPhoto = uploadListingPhoto;
  global.PM.uploadProfilePhoto = uploadProfilePhoto;
  global.PM.uploadCV = uploadCV;
  global.PM.uploadVerificationDoc = uploadVerificationDoc;
  // Paynow checkout (website twin of the app's Play Billing paid features).
  global.PM.BOOST_PRODUCTS = BOOST_PRODUCTS;
  global.PM.JOB_BOOST_PRODUCTS = JOB_BOOST_PRODUCTS;
  global.PM.SLOT_PACK_PRODUCTS = SLOT_PACK_PRODUCTS;
  global.PM.JOB_CREDIT_PRODUCTS = JOB_CREDIT_PRODUCTS;
  global.PM.createPayment = createPayment;
  global.PM.createBoostPayment = createBoostPayment;
  global.PM.createSlotPackPayment = createSlotPackPayment;
  global.PM.createJobCreditPayment = createJobCreditPayment;
  global.PM.checkBoostPayment = checkBoostPayment;
  global.PM.fetchJobCreditBalance = fetchJobCreditBalance;
  global.PM.fetchExtraSlotBalance = fetchExtraSlotBalance;
  global.PM.spendJobCredit = spendJobCredit;
  global.PM.applyToJob = applyToJob;
  global.PM.hasAppliedToJob = hasAppliedToJob;
  global.PM.fetchApplicationsForEmployer = fetchApplicationsForEmployer;
  global.PM.updateApplicationStatus = updateApplicationStatus;
  global.PM.fetchMyListings = fetchMyListings;
  global.PM.fetchMyPayments = fetchMyPayments;
  global.PM.markListingSold = markListingSold;
  global.PM.updateListing = updateListing;
  global.PM.setListingStatus = setListingStatus;
  global.PM.deleteListing = deleteListing;
  global.PM.saveListing = function () { return global.PMSavedContent.saveListing.apply(global.PMSavedContent, arguments); };
  global.PM.unsaveListing = function () { return global.PMSavedContent.unsaveListing.apply(global.PMSavedContent, arguments); };
  global.PM.listFavouriteIds = function () { return global.PMSavedContent.listFavouriteIds.apply(global.PMSavedContent, arguments); };
  global.PM.listFavourites = function () { return global.PMSavedContent.listFavourites.apply(global.PMSavedContent, arguments); };
  global.PM.isListingSaved = function () { return global.PMSavedContent.isListingSaved.apply(global.PMSavedContent, arguments); };
  global.PM.listSavedSearches = function () { return global.PMSavedContent.listSavedSearches.apply(global.PMSavedContent, arguments); };
  global.PM.saveSearch = function () { return global.PMSavedContent.saveSearch.apply(global.PMSavedContent, arguments); };
  global.PM.deleteSavedSearch = function () { return global.PMSavedContent.deleteSavedSearch.apply(global.PMSavedContent, arguments); };
  global.PM.listNotifications = listNotifications;
  global.PM.updateNotification = updateNotification;
  global.PM.markAllNotificationsRead = markAllNotificationsRead;
  global.PM.fetchPlatformStats = fetchPlatformStats;
  global.PM.currentUserRole = currentUserRole;
})(window);
