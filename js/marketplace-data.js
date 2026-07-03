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

  // ── Rental vehicle listings ───────────────────────────────────────
  function fetchRentalListings(opts) {
    opts = opts || {};
    var qp = ['status=eq.active', 'admin_status=eq.approved', 'deleted_at=is.null'];
    qp.push(
      'select=id,model,year,daily_rate,weekly_rate,monthly_rate,pickup_suburb,company_id,is_available,' +
        'rental_brands(label),rental_categories(label),' +
        'rental_vehicle_media(url,is_cover,sort_order),' +
        'rental_companies(trading_name)'
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

  // Best-effort impression/click tracking. The anon website key cannot UPDATE
  // paid_ads (admin-write RLS), so tracking from the public site is a no-op at
  // the DB level today; kept as a single call site so a future PostgREST RPC
  // (security definer increment, like the app's listing-view RPC) can wire in
  // without touching every page. Returns a resolved promise so callers are safe.
  function trackAdEvent(/* id, kind */) {
    return Promise.resolve();
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
  global.PM.fetchRentalListings = fetchRentalListings;
  global.PM.fetchRentalListingById = fetchRentalListingById;
  global.PM.fetchProfileById = fetchProfileById;
  global.PM.fetchBusinesses = fetchBusinesses;
  global.PM.fetchBusinessById = fetchBusinessById;
  global.PM.fetchJobs = fetchJobs;
  global.PM.fetchActiveAds = fetchActiveAds;
  global.PM.trackAdEvent = trackAdEvent;
  global.PM.money = money;
  global.PM.timeAgo = timeAgo;
})(window);
