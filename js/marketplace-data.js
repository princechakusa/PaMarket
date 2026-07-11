// Public, read-only PaMarket marketplace data layer.
// Talks directly to Supabase PostgREST with the anon key — same pattern as delete-account.html.
// No supabase-js needed for simple selects/filters.
(function (global) {
  var SB_URL = global.SUPABASE_URL || 'https://gxgytumhknmnwspxjzxw.supabase.co';
  var SB_KEY = global.SUPABASE_ANON_KEY || 'sb_publishable_cf3Z72lUE6PLCb2m42OFLA_znE8JK2r';

  function pgFetch(path) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
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
  function fetchListings(opts) {
    opts = opts || {};
    var qp = ['status=eq.active'];
    if (opts.category) qp.push('category=eq.' + esc(opts.category));
    if (opts.province) qp.push('province=ilike.*' + esc(opts.province) + '*');
    if (opts.city) qp.push('city=ilike.*' + esc(opts.city) + '*');
    if (opts.q) qp.push('title=ilike.*' + esc(opts.q) + '*');
    if (opts.businessId) qp.push('business_id=eq.' + esc(opts.businessId));
    if (opts.sellerId) qp.push('seller_id=eq.' + esc(opts.sellerId));
    if (opts.subcat) qp.push('attributes->>subcat=eq.' + esc(opts.subcat));
    qp.push('select=id,title,price,currency,category,province,city,suburb,photos,created_at,boost');
    qp.push('order=' + (opts.order || 'created_at.desc'));
    qp.push('limit=' + (opts.limit || 24));
    if (opts.offset) qp.push('offset=' + opts.offset);
    return pgFetch('listings?' + qp.join('&'));
  }

  function fetchListingById(id) {
    return pgFetch(
      'listings?id=eq.' + esc(id) + '&status=eq.active&select=*'
    ).then(function (rows) {
      return rows[0] || null;
    });
  }

  function fetchSimilarListings(category, excludeId, limit) {
    return pgFetch(
      'listings?status=eq.active&category=eq.' +
        esc(category) +
        '&id=neq.' +
        esc(excludeId) +
        '&select=id,title,price,currency,category,province,city,photos,created_at&order=created_at.desc&limit=' +
        (limit || 4)
    );
  }

  function fetchListingCount(category) {
    var qp = ['status=eq.active', 'select=id'];
    if (category) qp.push('category=eq.' + esc(category));
    return fetch(SB_URL + '/rest/v1/listings?' + qp.join('&'), {
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    }).then(function (res) {
      var range = res.headers.get('content-range'); // "0-0/1234"
      var total = range && range.indexOf('/') > -1 ? parseInt(range.split('/')[1], 10) : 0;
      return total || 0;
    });
  }

  // Generic exact-count helper for real homepage/trust stats — table plus a
  // raw PostgREST filter string, e.g. fetchExactCount('businesses','status=eq.active').
  function fetchExactCount(table, filter) {
    var qp = [filter, 'select=id'].filter(Boolean);
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
  function fetchRentalListings(opts) {
    opts = opts || {};
    var qp = ['status=eq.active', 'admin_status=eq.approved', 'deleted_at=is.null'];
    var locationEmbed = opts.city ? 'rental_locations!inner(city,province)' : 'rental_locations(city,province)';
    if (opts.city) qp.push('rental_locations.city=ilike.*' + esc(opts.city) + '*');
    qp.push(
      'select=id,model,year,daily_rate,weekly_rate,monthly_rate,pickup_suburb,company_id,is_available,' +
        'rental_brands(label),rental_categories(label),' +
        'rental_vehicle_media(url,is_cover,sort_order),' +
        'rental_companies(trading_name),' +
        locationEmbed
    );
    qp.push('order=' + (opts.order || 'created_at.desc'));
    qp.push('limit=' + (opts.limit || 12));
    if (opts.offset) qp.push('offset=' + opts.offset);
    return pgFetch('rental_vehicle_listings?' + qp.join('&'));
  }

  function fetchRentalListingById(id) {
    return pgFetch(
      'rental_vehicle_listings?id=eq.' +
        esc(id) +
        '&status=eq.active&admin_status=eq.approved&deleted_at=is.null&select=*,' +
        'rental_brands(label),rental_categories(label),rental_locations(city,province),' +
        'rental_vehicle_media(url,is_cover,sort_order),rental_vehicle_specs(*),' +
        'rental_vehicle_features(feature),rental_companies(trading_name,rental_phone,rental_whatsapp)'
    ).then(function (rows) {
      return rows[0] || null;
    });
  }

  // ── Job listings (category = 'jobs' on public.listings) ──────────
  function fetchJobs(opts) {
    opts = opts || {};
    var qp = ['status=eq.active', 'category=eq.jobs'];
    if (opts.q) qp.push('title=ilike.*' + esc(opts.q) + '*');
    if (opts.city) qp.push('city=ilike.*' + esc(opts.city) + '*');
    if (opts.province) qp.push('province=ilike.*' + esc(opts.province) + '*');
    qp.push('select=id,title,price,currency,city,province,attributes,created_at,seller_name');
    qp.push('order=' + (opts.order || 'created_at.desc'));
    qp.push('limit=' + (opts.limit || 12));
    return pgFetch('listings?' + qp.join('&'));
  }

  // ── Public user profiles (public.profiles_public) ─────────────────
  function fetchProfileById(id) {
    return pgFetch(
      'profiles_public?id=eq.' + esc(id) + '&select=*'
    ).then(function (rows) {
      return rows[0] || null;
    });
  }

  // ── Business shops (public.businesses) ────────────────────────────
  function fetchBusinesses(opts) {
    opts = opts || {};
    var qp = ['status=eq.active'];
    if (opts.q) qp.push('name=ilike.*' + esc(opts.q) + '*');
    qp.push('select=id,name,logo,cover,description,category,province,city,verification_level');
    qp.push('order=' + (opts.order || 'created_at.desc'));
    qp.push('limit=' + (opts.limit || 24));
    if (opts.offset) qp.push('offset=' + opts.offset);
    return pgFetch('businesses?' + qp.join('&'));
  }

  function fetchBusinessById(id) {
    return pgFetch(
      'businesses?id=eq.' + esc(id) + '&status=eq.active&select=*'
    ).then(function (rows) {
      return rows[0] || null;
    });
  }

  // Reviews for a seller (a business's owner_user_id). Real user-generated
  // reviews only — used for the business profile rating + review list and its
  // AggregateRating/Review JSON-LD. Returns [] when the seller has none.
  function fetchSellerReviews(sellerId, limit) {
    if (!sellerId) return Promise.resolve([]);
    return pgFetch(
      'reviews?seller_id=eq.' + esc(sellerId) +
        '&select=reviewer_name,rating,body,created_at&order=created_at.desc&limit=' +
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
    if (opts.placement) qp.push('placement=eq.' + esc(opts.placement));
    qp.push('select=id,title,image_url,link_url,placement,starts_at,ends_at');
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
  // The website stores a Supabase auth session under 'pm_session' (written by
  // auth.html / auth-callback.html — same shape session.js reads). When present
  // and unexpired, we send the user's access_token so PostgREST/RLS treats the
  // request as that user (needed for a seller to read their own hidden listing,
  // and to attribute a report to reporter_id = auth.uid()).
  function getSession() {
    try {
      var s = global.localStorage && localStorage.getItem('pm_session');
      if (!s) return null;
      var session = JSON.parse(s);
      if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) return null;
      return session;
    } catch (e) { return null; }
  }
  function authHeaders() {
    var h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
    var s = getSession();
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
    var s = getSession();
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
    var s = getSession();
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
    var s = getSession();
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

  // ── Listing creation (website posting) ───────────────────────────
  // Upload one image blob to Cloudflare R2 via the same security-definer
  // edge function the app uses (get-r2-upload-url → presigned PUT → public
  // URL). Requires a signed-in session (RLS: the function checks auth.uid()).
  function uploadListingPhoto(blob, contentType) {
    var s = getSession();
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

  // Insert a new listing. Mirrors the app's saveListingToCloud column map so
  // both clients write identical rows, and honours the backend Phase A
  // moderation trigger: a prohibited/banned INSERT raises a Postgres error,
  // which we surface as { blocked:true } rather than a generic failure. The
  // trigger may also downgrade status active→flagged; we read it back.
  // opts: { title, description, price, currency, category, province, city,
  //         suburb, photos:[url], attributes:{} }
  function createListing(opts) {
    opts = opts || {};
    var s = getSession();
    if (!s || !s.access_token || !s.user || !s.user.id) {
      return Promise.reject(new Error('not-authenticated'));
    }
    var meta = (s.user.user_metadata) || {};
    var row = {
      seller_id: s.user.id,
      seller_name: meta.full_name || meta.name || s.user.email || '',
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

    function insert(body) {
      return fetch(SB_URL + '/rest/v1/listings', {
        method: 'POST',
        headers: Object.assign({ Prefer: 'return=representation' }, authHeaders()),
        body: JSON.stringify(body),
      });
    }
    return insert(row).then(function (res) {
      if (res.ok) return res.json().then(function (rows) { return { ok: true, listing: rows[0] || null }; });
      return res.text().then(function (t) {
        // attributes column not migrated yet → retry without it so posting
        // never breaks before the migration lands (same fallback as the app).
        if (row.attributes && /attributes|column|schema cache|PGRST204/i.test(t)) {
          var bare = Object.assign({}, row); delete bare.attributes;
          return insert(bare).then(function (r2) {
            if (r2.ok) return r2.json().then(function (rows) { return { ok: true, listing: rows[0] || null }; });
            return r2.text().then(function (t2) { throw moderationOrError(t2, r2.status); });
          });
        }
        throw moderationOrError(t, res.status);
      });
    });
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

  function money(n, currency) {
    var num = Number(n) || 0;
    return (currency === 'ZWG' ? 'ZWG ' : '$') + num.toLocaleString();
  }

  function timeAgo(iso) {
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
  global.PM.trackAdEvent = trackAdEvent;
  global.PM.money = money;
  global.PM.timeAgo = timeAgo;
  // Phase D — moderation-aware website helpers.
  global.PM.getSession = getSession;
  global.PM.currentUserId = currentUserId;
  global.PM.fetchListingState = fetchListingState;
  global.PM.fetchOwnListingById = fetchOwnListingById;
  global.PM.submitReport = submitReport;
  // Website posting (create listing + R2 image upload).
  global.PM.createListing = createListing;
  global.PM.uploadListingPhoto = uploadListingPhoto;
})(window);
