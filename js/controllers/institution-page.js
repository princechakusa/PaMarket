'use strict';
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function initials(name){ return (name||'I').trim().charAt(0).toUpperCase(); }
function qparam(k){ return new URLSearchParams(location.search).get(k); }

var TYPE_LABEL = PMInstitutions.TYPE_LABEL;
var TYPES = PMInstitutions.TYPES;

// Fixed, curated filter chips -- mirrors
// apps/mobile/lib/institution-listing-filters.ts exactly (same keys/labels/
// emoji and the same category mapping), reusing the existing category
// taxonomy verbatim rather than inventing new categories for the website.
var LISTING_FILTERS = [
  { key: 'all', label: 'All Campus Listings', emoji: '🏫' },
  { key: 'accommodation', label: 'Hostel & Room Sharing', emoji: '🏠' },
  { key: 'study-materials', label: 'Textbooks & Notes', emoji: '📚' },
  { key: 'electronics', label: 'Laptops & Gadgets', emoji: '💻' },
  { key: 'furniture', label: 'Furniture', emoji: '🪑' },
  { key: 'fashion', label: 'Fashion & Uniforms', emoji: '👕' },
  { key: 'services', label: 'Tutoring & Services', emoji: '🛠️' },
  { key: 'jobs', label: 'Jobs', emoji: '💼' },
  { key: 'vehicles', label: 'Vehicles', emoji: '🚗' },
  { key: 'free', label: 'Free', emoji: '🆓' },
];
function filterExtraQuery(key){
  switch(key){
    case 'accommodation': return ['category=in.(property,rooms)'];
    case 'study-materials': return ['category=eq.other', 'attributes->>subcat=eq.study-materials'];
    case 'electronics': return ['category=eq.electronics'];
    case 'furniture': return ['category=eq.furniture'];
    case 'fashion': return ['category=eq.fashion'];
    case 'services': return ['category=eq.services'];
    case 'jobs': return ['category=eq.jobs'];
    case 'vehicles': return ['category=eq.vehicles'];
    case 'free': return ['price=eq.0'];
    default: return [];
  }
}
function filterMatchesRow(key, row){
  // Client-side mirror of filterExtraQuery, used only to tally real counts
  // per chip from the already-fetched "all" result set (no extra queries).
  var cat = row.category;
  switch(key){
    case 'accommodation': return cat === 'property' || cat === 'rooms';
    case 'study-materials': return cat === 'other' && row.attributes && row.attributes.subcat === 'study-materials';
    case 'electronics': return cat === 'electronics';
    case 'furniture': return cat === 'furniture';
    case 'fashion': return cat === 'fashion';
    case 'services': return cat === 'services';
    case 'jobs': return cat === 'jobs';
    case 'vehicles': return cat === 'vehicles';
    case 'free': return Number(row.price) === 0;
    default: return true;
  }
}
var SORT_OPTIONS = [ ['newest','Newest'], ['price_asc','Price: Low to High'], ['price_desc','Price: High to Low'] ];
var PRICE_OPTIONS = [
  ['any','Any Price',null,null], ['under50','Under $50',0,50], ['50to200','$50 - $200',50,200],
  ['200to500','$200 - $500',200,500], ['500plus','$500+',500,null]
];
var PAGE_SIZE = 12;

var instId = qparam('id');
var state = { filter: 'all', sort: 'newest', price: 'any', offset: 0 };
var allListingsForCounts = []; // last "all" fetch, used only to tally chip counts client-side

