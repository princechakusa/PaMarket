function skeletons(n){
  return Array.from({length:n}).map(()=>'<div class="rcard"><div class="rcard-img skeleton"></div><div class="rcard-body"><div class="skeleton" style="height:16px;width:60%;border-radius:4px;margin-bottom:8px"></div><div class="skeleton" style="height:12px;width:90%;border-radius:4px"></div></div></div>').join('');
}

function human(s){return String(s||'').split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join(' ')}
function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]})}

// Real, honest badges only — never a fabricated "verified" claim the data
// doesn't back. company_verified/is_featured come straight off the row;
// with_driver reflects the vehicle's actual driver_rate field.
function rcard(v){
  const brand=(v.rental_brands&&v.rental_brands.label)||human(v.brand_slug);
  const title=(brand+' '+(v.model||'')).trim()+(v.year?' '+v.year:'');
  const media=(v.rental_vehicle_media||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const cover=media.find(m=>m.is_cover)||media[0]||(v.cover_url?{url:v.cover_url}:null);
  const catLabel=(v.rental_categories&&v.rental_categories.label)||human(v.category_slug);
  const company=(v.rental_companies&&v.rental_companies.trading_name)||v.company_name||'';
  const loc=[v.pickup_suburb,(v.rental_locations&&v.rental_locations.city)||v.city].filter(Boolean).join(', ');
  const img=cover
    ?`<img src="${esc(cover.url)}" alt="${esc(title)}" loading="lazy">`
    :`<div class="rcard-img-ph"><svg width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19 17H5v-5l2-6h10l2 6v5z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg></div>`;
  const availCls=v.is_available?'yes':'no';
  const availTxt=v.is_available?'Available':'Booked';
  const badges=[];
  if(v.is_featured)badges.push('<span class="rcard-badge">★ Tier 1 Operator</span>');
  else if(v._verified)badges.push('<span class="rcard-badge">✓ Verified Operator</span>');
  if(v._driver)badges.push('<span class="rcard-badge transport">Driver Available</span>');
  const chips=[];
  if(v.transmission)chips.push(esc(human(v.transmission)));
  if(v.seats)chips.push(v.seats+' Seats');
  if(v.drive_type)chips.push(esc(v.drive_type.toUpperCase()));
  if(v._cross)chips.push('Cross-Border');
  if(v._insured)chips.push('Insured');
  return`<a class="rcard" href="${esc(PMUrls.rentalPath(v))}">
    <div class="rcard-img">
      ${img}
      <div class="rcard-badges">${badges.join('')}</div>
      <div class="rcard-avail ${availCls}">${availTxt}</div>
    </div>
    <div class="rcard-body">
      <div class="rcard-title">${esc(title)||'Rental Vehicle'}</div>
      <div class="rcard-meta">${esc(catLabel)}${catLabel&&loc?' · ':''}${esc(loc)}${company?' · '+esc(company):''}</div>
      ${chips.length?`<div class="rcard-chips">${chips.map(c=>'<span class="rcard-chip">'+c+'</span>').join('')}</div>`:''}
      <div class="rcard-foot">
        <div class="rcard-price">${v.daily_rate?'$'+Number(v.daily_rate).toLocaleString():'POA'}<small>${v.daily_rate?'Commercial Rate /day':''}</small></div>
        <span class="rcard-cta">${v.is_available?'View Details':'Instant Request'}</span>
      </div>
    </div>
  </a>`;
}

const RT_PAGE_SIZE=6;
// Server caps a page at 100; price sorts fetch that many once and paginate
// locally, since rental_search_listings only orders featured-first/newest.
const RT_SORT_FETCH=100;
let rtOffset=0,rtTotal=0,rtSortedRows=null;

// Fold the per-listing extras (see PMRentals.fetchRentalListingExtras) into
// each search row as the flags the filters and cards use. A listing-level
// setting or its operator's default both count.
function withExtras(rows,map){
  return rows.map(r=>{
    const x=map[r.id];if(!x)return r;
    const co=x.rental_companies||{},sp=x.rental_vehicle_specs;const spec=Array.isArray(sp)?sp[0]||{}:sp||{};
    const biz=co.businesses||{};
    return Object.assign({},r,{
      transmission:spec.transmission,seats:spec.seats,drive_type:spec.drive_type,
      _driver:Number(x.driver_rate)>0||!!co.driver_available,
      _cross:!!x.cross_border||!!co.cross_border,
      _insured:!!x.insurance_included||!!co.insurance_included,
      _noDeposit:!(Number(x.deposit)>0),
      _verified:Number(biz.verification_level)>=2
    });
  });
}
const RT_FLAG_KEYS={verified:'_verified',noDeposit:'_noDeposit',insurance:'_insured',driver:'_driver',crossBorder:'_cross'};
function activeFlags(){return [...document.querySelectorAll('.rtFlag:checked')].map(c=>c.value).filter(k=>RT_FLAG_KEYS[k])}
function enrich(rows){
  if(!rows.length||!PMRentals.fetchRentalListingExtras)return Promise.resolve(rows);
  return PMRentals.fetchRentalListingExtras(rows.map(r=>r.id)).then(map=>withExtras(rows,map));
}

function rtToday(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}

function currentFilters(){
  const sort=document.getElementById('rtSort').value;
  return {
    city: document.getElementById('rtCity').value.trim()||undefined,
    category: document.getElementById('rtCategory').value||undefined,
    startDate: document.getElementById('rtStart').value||undefined,
    endDate: document.getElementById('rtEnd').value||undefined,
    priceMin: document.getElementById('fltPriceMin').value||undefined,
    priceMax: document.getElementById('fltPriceMax').value||undefined,
    transmission: (document.querySelector('input[name="fltTrans"]:checked')||{}).value||undefined,
    availableOnly: false,
    featuredFirst: sort!=='newest',
    sort: sort,
    limit: RT_PAGE_SIZE,
    offset: rtOffset
  };
}

function renderPager(){
  const pager=document.getElementById('rtPager');
  const pages=Math.max(1,Math.ceil(rtTotal/RT_PAGE_SIZE));
  const current=Math.floor(rtOffset/RT_PAGE_SIZE)+1;
  if(pages<=1){pager.innerHTML='';return}
  let html='<button '+(current===1?'disabled':'')+' onclick="rtGoPage('+(current-1)+')">‹</button>';
  for(let p=1;p<=Math.min(pages,6);p++){
    html+='<button class="'+(p===current?'active':'')+'" onclick="rtGoPage('+p+')">'+p+'</button>';
  }
  if(pages>6)html+='<span style="padding:0 4px;color:var(--mute)">…</span><button onclick="rtGoPage('+pages+')">'+pages+'</button>';
  html+='<button '+(current===pages?'disabled':'')+' onclick="rtGoPage('+(current+1)+')">›</button>';
  pager.innerHTML=html;
}
function rtGoPage(p){rtOffset=(p-1)*RT_PAGE_SIZE;loadRentals(true)}
window.rtGoPage=rtGoPage;

// Hero caption shows the real lowest daily rate among current results,
// and stays hidden when there's nothing real to show.
function updateHeroRate(rows){
  const box=document.getElementById('rtHeroRate');if(!box)return;
  const rates=rows.map(r=>Number(r.daily_rate)).filter(n=>n>0);
  if(!rates.length){box.hidden=true;return}
  box.querySelector('b').textContent='From $'+Math.min.apply(null,rates).toLocaleString()+' / day';
  box.hidden=false;
}

function renderRows(rows,opts,exactTotal){
  const grid=document.getElementById('rtGrid');
  const count=document.getElementById('rtCount');
  if(!rows.length && rtOffset===0){
    grid.innerHTML='<div class="empty-state">No rental vehicles listed'+(opts.city?' in '+esc(opts.city):'')+' yet. Check back soon, or <a href="browse?cat=vehicles">browse vehicles for sale</a>.</div>';
    count.textContent='';
    document.getElementById('rtPager').innerHTML='';
    return;
  }
  grid.innerHTML=rows.map(rcard).join('');
  // Server-paged results have no total; a full page means "more may exist".
  rtTotal=exactTotal!=null?exactTotal:rtOffset+rows.length+(rows.length===RT_PAGE_SIZE?RT_PAGE_SIZE:0);
  count.innerHTML='Showing <b>'+(rtOffset+1)+'-'+(rtOffset+rows.length)+'</b>'+(exactTotal!=null?' of <b>'+exactTotal+'</b>':'')+' vehicles';
  renderPager();
}

function showLoadError(err){
  const msg=err&&/past|end date|two years/i.test(err.message||'')?esc(err.message):'Couldn\'t load rental vehicles right now. Please try again shortly.';
  document.getElementById('rtGrid').innerHTML='<div class="empty-state">'+msg+'</div>';
  document.getElementById('rtCount').textContent='';
  document.getElementById('rtPager').innerHTML='';
}

// Price sorts and the operator/scope filters aren't supported by the search
// RPC, so those fetch up to RT_SORT_FETCH matches once, then filter, sort and
// paginate locally. paging=true reuses that local result instead of refetching.
function loadRentals(paging){
  const opts=currentFilters();
  const flags=activeFlags();
  const priceSort=opts.sort==='price_asc'||opts.sort==='price_desc';
  const local=priceSort||flags.length>0;
  if(local && paging && rtSortedRows){
    renderRows(rtSortedRows.slice(rtOffset,rtOffset+RT_PAGE_SIZE),opts,rtSortedRows.length);
    return;
  }
  document.getElementById('rtGrid').innerHTML=skeletons(RT_PAGE_SIZE);
  const req=local?Object.assign({},opts,{limit:RT_SORT_FETCH,offset:0}):opts;
  PMRentals.fetchRentalListings(req).then(enrich).then(rows=>{
    if(local){
      let out=rows.filter(r=>flags.every(k=>r[RT_FLAG_KEYS[k]]));
      if(priceSort){
        const dir=opts.sort==='price_asc'?1:-1;
        out=out.slice().sort((a,b)=>{
          const x=Number(a.daily_rate)||0,y=Number(b.daily_rate)||0;
          if(!x!==!y)return x?-1:1; // unpriced (POA) listings last either way
          return (x-y)*dir;
        });
      }
      rtSortedRows=out;
      updateHeroRate(out);
      renderRows(out.slice(rtOffset,rtOffset+RT_PAGE_SIZE),opts,out.length);
    }else{
      rtSortedRows=null;
      if(rtOffset===0)updateHeroRate(rows);
      renderRows(rows,opts,null);
    }
  }).catch(showLoadError);
}
function runRentalSearch(){rtOffset=0;rtSortedRows=null;loadRentals()}
function resetRentalFilters(){
  document.getElementById('rtCity').value='';
  document.getElementById('rtStart').value='';
  document.getElementById('rtEnd').value='';
  document.getElementById('rtEnd').min=rtToday();
  document.getElementById('rtCategory').value='';
  document.querySelectorAll('.rtCatCheck').forEach(c=>c.checked=false);
  document.querySelectorAll('.rtFlag').forEach(c=>c.checked=false);
  document.getElementById('fltPriceMin').value='';
  document.getElementById('fltPriceMax').value='';
  document.querySelectorAll('input[name="fltTrans"]').forEach(r=>r.checked=(r.value===''));
  document.getElementById('rtSort').value='recommended';
  runRentalSearch();
}
window.runRentalSearch=runRentalSearch;
window.resetRentalFilters=resetRentalFilters;

// The search API filters on one category, so the sidebar checkboxes act as
// a single choice kept in sync with the Vehicle Class dropdown.
function syncCategoryChecks(){
  const v=document.getElementById('rtCategory').value;
  document.querySelectorAll('.rtCatCheck').forEach(c=>c.checked=(c.value===v&&v!==''));
}
document.getElementById('rtCategoryChecks').addEventListener('change',e=>{
  const box=e.target.closest('.rtCatCheck');if(!box)return;
  document.getElementById('rtCategory').value=box.checked?box.value:'';
  syncCategoryChecks();
  runRentalSearch();
});
document.getElementById('rtCategory').addEventListener('change',syncCategoryChecks);

// Transmission, price and the operator/scope filters apply as soon as they change.
document.querySelectorAll('.rtFlag').forEach(c=>c.addEventListener('change',runRentalSearch));
document.querySelectorAll('input[name="fltTrans"]').forEach(r=>r.addEventListener('change',runRentalSearch));
['fltPriceMin','fltPriceMax'].forEach(id=>document.getElementById(id).addEventListener('change',runRentalSearch));

// The search RPC rejects past dates and return-before-pickup, so stop the
// picker from offering them instead of failing after the fact.
(function wireDates(){
  const start=document.getElementById('rtStart'),end=document.getElementById('rtEnd'),today=rtToday();
  start.min=today;end.min=today;
  start.addEventListener('change',()=>{
    end.min=start.value||today;
    if(end.value&&start.value&&end.value<start.value)end.value=start.value;
  });
})();

// Populate the vehicle-class dropdown and sidebar checkboxes from the real
// rental category taxonomy rather than a hardcoded list.
(function loadCategories(){
  const checks=document.getElementById('rtCategoryChecks');
  if(!window.PMRentals||!PMRentals.fetchRentalCategories){checks.innerHTML='';return}
  PMRentals.fetchRentalCategories().then(cats=>{
    const select=document.getElementById('rtCategory');
    if(!cats||!cats.length){checks.innerHTML='';return}
    const keep=select.value;
    select.innerHTML='<option value="">All Vehicle Categories</option>'+cats.map(c=>'<option value="'+esc(c.slug)+'">'+esc(c.label)+'</option>').join('');
    select.value=keep;
    checks.innerHTML=cats.map(c=>'<label class="rt-check"><span><input type="checkbox" class="rtCatCheck" value="'+esc(c.slug)+'">'+esc(c.label)+'</span></label>').join('');
    syncCategoryChecks();
  }).catch(()=>{checks.innerHTML=''});
})();

const rtCityQ=new URLSearchParams(location.search).get('city')||'';
if(rtCityQ){
  const pageTitle='Car Rental in '+rtCityQ+', Zimbabwe | PaMarket';
  const pageDesc='Rent a vehicle in '+rtCityQ+', Zimbabwe from verified rental companies on PaMarket. Daily, weekly and monthly rates.';
  document.title=pageTitle;
  document.getElementById('pageTitle').textContent=pageTitle;
  document.getElementById('metaDesc').setAttribute('content',pageDesc);
  document.getElementById('ogTitle').setAttribute('content',pageTitle);
  document.getElementById('ogDesc').setAttribute('content',pageDesc);
  document.getElementById('twTitle').setAttribute('content',pageTitle);
  document.getElementById('twDesc').setAttribute('content',pageDesc);
  document.getElementById('crumbCur').textContent='Vehicle Rental in '+rtCityQ;
  document.getElementById('rtCity').value=rtCityQ;
}

loadRentals();
