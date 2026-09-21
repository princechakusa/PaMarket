'use strict';
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function qparam(k){ return new URLSearchParams(location.search).get(k); }

var TYPE_LABEL = PMInstitutions.TYPE_LABEL;
var TYPES = PMInstitutions.TYPES;
var state = { type: qparam('type') && TYPES.indexOf(qparam('type')) > -1 ? qparam('type') : '', province: '', q: '' };
var institutionIds = [];

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

function renderTypeRow(counts){
  var html = '<button type="button" class="inst-type-chip'+(state.type===''?' on':'')+'" data-type="">All</button>';
  TYPES.forEach(function(t){
    html += '<button type="button" class="inst-type-chip'+(state.type===t?' on':'')+'" data-type="'+t+'">'+
      esc(TYPE_LABEL[t])+' <span class="inst-type-count">'+(counts[t]||0)+'</span></button>';
  });
  var row = document.getElementById('typeRow');
  row.innerHTML = html;
  row.querySelectorAll('.inst-type-chip').forEach(function(btn){
    btn.addEventListener('click', function(){
      state.type = btn.getAttribute('data-type');
      renderTypeRow(counts);
      loadInstitutions();
    });
  });
}

function renderInstitutionList(rows){
  var list = document.getElementById('instList');
  var sub = document.getElementById('instListSub');
  institutionIds = rows.map(function(r){ return r.id; });
  if (!rows.length){
    list.innerHTML = PMFeedback.empty('No institutions match your filters yet.');
    sub.textContent = '';
    return;
  }
  sub.textContent = rows.length + ' found';
  list.innerHTML = rows.map(function(r){
    var loc = [r.city_name, r.province_name].filter(Boolean).join(', ');
    var name = r.short_name ? (r.official_name + ' (' + r.short_name + ')') : r.official_name;
    return '<a class="inst-chip-card" href="institution?id='+esc(r.id)+'">'+
      '<span class="inst-chip-type">'+esc(TYPE_LABEL[r.type]||r.type)+'</span>'+
      '<span class="inst-chip-name">'+esc(name)+'</span>'+
      (loc ? '<span class="inst-chip-loc">📍 '+esc(loc)+'</span>' : '')+
      '</a>';
  }).join('');
}

function loadInstitutions(){
  document.getElementById('instList').innerHTML = '<div class="skeleton" style="height:64px;width:170px;border-radius:12px"></div>';
  PMInstitutions.fetchInstitutions({ type: state.type, province: state.province, q: state.q, limit: 60 })
    .then(function(rows){ renderInstitutionList(rows); loadPicks(); })
    .catch(function(){
      document.getElementById('instList').innerHTML = PMFeedback.error('Could not load institutions right now.');
    });
}

function loadPicks(){
  var grid = document.getElementById('picksGrid');
  var emptyEl = document.getElementById('picksEmpty');
  if (!institutionIds.length){
    grid.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.innerHTML = PMFeedback.empty('No institutions match your filters yet.');
    return;
  }
  var ids = institutionIds.map(function(id){ return String(id).replace(/[^a-zA-Z0-9_-]/g,''); }).filter(Boolean);
  var qp = [
    'status=eq.active',
    'institution_id=in.(' + ids.join(',') + ')',
    // Institution-only listings never surface in this general picks feed
    // (same exclusion as the mobile Institutions directory screen). Not an
    // is/neq bare pair -- an explicit OR so a listing with no
    // institution_visibility key at all isn't silently dropped, matching
    // apps/mobile/app/institutions/index.tsx's buildListingsQuery exactly.
    'or=(attributes->>institution_visibility.is.null,attributes->>institution_visibility.neq.institution_only)',
    'select=id,seller_id,title,price,currency,category,province,city,suburb,photos,created_at',
    'order=created_at.desc',
    'limit=24'
  ];
  PMServiceTransport.fetchJson('listings?' + qp.join('&')).then(function(rows){
    grid.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    if (!rows.length){
      grid.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = PMFeedback.empty('No listings yet. Institution-tagged listings will appear here.');
      return;
    }
    grid.innerHTML = rows.map(prodCard).join('');
  }).catch(function(){
    grid.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.innerHTML = PMFeedback.error('Could not load listings right now.');
  });
}

document.getElementById('instSearch').addEventListener('input', function(){
  var v = this.value;
  clearTimeout(window.__instSearchTimer);
  window.__instSearchTimer = setTimeout(function(){ state.q = v.trim(); loadInstitutions(); }, 300);
});
document.getElementById('instProvince').addEventListener('change', function(){
  state.province = this.value;
  loadInstitutions();
});

PMInstitutions.fetchInstitutionTypeCounts().then(renderTypeRow).catch(function(){ renderTypeRow({}); });
loadInstitutions();