function prodCard(l){
  var photo = l.photos && l.photos.length ? l.photos[0] : null;
  var loc = [l.suburb, l.city].filter(Boolean).join(', ') || l.province || 'Zimbabwe';
  var media = photo
    ? '<img class="pm-card-img-el" src="'+esc(photo)+'" alt="'+esc(l.title)+'" loading="lazy" decoding="async">'
    : '<div class="pm-card-ph" style="color:var(--navy)">'+esc(String(l.title||'').split(' ').slice(0,3).join(' '))+'</div>';
  return '<a class="pm-card" href="'+esc(PMUrls.listingPath(l))+'">'+
    '<div class="pm-card-img" style="background:var(--paper)">'+media+'</div>'+
    '<div class="pm-card-body">'+
      '<div class="pm-card-price">'+esc(PM.money(l.price,l.currency))+'</div>'+
      '<div class="pm-card-title">'+esc(l.title)+'</div>'+
      '<div class="pm-card-loc">📍 '+esc(loc)+'</div>'+
    '</div></a>';
}

function orgCard(o){
  var logo = o.logo ? '<img src="'+esc(o.logo)+'" alt="'+esc(o.name)+'">' : esc(initials(o.name));
  return '<a class="org-card flex-none w-24 text-center flex flex-col items-center gap-1.5" href="business?id='+esc(o.id)+'">'+
    '<div class="org-logo">'+logo+'</div>'+
    '<div class="text-[12px] font-semibold text-on-background leading-tight">'+esc(o.name)+'</div>'+
    '</a>';
}

function setMeta(inst, url){
  var title = inst.official_name + ' — PaMarket Zimbabwe';
  var loc = [inst.city_name, inst.province_name].filter(Boolean).join(', ');
  var desc = inst.description ? String(inst.description).slice(0,155) : (inst.official_name + (loc ? ' in ' + loc : '') + ' on PaMarket, Zimbabwe.');
  document.title = title;
  document.getElementById('pageTitle').textContent = title;
  var set = function(id, attr, val){ var el=document.getElementById(id); if(el) el.setAttribute(attr, val); };
  set('metaDesc','content',desc);
  set('canonicalLink','href',url);
  set('ogTitle','content',title); set('ogDesc','content',desc); set('ogUrl','content',url);
  if (inst.cover_image) set('ogImage','content',inst.cover_image);
  set('twTitle','content',title); set('twDesc','content',desc);
  if (inst.cover_image) set('twImage','content',inst.cover_image);
}

function injectSchema(inst, url){
  var s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({
    '@context':'https://schema.org',
    '@type': inst.type === 'organization' ? 'Organization' : 'EducationalOrganization',
    'name': inst.official_name,
    'url': url,
    'logo': inst.logo_url || undefined,
    'description': inst.description || undefined
  });
  document.head.appendChild(s);
}

