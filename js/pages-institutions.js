// Institutions directory page (institutions.html).
(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function doHeaderSearch(){
    var q = (document.getElementById('headerSearchInput')||{}).value || '';
    window.location.href = 'browse.html' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '');
  }
  window.doHeaderSearch = doHeaderSearch;
  window.PM_CURRENCY = window.PM_CURRENCY || 'USD';
  window.setCurrency = function(cur){
    window.PM_CURRENCY = cur;
    var usdBtn = document.getElementById('currencyUsdBtn'), zigBtn = document.getElementById('currencyZigBtn');
    var activeCls = 'px-2 py-1 rounded bg-primary text-on-primary font-bold shadow-sm';
    var inactiveCls = 'px-2 py-1 rounded text-on-surface-variant hover:text-on-surface transition-colors font-medium';
    if (usdBtn && zigBtn) { usdBtn.className = cur==='USD'?activeCls:inactiveCls; zigBtn.className = cur==='ZiG'?activeCls:inactiveCls; }
  };

  var TYPE_LABEL = window.PMInstitutions.TYPE_LABEL;
  var TYPES = window.PMInstitutions.TYPES;
  var TYPE_ICON = { university: 'account_balance', high_school: 'school', organization: 'groups' };
  var TYPE_PLURAL = { university: 'Universities', high_school: 'High Schools', organization: 'Organizations' };
  function plural(t){ return TYPE_PLURAL[t] || (TYPE_LABEL[t] + 's'); }
  var state = { type: '', q: '' };

  window.onSearch = function(){
    state.q = document.getElementById('instSearchInput').value.trim();
    loadList();
  };
  window.setType = function(t){
    state.type = state.type === t ? '' : t;
    renderChips();
    loadList();
  };

  var METRIC_ICON = { university: 'account_balance', high_school: 'backpack', organization: 'groups' };
  function metricTile(icon, value, label){
    return '<div class="bg-surface-container-low p-3.5 rounded-lg flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm shrink-0"><span class="material-symbols-outlined text-[22px]">'+icon+'</span></div><div class="flex flex-col"><span class="font-headline-sm text-headline-sm font-bold text-on-surface">'+value+'</span><span class="font-label-sm text-label-sm text-outline">'+label+'</span></div></div>';
  }
  function renderMetricsLedger(counts){
    var total = TYPES.reduce(function(sum,t){ return sum + (counts[t]||0); }, 0);
    var html = metricTile('school', total, 'Accredited Institutions');
    TYPES.forEach(function(t){ html += metricTile(METRIC_ICON[t], counts[t]||0, plural(t)); });
    document.getElementById('metricsLedger').innerHTML = html;
  }

  function renderChips(){
    var html = '<button onclick="setType(\'\')" class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-body-sm font-bold border transition-colors ' + (!state.type ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary') + '">All Institutions</button>';
    TYPES.forEach(function(t){
      html += '<button onclick="setType(\''+t+'\')" class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-body-sm font-bold border transition-colors ' + (state.type===t ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary') + '"><span class="material-symbols-outlined text-[16px]">'+TYPE_ICON[t]+'</span>'+TYPE_LABEL[t]+' <span id="typeCount-'+t+'" class="'+(state.type===t?'bg-on-primary/20':'bg-surface-container')+' rounded-full px-2 py-0.5 text-label-sm font-label-sm"></span></button>';
    });
    document.getElementById('typeChipRow').innerHTML = html;
    window.PMInstitutions.fetchInstitutionTypeCounts().then(function(counts){
      TYPES.forEach(function(t){
        var el = document.getElementById('typeCount-'+t);
        if (el) el.textContent = counts[t] || 0;
      });
      renderMetricsLedger(counts);
    }).catch(function(){});
  }

  var listingCounts = {};
  function abbreviation(inst){
    // Short codes (UZ, HIT, MUAST) fit the logo tile; longer names like
    // "Mutare Boys High" overflowed it, so fall back to initials (MBH).
    var sn = (inst.short_name || '').trim();
    if (sn && sn.length <= 5) return sn;
    var words = (sn || inst.official_name || 'I').trim().split(/\s+/).filter(function(w){ return !/^(of|the|and|&|for)$/i.test(w); });
    return words.slice(0, 3).map(function(w){ return w.charAt(0).toUpperCase(); }).join('') || 'I';
  }
  function instCard(inst){
    var name = inst.short_name || inst.official_name;
    var loc = [inst.suburb, inst.city_name].filter(Boolean).join(', ') || inst.province_name || 'Zimbabwe';
    var abbr = abbreviation(inst);
    var logo = inst.logo_url ? '<img src="'+inst.logo_url+'" alt="'+esc(name)+'" class="w-full h-full object-contain"/>' : '<span class="font-headline-sm font-extrabold text-primary '+(abbr.length>3?'text-[13px]':'text-[15px]')+'">'+esc(abbr)+'</span>';
    var count = listingCounts[inst.id] || 0;
    return '<article class="bg-surface-container-lowest rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow group">' +
      '<div class="flex flex-col gap-3">' +
      '<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center overflow-hidden shrink-0">'+logo+'</div>' +
      '<div class="min-w-0"><h3 class="font-headline-sm text-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">'+esc(name)+'</h3><span class="font-label-sm text-label-sm text-outline truncate block">'+esc(loc)+'</span></div></div>' +
      '<span class="w-fit px-2 py-0.5 rounded bg-surface-container-low text-secondary font-label-sm text-label-sm font-semibold uppercase tracking-wide">'+esc(TYPE_LABEL[inst.type]||inst.type)+'</span>' +
      (inst.description ? '<p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">'+esc(inst.description)+'</p>' : '') +
      '</div>' +
      '<div class="pt-3 mt-3 border-t border-outline-variant/30 flex flex-col gap-2">' +
      '<div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm"><span class="flex items-center gap-1">'+count+' Active Peer Listing'+(count===1?'':'s')+'</span></div>' +
      '<a href="institution.html?id='+encodeURIComponent(inst.id)+'" class="w-full py-2 bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-label-md text-label-md rounded-lg flex items-center justify-center gap-1.5 transition-colors"><span>Enter Campus Marketplace</span><span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>' +
      '</div></article>';
  }
  function loadList(){
    var opts = { limit: 100 };
    if (state.type) opts.type = state.type;
    if (state.q) opts.q = state.q;
    document.getElementById('listHeading').textContent = state.type ? plural(state.type) : 'All Institutions';
    window.PMInstitutions.fetchInstitutions(opts).then(function(rows){
      var grid = document.getElementById('instGrid');
      var empty = document.getElementById('emptyState');
      if (!rows.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); document.getElementById('showingCount').textContent = ''; return; }
      empty.classList.add('hidden');
      grid.innerHTML = rows.map(instCard).join('');
      document.getElementById('showingCount').textContent = 'Showing ' + rows.length + ' institution' + (rows.length===1?'':'s');
    }).catch(function(){
      document.getElementById('instGrid').innerHTML = '';
      document.getElementById('emptyState').classList.remove('hidden');
    });
  }

  // ── Campus Listings: public listings from every institution ──────────
  // Follows the page's type chips and institution search, so "Universities"
  // or a search for "UZ" narrows the listings to match.
  var CAMPUS_PAGE = 12;
  var campus = { offset: 0, token: 0 };
  function campusMoney(p, c){
    var n = Number(p);
    if (p == null || p === '' || isNaN(n)) return 'Price on request';
    if (n === 0) return 'Free';
    var amt = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return (!c || c === 'USD') ? '$' + amt : ((c === 'ZWG' || c === 'ZiG') ? 'ZiG ' + amt : c + ' ' + amt);
  }
  function campusCard(l){
    var inst = l.institutions || {};
    var instName = inst.short_name || inst.official_name || 'Campus';
    var photo = Array.isArray(l.photos) && l.photos.length ? l.photos[0] : null;
    var loc = [l.suburb, l.city].filter(Boolean).join(', ') || l.province || 'Zimbabwe';
    var href = 'detail.html?id=' + encodeURIComponent(l.id);
    var ph = '<span class="material-symbols-outlined text-[36px] text-outline">image</span>';
    var media = photo
      ? '<img src="'+esc(photo)+'" alt="'+esc(l.title)+'" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'material-symbols-outlined text-[36px] text-outline\',textContent:\'image\'}))">'
      : ph;
    return '<article class="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">' +
      '<a href="'+href+'" class="relative block bg-surface-container aspect-[4/3] overflow-hidden flex items-center justify-center">' + media +
      '<span class="absolute top-2 left-2 max-w-[85%] inline-flex items-center gap-1 bg-surface-container-lowest/95 text-primary rounded-full px-2 py-0.5 font-label-sm text-label-sm font-bold shadow-sm"><span class="material-symbols-outlined text-[14px]">'+(TYPE_ICON[inst.type]||'school')+'</span><span class="truncate">'+esc(instName)+'</span></span></a>' +
      '<div class="p-3 flex flex-col gap-1 flex-1">' +
      '<a href="'+href+'" class="font-headline-sm text-body-lg font-bold text-primary">'+esc(campusMoney(l.price, l.currency))+'</a>' +
      '<a href="'+href+'" class="font-body-md text-body-md text-on-surface line-clamp-2 hover:text-primary transition-colors">'+esc(l.title)+'</a>' +
      '<span class="mt-auto pt-1 flex items-center gap-1 font-label-sm text-label-sm text-outline truncate"><span class="material-symbols-outlined text-[14px]">location_on</span><span class="truncate">'+esc(loc)+'</span></span>' +
      (inst.id ? '<a href="institution.html?id='+encodeURIComponent(inst.id)+'" class="font-label-sm text-label-sm text-secondary font-semibold hover:underline truncate">View '+esc(instName)+' campus &rarr;</a>' : '') +
      '</div></article>';
  }
  function loadCampus(append){
    var grid = document.getElementById('campusGrid');
    var empty = document.getElementById('campusEmpty');
    var more = document.getElementById('campusMore');
    var count = document.getElementById('campusCount');
    var token = ++campus.token;
    if (!append) {
      campus.offset = 0;
      grid.innerHTML = Array.from({length: 4}).map(function(){ return '<div class="bg-surface-container-lowest rounded-xl overflow-hidden"><div class="aspect-[4/3] bg-surface-container animate-pulse"></div><div class="p-3 flex flex-col gap-2"><div class="h-4 w-1/2 bg-surface-container rounded animate-pulse"></div><div class="h-3 w-4/5 bg-surface-container rounded animate-pulse"></div></div></div>'; }).join('');
      empty.classList.add('hidden');
      more.classList.add('hidden');
    } else {
      more.disabled = true; more.textContent = 'Loading...';
    }
    var label = state.type ? plural(state.type) : '';
    document.getElementById('campusHeading').textContent = 'Campus Listings' + (label ? ' · ' + label : '') + (state.q ? ' · "' + state.q + '"' : '');
    window.PMInstitutions.fetchCampusListings({
      type: state.type, q: state.q, sort: document.getElementById('campusSort').value,
      limit: CAMPUS_PAGE, offset: campus.offset
    }).then(function(res){
      if (token !== campus.token) return;
      var rows = res.rows || [];
      campus.offset += rows.length;
      if (!append) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', rows.map(campusCard).join(''));
      var total = res.total == null ? campus.offset : res.total;
      if (!campus.offset) {
        empty.classList.remove('hidden');
        var filtered = !!(state.type || state.q);
        document.getElementById('campusEmptyTitle').textContent = filtered ? 'No campus listings match this filter' : 'No campus listings yet';
        document.getElementById('campusEmptyText').textContent = filtered ? 'Try another institution type or search, or post the first item.' : 'Be the first to post an item for your school or university.';
        count.textContent = '';
      } else {
        count.textContent = 'Showing ' + campus.offset + (total > campus.offset ? ' of ' + total : '') + ' listing' + (total === 1 ? '' : 's');
      }
      var hasMore = res.total == null ? rows.length === CAMPUS_PAGE : campus.offset < total;
      more.classList.toggle('hidden', !hasMore);
      more.disabled = false; more.textContent = 'Load more';
    }).catch(function(){
      if (token !== campus.token) return;
      if (!append) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        document.getElementById('campusEmptyTitle').textContent = 'Could not load campus listings';
        document.getElementById('campusEmptyText').textContent = 'Please check your connection and try again.';
      }
      more.disabled = false; more.textContent = 'Load more';
    });
  }
  document.getElementById('campusSort').addEventListener('change', function(){ loadCampus(false); });
  document.getElementById('campusMore').addEventListener('click', function(){ loadCampus(true); });
  var _onSearch = window.onSearch, _setType = window.setType;
  window.onSearch = function(){ _onSearch(); loadCampus(false); };
  window.setType = function(t){ _setType(t); loadCampus(false); };
  loadCampus(false);

  window.PMInstitutions.fetchInstitutionListingCounts().then(function(counts){
    listingCounts = counts || {};
    loadList();
  }).catch(function(){});

  renderChips();
  loadList();
})();
