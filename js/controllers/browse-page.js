/* ============================================================
   browse.html — real Supabase-driven category/listing browser.
   Adapted from this site's existing filtering logic in
   js/services/listings.js + js/taxonomy.js (the same helpers
   index.html uses) into the new visual design. Every count and
   card below is a real live query; there is no fabricated data.

   Extracted from browse.html into this external controller (rather
   than a large inline <script>) to stay within this repo's
   architecture size policy (tools/website-build/validate-architecture.js
   flags any HTML page with more than 8192 bytes of inline JS as a
   new violation) — this file replaces the previous browse-page.js
   controller, which drove the pre-redesign browse.html.

   Adaptations vs the mockup (documented, not fabricated):
   - "Radius slider" dropped — no meaningful geo-radius search
     exists in the schema for most listings (lat/lng mostly null).
   - "Handover & Logistics" checkboxes dropped — no such field
     exists on `listings`.
   - "Seller Verification Status" narrowed to the two states the
     schema actually supports: listings with a business_id
     (posted by a verified business) vs individual seller listings.
   - Category subcategory counts use the real `attributes->>subcat`
     values already used by post-ad.html, not the mockup's invented
     subcategory names/counts.
   ============================================================ */
(function () {
  'use strict';

  window.PMBrowseNav = { toggleMobile: function (btn) {
    var n = document.getElementById('hpMobNav');
    if (!n) return;
    var open = n.classList.toggle('hidden') === false;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }};

  var CAT_LABELS = { property: 'Property', vehicles: 'Vehicles', electronics: 'Electronics & Gadgets', furniture: 'Furniture', fashion: 'Fashion', services: 'Services', agriculture: 'Agriculture', rooms: 'Rooms to Rent', pets: 'Pets', kids: 'Baby & Kids', other: 'Other' };
  var SUBCAT_LABELS = { phones: 'Smartphones & Tablets', computers: 'Laptops & Computers', gaming: 'Gaming & Consoles', cameras: 'Cameras & Audio', tvs: 'TVs & Monitors', accessories: 'Accessories' };
  var CONDITION_LABELS = { 'new': 'Brand New', 'like-new': 'Like New / Refurbished', 'used': 'Pre-Owned / Used' };
  var PAGE_SIZE = 9;
  var ILLUSTRATIVE_ZIG_RATE = 27.42;

  var params = new URLSearchParams(location.search);
  var state = {
    cat: params.get('cat') || '',
    subcat: params.get('sub') || '',
    province: params.get('province') || '',
    city: params.get('city') || '',
    q: params.get('q') || '',
    minPrice: params.get('min') || '',
    maxPrice: params.get('max') || '',
    condition: params.get('condition') || '',
    sellerType: params.get('seller') || '',
    sort: params.get('sort') || 'created_at.desc',
    page: parseInt(params.get('page') || '1', 10) || 1,
    viewMode: params.get('view') || 'grid'
  };
  var lastRows = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function timeAgo(iso) {
    var diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }

  function nowIso() { return encodeURIComponent(new Date().toISOString()); }
  function baseQP() {
    var qp = ['status=eq.active', 'expires_at=gt.' + nowIso()];
    if (state.cat) qp.push('category=eq.' + encodeURIComponent(state.cat));
    if (state.subcat) qp.push('attributes->>subcat=eq.' + encodeURIComponent(state.subcat));
    if (state.province) qp.push('province=ilike.*' + encodeURIComponent(state.province) + '*');
    if (state.city) qp.push('city=ilike.*' + encodeURIComponent(state.city) + '*');
    if (state.q) qp.push('title=ilike.*' + encodeURIComponent(state.q) + '*');
    if (state.minPrice) qp.push('price=gte.' + encodeURIComponent(state.minPrice));
    if (state.maxPrice) qp.push('price=lte.' + encodeURIComponent(state.maxPrice));
    if (state.condition) qp.push('condition=eq.' + encodeURIComponent(state.condition));
    if (state.sellerType === 'business') qp.push('business_id=not.is.null');
    if (state.sellerType === 'individual') qp.push('business_id=is.null');
    return qp;
  }

  function pushUrl() {
    var qs = new URLSearchParams();
    if (params.get('shops')) qs.set('shops', '1');
    if (state.cat) qs.set('cat', state.cat);
    if (state.subcat) qs.set('sub', state.subcat);
    if (state.province) qs.set('province', state.province);
    if (state.city) qs.set('city', state.city);
    if (state.q) qs.set('q', state.q);
    if (state.minPrice) qs.set('min', state.minPrice);
    if (state.maxPrice) qs.set('max', state.maxPrice);
    if (state.condition) qs.set('condition', state.condition);
    if (state.sellerType) qs.set('seller', state.sellerType);
    if (state.sort !== 'created_at.desc') qs.set('sort', state.sort);
    if (state.page > 1) qs.set('page', String(state.page));
    if (state.viewMode && state.viewMode !== 'grid') qs.set('view', state.viewMode);
    var s = qs.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  // withId=true tags the card with a real listing id + coordinates so the
  // Split Map & List view (js/controllers/browse-map.js) can highlight it
  // from a pin click/hover without a second card template. Grid/List views
  // don't pass this — no point paying for unused id/data attributes there.
  function listingCard(l, withId) {
    var img = (l.photos && l.photos[0]) || 'img/icon-512.png';
    var loc = [l.city, l.province].filter(Boolean).join(', ');
    var zig = money(Math.round((Number(l.price) || 0) * ILLUSTRATIVE_ZIG_RATE));
    var condBadge = l.condition && CONDITION_LABELS[l.condition] ? '<span class="absolute top-2 left-2 rounded-full bg-primary text-on-primary text-[10px] font-bold px-2 py-1">' + esc(CONDITION_LABELS[l.condition]) + '</span>' : '';
    var bizBadge = l.business_id ? '<span class="absolute top-2 ' + (condBadge ? 'left-2 mt-6' : 'left-2') + ' rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold px-2 py-1 flex items-center gap-1"><span class="pm-material text-[11px]">verified</span>Verified Business</span>' : '';
    var idAttrs = withId ? ' id="pm-map-card-' + esc(l.id) + '" data-listing-id="' + esc(l.id) + '"' + (l.latitude != null && l.longitude != null ? ' data-lat="' + esc(l.latitude) + '" data-lng="' + esc(l.longitude) + '"' : '') : '';
    return '' +
      '<a href="detail.html?id=' + encodeURIComponent(l.id) + '"' + idAttrs + ' class="group rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">' +
        '<div class="relative aspect-[4/3] bg-surface-container">' +
          '<img src="' + img + '" alt="' + esc(l.title) + '" loading="lazy" class="w-full h-full object-cover">' +
          condBadge + bizBadge +
          '<button type="button" aria-label="Save to favourites" onclick="event.preventDefault()" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/90 flex items-center justify-center text-on-surface-variant"><span class="pm-material text-[18px]">favorite_border</span></button>' +
          (loc ? '<span class="absolute bottom-2 left-2 rounded-full bg-on-background/70 text-inverse-on-surface text-[10px] font-semibold px-2 py-1">' + esc(loc) + '</span>' : '') +
        '</div>' +
        '<div class="p-3 flex flex-col flex-1">' +
          '<div class="flex items-center justify-between text-[11px] text-on-surface-variant mb-1"><span>' + esc(l.seller_name || 'PaMarket seller') + '</span><span>' + timeAgo(l.created_at) + '</span></div>' +
          '<h3 class="text-body-md font-body-md font-semibold text-on-background line-clamp-2 min-h-[2.5em]">' + esc(l.title) + '</h3>' +
          '<div class="mt-2 rounded-lg bg-surface-container px-3 py-2">' +
            '<div class="text-price-primary font-price-primary text-on-background">' + esc(l.currency || 'USD') + ' ' + money(l.price) + '</div>' +
            '<div class="text-price-secondary font-price-secondary text-on-surface-variant">≈ ZiG ' + zig + ' (illustrative)</div>' +
          '</div>' +
          '<div class="mt-2 grid grid-cols-2 gap-2">' +
            '<a href="https://wa.me/?text=' + encodeURIComponent('Hi, I saw "' + l.title + '" on PaMarket: https://pamarketzw.com/detail.html?id=' + l.id) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="rounded-lg bg-primary text-on-primary text-label-sm font-label-sm py-2 text-center">WhatsApp Seller</a>' +
            '<a href="detail.html?id=' + encodeURIComponent(l.id) + '" onclick="event.stopPropagation()" class="rounded-lg border border-outline-variant text-label-sm font-label-sm py-2 text-center flex items-center justify-center"><span class="pm-material text-[16px]">call</span></a>' +
          '</div>' +
        '</div>' +
      '</a>';
  }

  function renderChips() {
    var chips = [];
    if (state.province) chips.push(['Province: ' + state.province, function () { state.province = ''; refreshAll(); }]);
    if (state.city) chips.push(['City: ' + state.city, function () { state.city = ''; refreshAll(); }]);
    if (state.cat) chips.push([CAT_LABELS[state.cat] || state.cat, function () { state.cat = ''; state.subcat = ''; refreshAll(); }]);
    if (state.subcat) chips.push([SUBCAT_LABELS[state.subcat] || state.subcat, function () { state.subcat = ''; refreshAll(); }]);
    if (state.minPrice || state.maxPrice) chips.push(['USD ' + (state.minPrice || '0') + '–' + (state.maxPrice || '∞'), function () { state.minPrice = ''; state.maxPrice = ''; refreshAll(); }]);
    if (state.condition) chips.push([CONDITION_LABELS[state.condition] || state.condition, function () { state.condition = ''; refreshAll(); }]);
    if (state.sellerType) chips.push([state.sellerType === 'business' ? 'Verified Business Sellers' : 'Individual Sellers', function () { state.sellerType = ''; refreshAll(); }]);
    if (state.q) chips.push(['"' + state.q + '"', function () { state.q = ''; refreshAll(); }]);

    var row = document.getElementById('filterChipsRow');
    if (!chips.length) { row.innerHTML = ''; return; }
    window.__pmChipHandlers = chips.map(function (c) { return c[1]; });
    row.innerHTML = chips.map(function (c, i) {
      return '<button type="button" onclick="window.__pmChipHandlers[' + i + ']()" class="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-label-sm font-label-sm text-on-surface-variant hover:bg-surface-container-high">' + esc(c[0]) + ' <span class="pm-material text-[14px]">close</span></button>';
    }).join('') + '<button type="button" onclick="PMBrowse.resetFilters()" class="text-label-sm font-label-sm text-primary font-semibold ml-1">Reset All</button>';
  }

  function renderHeading(total) {
    var h1 = document.getElementById('pageH1');
    var crumbCat = document.getElementById('crumbCat');
    var crumbLocWrap = document.getElementById('crumbLocWrap');
    var crumbLoc = document.getElementById('crumbLoc');
    var catLabel = CAT_LABELS[state.cat] || (state.cat ? state.cat : 'All Listings');
    var locLabel = state.city || state.province || '';
    var title = catLabel + (locLabel ? ' in ' + locLabel : ' in Zimbabwe');
    h1.textContent = title;
    crumbCat.textContent = catLabel;
    if (locLabel) { crumbLocWrap.classList.remove('hidden'); crumbLocWrap.classList.add('flex'); crumbLoc.textContent = locLabel; }
    else { crumbLocWrap.classList.add('hidden'); }

    document.title = title + ' — PaMarket Zimbabwe';
    document.getElementById('pageTitle').textContent = title + ' — PaMarket Zimbabwe';
    var desc = 'Browse ' + total.toLocaleString() + ' real, live ' + catLabel.toLowerCase() + ' listings' + (locLabel ? ' in ' + locLabel : ' across Zimbabwe') + ' on PaMarket — no listing fees, no commission.';
    document.getElementById('metaDesc').setAttribute('content', desc);
    document.getElementById('ogTitle').setAttribute('content', title + ' — PaMarket Zimbabwe');
    document.getElementById('ogDesc').setAttribute('content', desc);
    document.getElementById('twTitle').setAttribute('content', title + ' — PaMarket Zimbabwe');
    document.getElementById('twDesc').setAttribute('content', desc);

    var start = total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
    var end = Math.min(total, state.page * PAGE_SIZE);
    document.getElementById('resultsSummary').textContent = total === 0 ? 'No listings match these filters yet.' : ('Showing ' + start + '–' + end + ' of ' + total.toLocaleString() + ' verified listings');
  }

  function renderPagination(total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    var row = document.getElementById('paginationRow');
    if (pages <= 1) { row.innerHTML = ''; return; }
    var html = '';
    html += '<button type="button" ' + (state.page <= 1 ? 'disabled' : '') + ' onclick="PMBrowse.goPage(' + (state.page - 1) + ')" class="rounded-full border border-outline-variant px-3 py-2 text-label-sm font-label-sm disabled:opacity-40">Previous</button>';
    html += '<span class="text-body-sm font-body-sm text-on-surface-variant">Page ' + state.page + ' of ' + pages + ' (' + total.toLocaleString() + ' total)</span>';
    html += '<button type="button" ' + (state.page >= pages ? 'disabled' : '') + ' onclick="PMBrowse.goPage(' + (state.page + 1) + ')" class="rounded-full border border-outline-variant px-3 py-2 text-label-sm font-label-sm disabled:opacity-40">Next</button>';
    row.innerHTML = html;
  }

  function fetchTotal() {
    return window.PMServiceTransport.exactCount('listings?' + baseQP().join('&'));
  }

  function fetchPage() {
    var qp = baseQP().slice();
    qp.push('select=id,title,price,currency,category,province,city,photos,created_at,condition,business_id,seller_name,latitude,longitude');
    qp.push('order=' + state.sort);
    qp.push('limit=' + PAGE_SIZE);
    qp.push('offset=' + ((state.page - 1) * PAGE_SIZE));
    return window.PMServiceTransport.fetchJson('listings?' + qp.join('&'));
  }

  // Businesses/"Shops" mode (browse.html?shops=1) — linked from index.html's
  // nav ("Businesses") and footer ("Verified Business Storefronts"). The
  // mockup screenshot for this page only covered the category/listing view,
  // so this reuses the same real businesses query index.html already uses
  // (js/services/businesses.js) rendered into the same grid area, with the
  // location/category/price/condition filters hidden since they don't apply
  // to businesses.
  function businessCard(b) {
    var loc = [b.city, b.province].filter(Boolean).join(', ');
    var verified = Number(b.verification_level) >= 2;
    return '' +
      '<a href="business.html?id=' + encodeURIComponent(b.id) + '" class="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col">' +
        '<div class="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant font-bold text-lg">' + esc((b.name || '?').trim().charAt(0).toUpperCase()) + '</div>' +
        (verified ? '<span class="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold px-2 py-1"><span class="pm-material text-[12px]">verified</span>Verified Merchant</span>' : '') +
        '<h3 class="mt-2 text-headline-sm font-headline-sm text-on-background">' + esc(b.name) + '</h3>' +
        '<p class="text-body-sm font-body-sm text-on-surface-variant">' + esc(loc || 'Zimbabwe') + '</p>' +
        '<p class="mt-1 text-body-sm font-body-sm text-on-surface-variant flex-1 line-clamp-2">' + esc(b.description || '') + '</p>' +
        '<span class="mt-3 rounded-lg bg-on-background text-inverse-on-surface text-label-sm font-label-sm py-2 text-center">Visit Store</span>' +
      '</a>';
  }

  function refreshShops() {
    document.getElementById('filtersSidebar').classList.add('hidden');
    document.getElementById('pageH1').textContent = 'Verified Business Storefronts in Zimbabwe';
    document.getElementById('crumbCat').textContent = 'Verified Businesses';
    document.title = 'Verified Business Storefronts — PaMarket Zimbabwe';
    document.getElementById('pageTitle').textContent = 'Verified Business Storefronts — PaMarket Zimbabwe';
    // Businesses have no lat/lng in this schema — the map view mode only
    // applies to real listings, so hide it rather than show an empty map.
    var vmg = document.getElementById('viewModeGroup');
    if (vmg) vmg.classList.add('hidden');
    var split = document.getElementById('mapSplitView');
    if (split) split.classList.add('hidden');
    var grid = document.getElementById('resultsGrid');
    grid.classList.remove('hidden');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-base';
    grid.innerHTML = '<div class="col-span-full text-center text-body-sm text-on-surface-variant py-space-lg">Loading businesses…</div>';
    document.getElementById('paginationRow').innerHTML = '';
    window.PMBusinesses.fetchBusinesses({ q: state.q, limit: 60 }).then(function (rows) {
      rows = rows || [];
      document.getElementById('resultsSummary').textContent = rows.length + ' verified business' + (rows.length === 1 ? '' : 'es') + ' on PaMarket';
      grid.innerHTML = rows.length ? rows.map(businessCard).join('') :
        '<div class="col-span-full text-center text-body-sm text-on-surface-variant py-space-lg">No verified storefronts yet. <a class="text-primary font-semibold" href="open-shop.html">Open a free shop →</a></div>';
    }).catch(function () {
      grid.innerHTML = '<div class="col-span-full text-center text-body-sm text-on-surface-variant py-space-lg">Could not load businesses right now.</div>';
    });
  }

  function refreshResults() {
    if (params.get('shops')) { refreshShops(); return; }
    var grid = document.getElementById('resultsGrid');
    grid.innerHTML = '<div class="col-span-full text-center text-body-sm text-on-surface-variant py-space-lg">Loading listings…</div>';
    Promise.all([fetchTotal(), fetchPage()]).then(function (r) {
      var total = r[0], rows = r[1] || [];
      lastRows = rows;
      renderHeading(total);
      renderPagination(total);
      grid.innerHTML = rows.length ? rows.map(function (l) { return listingCard(l, false); }).join('') :
        '<div class="col-span-full text-center text-body-sm text-on-surface-variant py-space-lg">No listings match these filters yet. Try widening your search or <a class="text-primary font-semibold" href="post-ad.html">post the first one</a>.</div>';
      if (state.viewMode === 'split' && window.PMBrowseMap) window.PMBrowseMap.render(rows, listingCard);
    }).catch(function () {
      grid.innerHTML = '<div class="col-span-full text-center text-body-sm text-on-surface-variant py-space-lg">Could not load listings right now. Please try again shortly.</div>';
    });
  }

  function catCountQP(cat, subcat) {
    var qp = ['status=eq.active', 'expires_at=gt.' + nowIso()];
    if (cat) qp.push('category=eq.' + encodeURIComponent(cat));
    if (subcat) qp.push('attributes->>subcat=eq.' + encodeURIComponent(subcat));
    return qp.join('&');
  }

  function renderCategoryTree() {
    var cats = Object.keys(CAT_LABELS);
    Promise.all(cats.map(function (c) { return window.PMServiceTransport.exactCount('listings?' + catCountQP(c)); })).then(function (counts) {
      var tree = document.getElementById('categoryTree');
      tree.innerHTML = cats.map(function (c, i) {
        var active = state.cat === c;
        return '<button type="button" onclick="PMBrowse.setCategory(\'' + c + '\')" class="flex items-center justify-between rounded-lg px-2 py-1.5 text-left ' + (active ? 'bg-primary-fixed text-on-primary-fixed-variant font-semibold' : 'hover:bg-surface-container') + '"><span>' + esc(CAT_LABELS[c]) + '</span><span class="text-on-surface-variant">' + counts[i] + '</span></button>';
      }).join('');
      renderSubcatTree();
    }).catch(function () {});
  }

  function renderSubcatTree() {
    var wrap = document.getElementById('subcatTree');
    if (state.cat !== 'electronics') { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
    var subs = Object.keys(SUBCAT_LABELS);
    Promise.all(subs.map(function (s) { return window.PMServiceTransport.exactCount('listings?' + catCountQP('electronics', s)); })).then(function (counts) {
      wrap.classList.remove('hidden');
      wrap.innerHTML = subs.map(function (s, i) {
        if (!counts[i]) return '';
        var active = state.subcat === s;
        return '<button type="button" onclick="PMBrowse.setSubcat(\'' + s + '\')" class="flex items-center justify-between rounded-lg px-2 py-1 text-left ' + (active ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-background') + '"><span>' + esc(SUBCAT_LABELS[s]) + '</span><span>' + counts[i] + '</span></button>';
      }).join('');
    }).catch(function () {});
  }

  function renderConditionChecks() {
    var conds = Object.keys(CONDITION_LABELS);
    Promise.all(conds.map(function (c) {
      var qp = ['status=eq.active', 'expires_at=gt.' + nowIso(), 'condition=eq.' + encodeURIComponent(c)];
      if (state.cat) qp.push('category=eq.' + encodeURIComponent(state.cat));
      return window.PMServiceTransport.exactCount('listings?' + qp.join('&'));
    })).then(function (counts) {
      var wrap = document.getElementById('conditionChecks');
      wrap.innerHTML = conds.map(function (c, i) {
        var checked = state.condition === c;
        return '<label class="flex items-center gap-2"><input type="checkbox" class="pm-checkbox" ' + (checked ? 'checked' : '') + ' onchange="PMBrowse.setCondition(\'' + c + '\', this.checked)"><span>' + esc(CONDITION_LABELS[c]) + '</span><span class="ml-auto text-on-surface-variant text-body-sm">' + counts[i] + '</span></label>';
      }).join('');
    }).catch(function () {});
  }

  function renderSellerType() {
    var qpBiz = ['status=eq.active', 'expires_at=gt.' + nowIso(), 'business_id=not.is.null'];
    var qpInd = ['status=eq.active', 'expires_at=gt.' + nowIso(), 'business_id=is.null'];
    if (state.cat) { qpBiz.push('category=eq.' + encodeURIComponent(state.cat)); qpInd.push('category=eq.' + encodeURIComponent(state.cat)); }
    Promise.all([window.PMServiceTransport.exactCount('listings?' + qpBiz.join('&')), window.PMServiceTransport.exactCount('listings?' + qpInd.join('&'))]).then(function (r) {
      var wrap = document.getElementById('sellerTypeRadios');
      var opts = [['', 'All Sellers', r[0] + r[1]], ['business', 'Verified Business Sellers', r[0]], ['individual', 'Individual Sellers', r[1]]];
      wrap.innerHTML = opts.map(function (o) {
        var checked = state.sellerType === o[0];
        return '<label class="flex items-center gap-2"><input type="radio" name="sellerType" class="pm-checkbox" ' + (checked ? 'checked' : '') + ' onchange="PMBrowse.setSellerType(\'' + o[0] + '\')"><span>' + esc(o[1]) + '</span><span class="ml-auto text-on-surface-variant text-body-sm">' + o[2] + '</span></label>';
      }).join('');
    }).catch(function () {});
  }

  function renderPriceQuickButtons() {
    var opts = [[0, 50, '$0 – $50'], [50, 200, '$50 – $200'], [200, 1000, '$200 – $1,000'], [1000, '', '$1,000+']];
    var wrap = document.getElementById('priceQuickButtons');
    wrap.innerHTML = opts.map(function (o) {
      var active = String(state.minPrice) === String(o[0]) && String(state.maxPrice) === String(o[1]);
      return '<button type="button" onclick="PMBrowse.setPriceRange(' + o[0] + ',\'' + o[1] + '\')" class="rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + (active ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container') + '">' + o[2] + '</button>';
    }).join('');
  }

  function syncFormFields() {
    var fp = document.getElementById('fProvince'), fc = document.getElementById('fCity');
    if (fp) fp.value = state.province;
    if (fc) fc.value = state.city;
    document.getElementById('fMinPrice').value = state.minPrice;
    document.getElementById('fMaxPrice').value = state.maxPrice;
    document.getElementById('sortSelect').value = state.sort;
  }

  function refreshAll() {
    pushUrl();
    if (params.get('shops')) { refreshResults(); return; }
    syncFormFields();
    renderChips();
    renderCategoryTree();
    renderConditionChecks();
    renderSellerType();
    renderPriceQuickButtons();
    refreshResults();
  }

  // Toggles between the 3 view modes wired to the pill buttons in
  // browse.html's control bar: 'split' (real map + condensed list, reusing
  // the same card renderer via renderCard/PMBrowseMap), 'grid' (existing
  // grid) and 'list' (existing single-column layout — no separate list-only
  // template was worth building, this just reuses the grid's own 1-col
  // class, same as the pre-existing viewListBtn behaviour did).
  function applyViewMode() {
    var grid = document.getElementById('resultsGrid');
    var split = document.getElementById('mapSplitView');
    if (!grid || !split) return;
    var mode = state.viewMode || 'grid';
    var btnIds = { split: 'viewSplitBtn', grid: 'viewGridBtn', list: 'viewListBtn' };
    Object.keys(btnIds).forEach(function (m) {
      var b = document.getElementById(btnIds[m]);
      if (!b) return;
      var active = m === mode;
      b.className = 'flex items-center gap-1.5 px-3 h-9 ' + (active ? 'bg-primary text-on-primary' : 'text-on-surface-variant');
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (mode === 'split') {
      grid.classList.add('hidden');
      split.classList.remove('hidden');
      if (window.PMBrowseMap) {
        window.PMBrowseMap.render(lastRows, listingCard);
        window.PMBrowseMap.invalidateSize();
      }
    } else {
      split.classList.add('hidden');
      grid.classList.remove('hidden');
      grid.className = 'grid gap-space-base ' + (mode === 'list' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    }
  }

  window.PMBrowse = {
    renderCard: listingCard,
    setViewMode: function (mode) {
      state.viewMode = mode;
      pushUrl();
      applyViewMode();
    },
    applyFilters: function () {
      state.province = document.getElementById('fProvince').value;
      state.city = document.getElementById('fCity').value;
      state.minPrice = document.getElementById('fMinPrice').value;
      state.maxPrice = document.getElementById('fMaxPrice').value;
      state.page = 1;
      refreshAll();
    },
    resetFilters: function () {
      state = { cat: '', subcat: '', province: '', city: '', q: '', minPrice: '', maxPrice: '', condition: '', sellerType: '', sort: 'created_at.desc', page: 1 };
      refreshAll();
    },
    setCategory: function (c) { state.cat = state.cat === c ? '' : c; state.subcat = ''; state.page = 1; refreshAll(); },
    setSubcat: function (s) { state.subcat = state.subcat === s ? '' : s; state.page = 1; refreshAll(); },
    setCondition: function (c, checked) { state.condition = checked ? c : ''; state.page = 1; refreshAll(); },
    setSellerType: function (t) { state.sellerType = t; state.page = 1; refreshAll(); },
    setPriceRange: function (min, max) { state.minPrice = String(min); state.maxPrice = String(max); state.page = 1; refreshAll(); },
    goPage: function (p) { state.page = Math.max(1, p); window.scrollTo({ top: 0, behavior: 'smooth' }); refreshAll(); }
  };

  window.PMHeaderSearch = function () {
    var cat = document.getElementById('hpCat'), prov = document.getElementById('hpProvince'), q = document.getElementById('hpQ');
    if (cat && cat.value === 'jobs') { window.location.href = 'jobs.html' + (q && q.value ? '?q=' + encodeURIComponent(q.value) : ''); return; }
    state.cat = cat ? cat.value : state.cat;
    state.province = prov ? prov.value : state.province;
    state.q = q ? q.value : state.q;
    state.page = 1;
    refreshAll();
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('sortSelect').addEventListener('change', function () { state.sort = this.value; state.page = 1; refreshAll(); });
    applyViewMode();
    document.getElementById('hpQ').value = state.q;
    // Re-scope the city select to the chosen province once real provinces load.
    document.getElementById('fProvince').addEventListener('change', function () {
      var val = this.value;
      window.PMTaxonomy && window.PMTaxonomy.fetchCities(val || null).then(function (opts) {
        if (opts) window.PMTaxonomy.populateSelect(document.getElementById('fCity'), opts);
      });
    });
    refreshAll();
  });
})();