function renderListings(rows, append){
  var grid = document.getElementById('instListingsGrid');
  var empty = document.getElementById('instListingsEmpty');
  var count = document.getElementById('showingCount');
  var loadMoreWrap = document.getElementById('loadMoreWrap');

  if (state.filter === 'all' && state.offset === 0) allListingsForCounts = rows.slice();
  updateFilterCounts();

  if (!append && !rows.length){
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.innerHTML = PMFeedback.empty(state.filter === 'all'
      ? 'No listings yet at this institution. Institution-tagged listings will appear here as soon as students start posting.'
      : 'No listings match this filter yet.');
    count.textContent = '';
    loadMoreWrap.classList.add('hidden');
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');
  var html = rows.map(prodCard).join('');
  if (append) grid.insertAdjacentHTML('beforeend', html);
  else grid.innerHTML = html;

  var shown = grid.querySelectorAll('.pm-card').length;
  count.textContent = 'Showing ' + shown;
  loadMoreWrap.classList.toggle('hidden', rows.length < PAGE_SIZE);
}

function updateFilterCounts(){
  // Real counts tallied from the last "all" fetch (client-side, no extra
  // queries) -- honest small numbers rather than the mockup's invented
  // 1,420/384/199/etc. Recomputed whenever a fresh "all" page loads.
  LISTING_FILTERS.forEach(function(f){
    var el = document.querySelector('[data-filter-count="'+f.key+'"]');
    if (!el) return;
    var n = f.key === 'all' ? allListingsForCounts.length : allListingsForCounts.filter(function(r){ return filterMatchesRow(f.key, r); }).length;
    el.textContent = String(n);
  });
}

function loadListings(reset){
  if (reset === undefined) reset = true;
  if (reset) state.offset = 0;
  var priceOpt = PRICE_OPTIONS.filter(function(p){ return p[0]===state.price; })[0] || PRICE_OPTIONS[0];
  if (reset){
    document.getElementById('instListingsGrid').innerHTML = '<div class="pm-card skeleton" style="aspect-ratio:3/4"></div><div class="pm-card skeleton" style="aspect-ratio:3/4"></div><div class="pm-card skeleton" style="aspect-ratio:3/4"></div><div class="pm-card skeleton" style="aspect-ratio:3/4"></div>';
    document.getElementById('instListingsGrid').classList.remove('hidden');
    document.getElementById('instListingsEmpty').classList.add('hidden');
    document.getElementById('loadMoreWrap').classList.add('hidden');
  }
  PMInstitutions.fetchInstitutionListings(instId, {
    limit: PAGE_SIZE, offset: state.offset, sort: state.sort, minPrice: priceOpt[2], maxPrice: priceOpt[3],
    extraQuery: filterExtraQuery(state.filter)
  }).then(function(rows){ renderListings(rows, !reset); }).catch(function(){
    document.getElementById('instListingsGrid').classList.add('hidden');
    var empty = document.getElementById('instListingsEmpty');
    empty.classList.remove('hidden');
    empty.innerHTML = PMFeedback.error('Could not load listings right now.');
  });
}

function loadMore(){
  state.offset += PAGE_SIZE;
  loadListings(false);
}

// ---- High Schools Quick Switch (mockup section 9) --------------------
// Real high_school institutions + real per-institution active listing
// counts (via the new PMInstitutions.fetchInstitutionListingCounts()
// aggregate added to js/services/institutions.js), never fabricated names
// or counts. Renders whatever real high schools currently exist -- if the
// current institution IS a high school it's excluded from its own switcher.
function renderQuickSwitch(currentInst){
  var section = document.getElementById('qsSection');
  if (!section) return;
  Promise.all([
    PMInstitutions.fetchInstitutions({ type: 'high_school', limit: 24 }),
    PMInstitutions.fetchInstitutionListingCounts().catch(function(){ return {}; })
  ]).then(function(results){
    var schools = (results[0] || []).filter(function(s){ return s.id !== currentInst.id; });
    var counts = results[1] || {};
    if (!schools.length){ section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    var row = document.getElementById('qsRow');
    row.innerHTML = schools.map(function(s){
      var short = s.short_name || initials(s.official_name);
      return '<a class="qs-chip" href="institution?id='+esc(s.id)+'">'+
        '<div class="qs-badge">'+esc(short.slice(0,4))+'</div>'+
        '<div class="qs-name">'+esc(s.short_name || s.official_name)+'</div>'+
        '<div class="qs-count">'+(counts[s.id]||0)+' listing'+((counts[s.id]||0)===1?'':'s')+'</div>'+
        '</a>';
    }).join('');
  }).catch(function(){ section.classList.add('hidden'); });
}

function render(inst, organizations, activeListingCount){
  var url = PMUrls.absolute(PMUrls.query('institution', { id: inst.id }));
  setMeta(inst, url);
  injectSchema(inst, url);

  var loc = [inst.suburb, inst.city_name, inst.province_name].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
  var cover = inst.cover_image ? '<img src="'+esc(inst.cover_image)+'" alt="'+esc(inst.official_name)+' cover" fetchpriority="high" decoding="async">' : '';
  var logo = inst.logo_url ? '<img src="'+esc(inst.logo_url)+'" alt="'+esc(inst.official_name)+' logo" loading="eager" decoding="async">' : esc((inst.short_name || initials(inst.official_name)));

  var orgsHtml = organizations.length
    ? '<section class="max-w-5xl mx-auto px-margin md:px-margin-desktop mt-space-2xl">'+
      '<h2 class="font-headline-sm text-headline-sm text-on-background">Organizations</h2>'+
      '<p class="text-body-sm font-body-sm text-on-surface-variant mb-space-md">Verified student orgs &amp; businesses at '+esc(inst.official_name)+'</p>'+
      '<div class="flex gap-4 overflow-x-auto pb-1" style="scrollbar-width:none">'+organizations.map(orgCard).join('')+'</div></section>'
    : '';

  var filterRow = '<div class="filter-row" id="filterRow">'+LISTING_FILTERS.map(function(f){
    return '<button type="button" class="pm-chip'+(f.key===state.filter?' is-active':'')+'" data-filter="'+f.key+'">'+f.emoji+' '+esc(f.label)+' <span data-filter-count="'+f.key+'" style="opacity:.65">0</span></button>';
  }).join('')+'</div>';

  var sortSelect = '<select class="sp-select" id="sortSelect">'+SORT_OPTIONS.map(function(o){return '<option value="'+o[0]+'">'+esc(o[1])+'</option>';}).join('')+'</select>';
  var priceSelect = '<select class="sp-select" id="priceSelect">'+PRICE_OPTIONS.map(function(o){return '<option value="'+o[0]+'">'+esc(o[1])+'</option>';}).join('')+'</select>';

  // No "Verify Student ID" button: no student-ID-verification feature
  // exists anywhere in this codebase (checked lib/institutions.ts, admin,
  // and the mobile app) -- omitted rather than fabricated. "Post Free Ad"
  // links to the real, general posting flow: post-ad.html has no
  // institution-scoped query param today, so this intentionally does not
  // claim a "Post Inside X Community" deep link that doesn't exist yet.
  var html =
    '<div class="biz-cover">'+cover+'</div>'+
    '<div class="max-w-5xl mx-auto px-margin md:px-margin-desktop">'+
      '<div class="flex flex-col sm:flex-row gap-5 sm:items-end -mt-12 relative z-10">'+
        '<div class="biz-logo">'+logo+'</div>'+
        '<div class="pb-2 flex-1 min-w-0">'+
          '<div class="flex items-center gap-2 flex-wrap"><h1 class="font-headline-md text-headline-md text-on-background">'+esc(inst.official_name)+'</h1>'+
          '<span class="inline-flex items-center gap-1 bg-primary-fixed text-on-primary-fixed-variant text-[11px] font-bold px-2.5 py-1 rounded-full">✓ Verified Institution</span></div>'+
          '<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm font-body-sm text-on-surface-variant">'+
            '<span>🎓 '+esc(TYPE_LABEL[inst.type]||inst.type)+'</span>'+
            (loc ? '<span>📍 '+esc(loc)+'</span>' : '')+
            '<span>🛍️ '+activeListingCount+' Active Peer Listing'+(activeListingCount===1?'':'s')+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="pb-2 flex gap-2 shrink-0">'+
          '<a href="post-ad" class="rounded-full bg-secondary text-on-secondary px-4 py-2.5 text-label-md font-label-md whitespace-nowrap">+ Post a Free Ad</a>'+
        '</div>'+
      '</div>'+
      (inst.description ? '<p class="mt-4 text-body-md font-body-md text-on-surface-variant leading-relaxed whitespace-pre-line">'+esc(inst.description)+'</p>' : '')+
    '</div>'+
    orgsHtml+
    '<section class="max-w-5xl mx-auto px-margin md:px-margin-desktop mt-space-2xl">'+
      '<h2 class="font-headline-sm text-headline-sm text-on-background">Campus Listings</h2>'+
      '<p class="text-body-sm font-body-sm text-on-surface-variant mb-space-md">Items &amp; services tagged to '+esc(inst.official_name)+'</p>'+
      filterRow+
      '<div class="flex gap-3 flex-wrap items-center mb-space-md">'+sortSelect+priceSelect+'<span class="text-body-sm font-body-sm text-on-surface-variant ml-auto" id="showingCount"></span></div>'+
      '<div class="prod-grid hidden" id="instListingsGrid"></div>'+
      '<div id="instListingsEmpty"></div>'+
      '<div class="mt-space-lg flex justify-center hidden" id="loadMoreWrap"><button type="button" id="loadMoreBtn" class="rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2.5 text-label-md font-label-md hover:bg-surface-container-low">Load More Campus Listings</button></div>'+
    '</section>'+
    '<section class="max-w-5xl mx-auto px-margin md:px-margin-desktop mt-space-2xl hidden" id="qsSection">'+
      '<h2 class="font-headline-sm text-headline-sm text-on-background">High Schools Quick Switch</h2>'+
      '<p class="text-body-sm font-body-sm text-on-surface-variant mb-space-md">Jump straight to another school’s listings</p>'+
      '<div class="qs-row" id="qsRow"></div>'+
    '</section>'+
    '<section class="max-w-5xl mx-auto px-margin md:px-margin-desktop mt-space-2xl mb-space-2xl">'+
      '<div class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-space-2xl">'+
        '<div class="flex items-center gap-3 flex-wrap mb-space-sm">'+
          '<h2 class="font-headline-sm text-headline-sm text-on-background">Campus Trading Protocols &amp; Safety Guidelines</h2>'+
          '<span class="inline-flex items-center gap-1 bg-error-container text-on-error-container text-[11px] font-bold px-2.5 py-1 rounded-full">Zero-Tolerance Fraud Zone</span>'+
        '</div>'+
        '<p class="text-body-sm font-body-sm text-on-surface-variant mb-space-lg">Institution listings still happen off-platform, so the same real safety practices used everywhere on PaMarket apply here too.</p>'+
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-space-base mb-space-lg">'+
          '<div class="flex gap-3"><span class="pm-material text-[20px] text-primary shrink-0">groups</span><div><h4 class="text-label-md font-label-md text-on-background">Meet on Campus, in Public</h4><p class="text-body-sm font-body-sm text-on-surface-variant">Hand over items in a busy, well-lit part of campus or school grounds.</p></div></div>'+
          '<div class="flex gap-3"><span class="pm-material text-[20px] text-primary shrink-0">devices</span><div><h4 class="text-label-md font-label-md text-on-background">Inspect Hardware In-Person</h4><p class="text-body-sm font-body-sm text-on-surface-variant">Test laptops, phones and gadgets before paying — never on trust alone.</p></div></div>'+
          '<div class="flex gap-3"><span class="pm-material text-[20px] text-primary shrink-0">badge</span><div><h4 class="text-label-md font-label-md text-on-background">Confirm Student/Staff Status</h4><p class="text-body-sm font-body-sm text-on-surface-variant">Ask to see a current student or staff card before completing a trade.</p></div></div>'+
        '</div>'+
        '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-surface-container px-space-md py-space-md">'+
          '<p class="text-body-sm font-body-sm text-on-surface-variant">Report a suspicious listing or seller: <a class="text-primary font-semibold" href="https://wa.me/971589772645" target="_blank" rel="noopener">WhatsApp +971 589 772 645</a></p>'+
          '<a href="safety" class="rounded-full bg-primary text-on-primary px-4 py-2 text-label-md font-label-md whitespace-nowrap">Report a Listing</a>'+
        '</div>'+
      '</div>'+
    '</section>';

  document.getElementById('instLoading').classList.add('hidden');
  var c = document.getElementById('instContent');
  c.innerHTML = html;
  c.classList.remove('hidden');

  document.getElementById('filterRow').addEventListener('click', function(e){
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.getAttribute('data-filter');
    document.querySelectorAll('#filterRow .pm-chip').forEach(function(el){ el.classList.toggle('is-active', el===btn); });
    loadListings(true);
  });
  document.getElementById('sortSelect').addEventListener('change', function(){ state.sort = this.value; loadListings(true); });
  document.getElementById('priceSelect').addEventListener('change', function(){ state.price = this.value; loadListings(true); });
  document.getElementById('loadMoreBtn').addEventListener('click', loadMore);

  loadListings(true);
  renderQuickSwitch(inst);
}

function showNotFound(){
  var rm = document.getElementById('robotsMeta'); if (rm) rm.setAttribute('content','noindex, nofollow');
  document.getElementById('instLoading').classList.add('hidden');
  var c = document.getElementById('instContent');
  c.innerHTML = '<div class="max-w-5xl mx-auto px-margin md:px-margin-desktop"><div class="empty-state" style="margin-top:60px">'+
    '<h2 style="margin-bottom:8px">Institution not found</h2>'+
    '<p>This institution may have been removed or is no longer active.</p><br>'+
    '<a href="institutions">Browse all institutions</a></div></div>';
  c.classList.remove('hidden');
}

// ---- Mini directory bar (type chips + live search-to-switch) ---------
(function initMiniBar(){
  var typeRow = document.getElementById('miniTypeRow');
  var search = document.getElementById('miniSearch');
  var results = document.getElementById('miniResults');
  if (!typeRow || !search) return;

  PMInstitutions.fetchInstitutionTypeCounts().then(function(counts){
    var html = '<a href="institutions" class="inst-type-chip">All Institutions</a>';
    TYPES.forEach(function(t){
      html += '<a href="institutions?type='+esc(t)+'" class="inst-type-chip">'+esc(TYPE_LABEL[t])+' <span class="inst-type-count">'+(counts[t]||0)+'</span></a>';
    });
    typeRow.innerHTML = html;
  }).catch(function(){});

  search.addEventListener('input', function(){
    var v = this.value.trim();
    clearTimeout(window.__miniSearchTimer);
    if (!v){ results.classList.add('hidden'); results.innerHTML=''; return; }
    window.__miniSearchTimer = setTimeout(function(){
      PMInstitutions.fetchInstitutions({ q: v, limit: 8 }).then(function(rows){
        if (!rows.length){ results.innerHTML = '<div class="px-4 py-3 text-body-sm text-on-surface-variant">No institutions match "'+esc(v)+'"</div>'; results.classList.remove('hidden'); return; }
        results.innerHTML = rows.map(function(r){
          var loc = [r.city_name, r.province_name].filter(Boolean).join(', ');
          return '<a href="institution?id='+esc(r.id)+'" class="block px-4 py-2.5 hover:bg-surface-container-low border-b border-outline-variant last:border-0">'+
            '<div class="text-body-sm font-semibold text-on-background">'+esc(r.official_name)+(r.short_name?' ('+esc(r.short_name)+')':'')+'</div>'+
            (loc ? '<div class="text-[11px] text-on-surface-variant">'+esc(loc)+'</div>' : '')+
            '</a>';
        }).join('');
        results.classList.remove('hidden');
      }).catch(function(){ results.classList.add('hidden'); });
    }, 300);
  });
  document.addEventListener('click', function(e){
    if (!results.contains(e.target) && e.target !== search) results.classList.add('hidden');
  });
})();

if (!instId){
  showNotFound();
} else {
  Promise.all([
    PMInstitutions.fetchInstitutionById(instId),
    PMInstitutions.fetchInstitutionOrganizations(instId).catch(function(){ return []; }),
    PMInstitutions.fetchInstitutionListingCounts().catch(function(){ return {}; })
  ]).then(function(results){
    var inst = results[0], organizations = results[1] || [], countsMap = results[2] || {};
    if (!inst) { showNotFound(); return; }
    render(inst, organizations, countsMap[instId] || 0);
  }).catch(function(){ showNotFound(); });
}
