'use strict';
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function initials(name){ return (name||'I').trim().charAt(0).toUpperCase(); }
function qparam(k){ return new URLSearchParams(location.search).get(k); }

var TYPE_LABEL = PMInstitutions.TYPE_LABEL;

// Fixed, curated filter chips -- mirrors
// apps/mobile/lib/institution-listing-filters.ts exactly (same keys/labels/
// emoji and the same category mapping), reusing the existing category
// taxonomy verbatim rather than inventing new categories for the website.
var LISTING_FILTERS = [
  { key: 'all', label: 'All', emoji: '🏫' },
  { key: 'accommodation', label: 'Accommodation', emoji: '🏠' },
  { key: 'study-materials', label: 'Study Materials', emoji: '📚' },
  { key: 'electronics', label: 'Electronics', emoji: '💻' },
  { key: 'furniture', label: 'Furniture', emoji: '🪑' },
  { key: 'fashion', label: 'Fashion', emoji: '👕' },
  { key: 'services', label: 'Services', emoji: '🛠️' },
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
var SORT_OPTIONS = [ ['newest','Newest'], ['price_asc','Price: Low to High'], ['price_desc','Price: High to Low'] ];
var PRICE_OPTIONS = [
  ['any','Any Price',null,null], ['under50','Under $50',0,50], ['50to200','$50 - $200',50,200],
  ['200to500','$200 - $500',200,500], ['500plus','$500+',500,null]
];

var instId = qparam('id');
var state = { filter: 'all', sort: 'newest', price: 'any' };

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
  return '<a class="org-card" href="business?id='+esc(o.id)+'">'+
    '<div class="org-logo">'+logo+'</div>'+
    '<div class="org-name">'+esc(o.name)+'</div>'+
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

function renderListings(rows){
  var grid = document.getElementById('instListingsGrid');
  var empty = document.getElementById('instListingsEmpty');
  var count = document.getElementById('showingCount');
  if (!rows.length){
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.innerHTML = PMFeedback.empty(state.filter === 'all' ? 'No listings yet. Listings tagged to this institution will appear here.' : 'No listings match this filter yet.');
    count.textContent = '';
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');
  grid.innerHTML = rows.map(prodCard).join('');
  count.textContent = 'Showing ' + rows.length;
}

function loadListings(){
  var priceOpt = PRICE_OPTIONS.filter(function(p){ return p[0]===state.price; })[0] || PRICE_OPTIONS[0];
  document.getElementById('instListingsGrid').innerHTML = '<div class="pm-card skeleton" style="aspect-ratio:3/4"></div><div class="pm-card skeleton" style="aspect-ratio:3/4"></div><div class="pm-card skeleton" style="aspect-ratio:3/4"></div><div class="pm-card skeleton" style="aspect-ratio:3/4"></div>';
  document.getElementById('instListingsGrid').classList.remove('hidden');
  document.getElementById('instListingsEmpty').classList.add('hidden');
  PMInstitutions.fetchInstitutionListings(instId, {
    limit: 40, sort: state.sort, minPrice: priceOpt[2], maxPrice: priceOpt[3],
    extraQuery: filterExtraQuery(state.filter)
  }).then(renderListings).catch(function(){
    document.getElementById('instListingsGrid').classList.add('hidden');
    var empty = document.getElementById('instListingsEmpty');
    empty.classList.remove('hidden');
    empty.innerHTML = PMFeedback.error('Could not load listings right now.');
  });
}

function render(inst, organizations){
  var url = PMUrls.absolute(PMUrls.query('institution', { id: inst.id }));
  setMeta(inst, url);
  injectSchema(inst, url);

  var loc = [inst.suburb, inst.city_name, inst.province_name].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
  var cover = inst.cover_image ? '<img src="'+esc(inst.cover_image)+'" alt="'+esc(inst.official_name)+' cover" fetchpriority="high" decoding="async">' : '';
  var logo = inst.logo_url ? '<img src="'+esc(inst.logo_url)+'" alt="'+esc(inst.official_name)+' logo" loading="eager" decoding="async">' : esc((inst.short_name || initials(inst.official_name)));

  var statHtml = '<div class="biz-stat"><div class="n">'+esc(TYPE_LABEL[inst.type]||inst.type)+'</div><div class="l">Type</div></div>';
  if (inst.founded_year) statHtml += '<div class="biz-stat"><div class="n">'+esc(inst.founded_year)+'</div><div class="l">Founded</div></div>';

  var orgsHtml = organizations.length
    ? '<div class="biz-section"><h2>Organizations</h2><div class="sub">Verified student orgs &amp; businesses at '+esc(inst.official_name)+'</div>'+
      '<div class="orgs-row">'+organizations.map(orgCard).join('')+'</div></div>'
    : '';

  var filterRow = '<div class="filter-row" id="filterRow">'+LISTING_FILTERS.map(function(f){
    return '<button type="button" class="pm-chip'+(f.key===state.filter?' is-active':'')+'" data-filter="'+f.key+'">'+f.emoji+' '+esc(f.label)+'</button>';
  }).join('')+'</div>';

  var sortSelect = '<select class="sp-select" id="sortSelect">'+SORT_OPTIONS.map(function(o){return '<option value="'+o[0]+'">'+esc(o[1])+'</option>';}).join('')+'</select>';
  var priceSelect = '<select class="sp-select" id="priceSelect">'+PRICE_OPTIONS.map(function(o){return '<option value="'+o[0]+'">'+esc(o[1])+'</option>';}).join('')+'</select>';

  var html =
    '<div class="biz-cover">'+cover+'</div>'+
    '<div class="biz-head">'+
      '<div class="biz-id">'+
        '<div class="biz-logo">'+logo+'</div>'+
      '</div>'+
      '<div class="biz-name-row" style="margin-top:14px"><h1 class="biz-name">'+esc(inst.official_name)+'</h1><span class="biz-verified">✓ Verified</span></div>'+
      '<div class="biz-meta">'+
        '<span>🎓 '+esc(TYPE_LABEL[inst.type]||inst.type)+'</span>'+
        (loc ? '<span>📍 '+esc(loc)+'</span>' : '')+
      '</div>'+
      (inst.description ? '<p style="font-size:14.5px;color:var(--sub);margin-top:14px;line-height:1.7">'+esc(inst.description)+'</p>' : '')+
      '<div class="biz-stats">'+statHtml+'</div>'+
    '</div>'+
    '<div class="biz-body">'+
      orgsHtml+
      '<div class="biz-section"><h2>Listings</h2><div class="sub">Items &amp; services tagged to '+esc(inst.official_name)+'</div>'+
        filterRow+
        '<div class="sort-price-row">'+sortSelect+priceSelect+'<span class="showing-count" id="showingCount"></span></div>'+
        '<div class="prod-grid hidden" id="instListingsGrid"></div>'+
        '<div id="instListingsEmpty"></div>'+
      '</div>'+
    '</div>';

  document.getElementById('instLoading').classList.add('hidden');
  var c = document.getElementById('instContent');
  c.innerHTML = html;
  c.classList.remove('hidden');

  document.getElementById('filterRow').addEventListener('click', function(e){
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.getAttribute('data-filter');
    document.querySelectorAll('#filterRow .pm-chip').forEach(function(el){ el.classList.toggle('is-active', el===btn); });
    loadListings();
  });
  document.getElementById('sortSelect').addEventListener('change', function(){ state.sort = this.value; loadListings(); });
  document.getElementById('priceSelect').addEventListener('change', function(){ state.price = this.value; loadListings(); });

  loadListings();
}

function showNotFound(){
  var rm = document.getElementById('robotsMeta'); if (rm) rm.setAttribute('content','noindex, nofollow');
  document.getElementById('instLoading').classList.add('hidden');
  var c = document.getElementById('instContent');
  c.innerHTML = '<div class="biz-body"><div class="empty-state" style="margin-top:60px">'+
    '<h2 style="margin-bottom:8px">Institution not found</h2>'+
    '<p>This institution may have been removed or is no longer active.</p><br>'+
    '<a href="institutions">Browse all institutions</a></div></div>';
  c.classList.remove('hidden');
}

if (!instId){
  showNotFound();
} else {
  Promise.all([
    PMInstitutions.fetchInstitutionById(instId),
    PMInstitutions.fetchInstitutionOrganizations(instId).catch(function(){ return []; })
  ]).then(function(results){
    var inst = results[0], organizations = results[1] || [];
    if (!inst) { showNotFound(); return; }
    render(inst, organizations);
  }).catch(function(){ showNotFound(); });
}
