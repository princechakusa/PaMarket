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
  const availTxt=v.is_available?'Self-Drive':'Booked';
  const badges=[];
  if(v.is_featured)badges.push('<span class="rcard-badge">★ Tier 1 Operator</span>');
  if(v.driver_rate)badges.push('<span class="rcard-badge transport">Driver Available</span>');
  const chips=[];
  if(v.transmission)chips.push(esc(human(v.transmission)));
  if(v.seats)chips.push(v.seats+' Seats');
  if(v.drive_type)chips.push(esc(v.drive_type.toUpperCase()));
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
let rtOffset=0,rtTotal=0;

function currentFilters(){
  return {
    city: document.getElementById('rtCity').value.trim()||undefined,
    category: document.getElementById('rtCategory').value||undefined,
    startDate: document.getElementById('rtStart').value||undefined,
    endDate: document.getElementById('rtEnd').value||undefined,
    priceMin: document.getElementById('fltPriceMin').value||undefined,
    priceMax: document.getElementById('fltPriceMax').value||undefined,
    transmission: (document.querySelector('input[name="fltTrans"]:checked')||{}).value||undefined,
    availableOnly: false,
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
function rtGoPage(p){rtOffset=(p-1)*RT_PAGE_SIZE;loadRentals()}
window.rtGoPage=rtGoPage;

function loadRentals(){
  document.getElementById('rtGrid').innerHTML=skeletons(RT_PAGE_SIZE);
  const opts=currentFilters();
  PMRentals.fetchRentalListings(opts).then(rows=>{
    const grid=document.getElementById('rtGrid');
    const count=document.getElementById('rtCount');
    if(!rows.length && rtOffset===0){
      grid.innerHTML='<div class="empty-state">No rental vehicles listed'+(opts.city?' in '+esc(opts.city):'')+' yet. Check back soon, or <a href="browse?cat=vehicles">browse vehicles for sale</a> instead.</div>';
      count.textContent='';
      document.getElementById('rtPager').innerHTML='';
      return;
    }
    grid.innerHTML=rows.map(rcard).join('');
    // rental_search_listings does not return a total count; treat a full
    // page as "more may exist" so the pager stays honest rather than
    // guessing a number the API never gave us.
    rtTotal=rtOffset+rows.length+(rows.length===RT_PAGE_SIZE?RT_PAGE_SIZE:0);
    count.innerHTML='Showing <b>'+(rtOffset+1)+'-'+(rtOffset+rows.length)+'</b> verified vehicles';
    renderPager();
  }).catch(()=>{
    document.getElementById('rtGrid').innerHTML='<div class="empty-state">Couldn\'t load rental vehicles right now. Please try again shortly.</div>';
    document.getElementById('rtCount').textContent='';
    document.getElementById('rtPager').innerHTML='';
  });
}
function runRentalSearch(){rtOffset=0;loadRentals()}
function resetRentalFilters(){
  document.getElementById('rtCity').value='';
  document.getElementById('rtStart').value='';
  document.getElementById('rtEnd').value='';
  document.getElementById('rtCategory').value='';
  document.getElementById('fltPriceMin').value='';
  document.getElementById('fltPriceMax').value='';
  document.querySelectorAll('input[name="fltTrans"]').forEach(r=>r.checked=(r.value===''));
  runRentalSearch();
}
window.runRentalSearch=runRentalSearch;
window.resetRentalFilters=resetRentalFilters;

// Populate the vehicle-class dropdown and sidebar checkboxes from the real
// rental category taxonomy rather than a hardcoded list, so it stays in
// sync with whatever categories actually exist server-side.
(function loadCategories(){
  if(!window.PMRentals||!PMRentals.fetchRentalCategories){
    document.getElementById('rtCategoryChecks').innerHTML='';
    return;
  }
  PMRentals.fetchRentalCategories().then(cats=>{
    const select=document.getElementById('rtCategory');
    const checks=document.getElementById('rtCategoryChecks');
    if(!cats||!cats.length){checks.innerHTML='';return}
    select.innerHTML='<option value="">All Vehicle Categories</option>'+cats.map(c=>'<option value="'+esc(c.slug)+'">'+esc(c.label)+'</option>').join('');
    checks.innerHTML=cats.map(c=>'<label class="rt-check"><span><input type="checkbox" class="rtCatCheck" value="'+esc(c.slug)+'">'+esc(c.label)+'</span></label>').join('');
  }).catch(()=>{document.getElementById('rtCategoryChecks').innerHTML=''});
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

function doSearch(){
  const q=document.getElementById('hQ')?.value?.trim();
  const cat=document.getElementById('hCat')?.value;
  if(cat==='jobs'){window.location='jobs'+(q?'?q='+encodeURIComponent(q):'');return}
  let u='browse?';
  if(q)u+='q='+encodeURIComponent(q);
  if(cat)u+=(q?'&':'')+'cat='+encodeURIComponent(cat);
  window.location=u==='browse?'?'browse':u;
}
function toggleMob(){
  document.getElementById('mobNav').classList.toggle('open');
}
document.addEventListener('click',e=>{
  const h=document.getElementById('hdr');
  const n=document.getElementById('mobNav');
  if(n && n.classList.contains('open') && h && !h.contains(e.target))n.classList.remove('open');
});
