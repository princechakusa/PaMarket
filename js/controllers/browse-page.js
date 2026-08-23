(function(root){
'use strict';
const document=root.document;
const PIN='<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const COLORS=['#EEF2FF','#FEF3C7','#DCFCE7','#FCE7F3','#E0F2FE','#FEF9C3','#F3E8FF','#FFEDD5'];
const TCOLORS=['#1A3A8F','#B27D22','#1F7A4D','#9D174D','#0369A1','#92400E','#7B2D8B','#C2410C'];
const CAT_LABELS={property:'Property',vehicles:'Vehicles',electronics:'Electronics',furniture:'Furniture',fashion:'Fashion',services:'Services',agriculture:'Agriculture',rooms:'Rooms to Rent',pets:'Pets',kids:'Baby & Kids',jobs:'Jobs'};
const PAGE_SIZE=20;
let state={cat:'',q:'',prov:'',city:'',sort:'created_at.desc',offset:0,shops:false};
const ZW_CITIES=['Harare','Bulawayo','Mutare','Gweru','Masvingo','Chinhoyi','Kadoma','Kwekwe','Victoria Falls'];
function hero(title,sub,image,alt,chips){return{title,sub,image,alt,chips};}
const CATEGORY_HEROES={
  all:hero('All listings across Zimbabwe.','Explore property, vehicles, electronics, services and more from sellers nationwide.','img/category-heroes/hero-all-listings.jpg','Zimbabwe marketplace featuring property, vehicles, technology and local services',[['Property','browse?cat=property'],['Vehicles','browse?cat=vehicles'],['Electronics','browse?cat=electronics'],['Furniture','browse?cat=furniture']]),
  property:hero('Find your next home in Zimbabwe.','Live listings from real sellers. Updated continuously.','img/category-heroes/hero-property.jpg','Large modern house with landscaped gardens',[['Houses','browse?cat=property&sub=houses'],['Flats & Apartments','browse?cat=property&sub=flats'],['Stands & Land','browse?cat=property&sub=stands'],['Commercial','browse?cat=property&sub=commercial']]),
  vehicles:hero('Cars, bakkies and bikes, ready to drive.','Live listings from real sellers. Updated continuously.','img/category-heroes/hero-vehicles.jpg','Toyota pickup overlooking a mountain lake',[['Cars','browse?cat=vehicles&sub=cars'],['SUVs & 4x4','browse?cat=vehicles&sub=suvs'],['Bakkies & Trucks','browse?cat=vehicles&sub=bakkies'],['Spares & Parts','browse?cat=vehicles&sub=parts']]),
  electronics:hero('Phones, laptops and gadgets you can trust.','Live listings from real sellers. Updated continuously.','img/category-heroes/hero-electronics.jpg','Laptops, phones, headphones and electronic accessories on display',[['Phones & Tablets','browse?cat=electronics&sub=phones'],['Laptops & Computers','browse?cat=electronics&sub=computers'],['TVs & Monitors','browse?cat=electronics&sub=tvs'],['Gaming','browse?cat=electronics&sub=gaming']]),
  furniture:{
    title:'Furnish your home for less.',
    sub:'Live listings from real sellers. Updated continuously.',
    image:'img/category-heroes/hero-furniture.jpg',alt:'Modern sofas, chairs and tables in a furniture showroom',
    chips:[['Sofas & Lounge','browse?cat=furniture&sub=sofas'],['Beds & Bedroom','browse?cat=furniture&sub=beds'],['Dining & Kitchen','browse?cat=furniture&sub=dining'],['Home Décor','browse?cat=furniture&sub=decor']]
  },
  fashion:hero('Style for every occasion.','Discover clothing, shoes and accessories from sellers across Zimbabwe.','img/category-heroes/hero-fashion.jpg','Fashionable woman walking through a city square',[['Clothing','browse?cat=fashion&sub=clothing'],['Shoes','browse?cat=fashion&sub=shoes'],['Bags & Luggage','browse?cat=fashion&sub=bags'],['Jewellery','browse?cat=fashion&sub=jewellery']]),
  services:hero('Find trusted help for every job.','Connect with local professionals offering practical services across Zimbabwe.','img/category-heroes/hero-services.jpg','Professional plumber repairing pipes beneath a kitchen sink',[['Home & Repairs','browse?cat=services&sub=home'],['Building & Construction','browse?cat=services&sub=building'],['Tutoring & Lessons','browse?cat=services&sub=tutoring'],['Transport & Moving','browse?cat=services&sub=transport']]),
  agriculture:hero('Everything you need to keep Zimbabwe growing.','Browse farm equipment, livestock, produce and supplies from local sellers.','img/category-heroes/hero-agriculture.jpg','Agricultural mechanic repairing farm machinery',[['Livestock','browse?cat=agriculture&sub=livestock'],['Crops & Produce','browse?cat=agriculture&sub=produce'],['Farm Equipment','browse?cat=agriculture&sub=equipment'],['Irrigation','browse?cat=agriculture&sub=irrigation']]),
  rooms:hero('Find a room that feels like home.','Browse rooms, cottages and shared homes available across Zimbabwe.','img/category-heroes/hero-rooms.jpg','Bright furnished bedroom available to rent',[['Single Rooms','browse?cat=rooms&sub=single'],['Shared Rooms','browse?cat=rooms&sub=shared'],['Self-Contained','browse?cat=rooms&sub=self-contained'],['Student Digs','browse?cat=rooms&sub=student']]),
  pets:hero('Find everything your pets need.','Browse pets, supplies and accessories from sellers across Zimbabwe.','img/category-heroes/hero-pets.jpg','Comfortable pet room with cats, dogs, beds and pet supplies',[['Dogs','browse?cat=pets&sub=dogs'],['Cats','browse?cat=pets&sub=cats'],['Birds','browse?cat=pets&sub=birds'],['Pet Accessories','browse?cat=pets&sub=accessories']]),
  shops:hero('Shop from trusted Zimbabwean businesses.','Browse verified businesses selling on PaMarket across Zimbabwe.','img/category-heroes/hero-shops.jpg','Customer speaking with a shop owner inside a local boutique',[['Electronics Shops','browse?shops=1&q=electronics'],['Fashion Shops','browse?shops=1&q=fashion'],['Hardware Shops','browse?shops=1&q=hardware'],['Open Your Shop','open-shop']])
};

function renderCategoryHero(){
  const key=state.shops?'shops':(state.cat||'all');
  const cfg=CATEGORY_HEROES[key];
  const hero=document.getElementById('catHero');
  if(!cfg||state.business){hero.hidden=true;return;}
  hero.hidden=false;
  const image=document.getElementById('catHeroImg');
  image.src=cfg.image;image.alt=cfg.alt;
  document.getElementById('catHeroTitle').textContent=cfg.title;
  document.getElementById('catHeroSub').textContent=cfg.sub;
  document.getElementById('catHeroChips').innerHTML=cfg.chips.map(chip=>'<a class="cat-hero-chip" href="'+chip[1]+'">'+chip[0]+'</a>').join('');
  const eyebrow=document.getElementById('catHeroEyebrow');
  eyebrow.textContent='';
  const countPromise=key==='shops'?PM.fetchExactCount('businesses','status=eq.active&verification_level=gt.0'):PMListings.fetchListingCount(key==='all'?'':key);
  countPromise.then(count=>{
    eyebrow.textContent=Number(count).toLocaleString()+(key==='shops'?' verified storefront'+(count===1?'':'s'):' live listing'+(count===1?'':'s'));
  }).catch(()=>{eyebrow.textContent='';});
}

function bcard(biz,idx){
  const bg=COLORS[idx%COLORS.length],tc=TCOLORS[idx%TCOLORS.length];
  const loc=[biz.city,biz.province].filter(Boolean).join(', ')||'Zimbabwe';
  const initials=(biz.name||'Shop').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const img=biz.logo||biz.cover?`<img src="${biz.logo||biz.cover}" alt="${(biz.name||'').replace(/"/g,'&quot;')}" loading="lazy">`:`<span style="color:${tc};font-weight:800;font-size:18px">${initials}</span>`;
  const verified=biz.verification_level>0?'<span class="shopcard-verified" title="Verified">✓</span>':'';
  return`<a class="shopcard" href="business?id=${biz.id}">
    <div class="shopcard-logo" style="background:${bg}">${img}</div><div class="shopcard-body">
      <div class="shopcard-name">${biz.name||'Shop'}${verified}</div><div class="shopcard-loc">${PIN} ${loc}</div></div></a>`;
}

function gcard(listing,idx){
  const bg=COLORS[idx%COLORS.length],tc=TCOLORS[idx%TCOLORS.length];
  const photo=listing.photos&&listing.photos.length?listing.photos[0]:null;
  const loc=[listing.suburb,listing.city].filter(Boolean).join(', ')||listing.province||'Zimbabwe';
  const isNew=(Date.now()-new Date(listing.created_at).getTime())<86400000*3;
  const isFeatured=listing.featured_until&&new Date(listing.featured_until)>new Date();
  const badge=isFeatured?'<div class="gcard-badge badge-feat">FEATURED</div>':(isNew?'<div class="gcard-badge">NEW</div>':'');
  const img=photo?`<img src="${photo}" alt="${listing.title.replace(/"/g,'&quot;')}" loading="lazy">`:`<div class="gcard-img-ph" style="color:${tc}">${listing.title.split(' ').slice(0,3).join('<br>')}</div>`;
  return`<a class="gcard" href="${PMUrls.listingPath(listing)}">
    <button type="button" class="gcard-save" data-save-listing="${listing.id}" aria-label="Save ${listing.title.replace(/"/g,'&quot;')}" onclick="event.preventDefault();event.stopPropagation();toggleFavourite(this)"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>
    <div class="gcard-img" style="background:${bg}">${badge}${img}</div><div class="gcard-body"><div class="gcard-price">${PM.money(listing.price,listing.currency)}</div><div class="gcard-title">${listing.title}</div><div class="gcard-loc">${PIN} ${loc}</div></div></a>`;
}

function skeletons(n){
  return Array.from({length:n}).map(()=>'<div class="gcard"><div class="gcard-img skeleton"></div><div class="gcard-body"><div class="skeleton" style="height:16px;width:60%;border-radius:4px;margin-bottom:8px"></div><div class="skeleton" style="height:12px;width:90%;border-radius:4px"></div></div></div>').join('');
}

function updateItemListSchema(rows){
  const existing=document.getElementById('itemListSchema');
  if(existing)existing.remove();
  if(!rows.length)return;
  const script=document.createElement('script');
  script.type='application/ld+json';
  script.id='itemListSchema';
  script.textContent=JSON.stringify({
    '@context':'https://schema.org',
    '@type':'ItemList',
    itemListElement:rows.slice(0,20).map((r,i)=>({
      '@type':'ListItem',
      position:i+1,
      url:PMUrls.listingUrl(r),
      name:r.title
    }))
  });
  document.head.appendChild(script);
}

function updateHero(){
  const tag=document.getElementById('heroTag'),title=document.getElementById('heroTitle'),sub=document.getElementById('heroSub');
  const place=state.city||state.prov||'';
  const catLabel=CAT_LABELS[state.cat]||state.cat;
  let pageTitle,pageDesc,crumbLabel,ogType='website',introText;

  if(state.shops){
    tag.textContent='Shops';
    title.textContent='Verified Business Shops';
    sub.textContent='Browse verified businesses selling on PaMarket across Zimbabwe.';
    pageTitle='Verified Business Shops — PaMarket Zimbabwe';
    pageDesc='Browse verified business shops selling on PaMarket across Zimbabwe.';
    crumbLabel='Shops';
    introText='PaMarket Shops are verified businesses selling directly through the platform — from electronics retailers to furniture stores to service providers. Every Shop is reviewed before verification, giving buyers extra confidence when shopping from a business rather than an individual seller. Browsing and contacting Shops is completely free, with no commission taken on any purchase.';
  }else if(state.business){
    tag.textContent='Shop';
    title.textContent='Listings from this shop';
    sub.textContent='All active listings from this verified business.';
    pageTitle='Shop Listings — PaMarket Zimbabwe';
    pageDesc='All active listings from this verified PaMarket business.';
    crumbLabel='Shop';
    introText='';
  }else if(state.cat && place){
    tag.textContent=catLabel;
    title.textContent=catLabel+' in '+place+', Zimbabwe';
    sub.textContent='Browse '+catLabel.toLowerCase()+' listings in '+place+'. Updated continuously, always free.';
    pageTitle=catLabel+' for Sale in '+place+' | PaMarket Zimbabwe';
    pageDesc='Find '+catLabel.toLowerCase()+' listings in '+place+', Zimbabwe on PaMarket. Live listings from real sellers, updated daily. No fees, no commissions.';
    crumbLabel=catLabel+' in '+place;
    ogType='product.group';
    introText='PaMarket lists '+catLabel.toLowerCase()+' directly from sellers in '+place+', updated continuously throughout the day. Every listing includes real photos, an accurate price in USD, and the seller\'s general location within '+place+', so you know roughly where to expect to meet before you even make contact. Contact sellers directly through WhatsApp to ask questions or arrange a viewing — PaMarket never charges a fee to browse, contact a seller, or complete a sale in '+place+' or anywhere else in Zimbabwe. If you cannot find what you are looking for in '+place+' right now, try widening your search to the surrounding province, or check back soon as new listings are added throughout the day. Selling in '+place+' is just as free — post your own listing in under two minutes with no fees or commission at any point.';
  }else if(state.cat){
    tag.textContent=catLabel;
    title.textContent=catLabel+' listings in Zimbabwe';
    sub.textContent='Live listings from real sellers. Updated continuously.';
    pageTitle=catLabel+' for Sale in Zimbabwe | PaMarket';
    pageDesc='Browse '+catLabel.toLowerCase()+' listings across Zimbabwe on PaMarket — Harare, Bulawayo and all 10 provinces. Free to browse and post.';
    crumbLabel=catLabel;
    ogType='product.group';
    introText='PaMarket lists '+catLabel.toLowerCase()+' from sellers across all ten provinces of Zimbabwe, including Harare, Bulawayo, Mutare, Gweru and Masvingo. Use the filters above to narrow results by province, city or keyword, or browse everything currently available. Every listing is posted directly by the seller with real photos and a price in USD — there are no listing fees or commission on any sale, and you contact sellers directly through WhatsApp to arrange a safe, in-person meeting. New listings go live throughout the day after a quick review, so checking back regularly is worthwhile if you have not found the right match yet. Selling is completely free too — post your own listing in under two minutes with no charge at any step.';
  }else if(place){
    tag.textContent=place;
    title.textContent='Listings in '+place+', Zimbabwe';
    sub.textContent='Browse everything for sale in '+place+' on PaMarket. Updated continuously.';
    pageTitle='Classifieds in '+place+', Zimbabwe | PaMarket';
    pageDesc='Browse property, vehicles, electronics, jobs and more for sale in '+place+', Zimbabwe on PaMarket.';
    crumbLabel=place;
    introText='PaMarket lists classifieds from sellers across '+place+', spanning property, vehicles, electronics, furniture, jobs and more. Filter by category above to narrow down to exactly what you are looking for in '+place+', or browse the full range of what is currently for sale. Every listing includes a real photo and an accurate price in USD, posted directly by the person selling it — there is no middleman involved. As with every listing on PaMarket, there are no fees to browse, post, or contact a seller directly, and you can reach out through WhatsApp as soon as you find something you like. If you are selling something yourself in '+place+', posting takes under two minutes and is completely free.';
  }else if(state.q){
    tag.textContent='Search';
    title.textContent='Results for "'+state.q+'"';
    sub.textContent='Live listings from real sellers. Updated continuously.';
    pageTitle='Search: '+state.q+' | PaMarket Zimbabwe';
    pageDesc='Search results for "'+state.q+'" on PaMarket, Zimbabwe\'s free marketplace.';
    crumbLabel='Search';
    introText='';
  }else{
    tag.textContent='Browse';
    title.textContent='All listings across Zimbabwe';
    sub.textContent='Live listings from real sellers. Updated continuously.';
    pageTitle='Browse Listings — PaMarket Zimbabwe';
    pageDesc='Thousands of live listings across Zimbabwe. Updated daily.';
    crumbLabel='Browse';
    introText='PaMarket lists thousands of live classifieds across all ten provinces of Zimbabwe, covering property, vehicles, electronics, furniture, jobs and more. Every listing is posted directly by real sellers — there are no listing fees or commission on any sale, and you contact sellers directly to arrange a safe, in-person transaction. Use the category and location filters above to narrow results by what you are looking for and where you are based, whether that is Harare, Bulawayo, Mutare, or any of the other cities and provinces PaMarket covers. New listings are added continuously throughout the day, so it is worth checking back regularly if you do not find what you need on your first visit. Selling is just as free as browsing — post your own listing in under two minutes with no charge to list, promote, or complete a sale.';
  }

  const introEl=document.getElementById('browseIntro');
  const introSection=document.getElementById('browseIntroSection');
  if(introEl&&introSection){
    if(introText){introEl.textContent=introText;introSection.classList.remove('hidden');}
    else{introSection.classList.add('hidden');}
  }

  const popEl=document.getElementById('popularCities');
  if(popEl){
    let popLinks=[];
    if(state.cat&&!place){
      popLinks=ZW_CITIES.slice(0,4).map(c=>({label:catLabel+' in '+c,href:'browse?cat='+state.cat+'&city='+encodeURIComponent(c)}));
    }else if(state.cat&&place){
      popLinks=[{label:'All '+catLabel+' in Zimbabwe',href:'browse?cat='+state.cat}];
    }
    if(popLinks.length){
      popEl.classList.remove('hidden');
      popEl.innerHTML=popLinks.map(l=>'<a href="'+l.href+'" style="background:#fff;border:1px solid var(--line);border-radius:20px;padding:7px 14px;font-size:12.5px;font-weight:600;color:var(--sub)">'+l.label+'</a>').join('');
    }else{
      popEl.classList.add('hidden');
    }
  }

  document.title=pageTitle;
  document.getElementById('pageTitle').textContent=pageTitle;
  document.getElementById('metaDesc').setAttribute('content',pageDesc);
  document.getElementById('ogTitle').setAttribute('content',pageTitle);
  document.getElementById('ogDesc').setAttribute('content',pageDesc);
  document.getElementById('twTitle').setAttribute('content',pageTitle);
  document.getElementById('twDesc').setAttribute('content',pageDesc);
  document.getElementById('crumbCur').textContent=crumbLabel;
  const canonicalUrl='https://pamarketzw.com/browse'+(state.shops?'?shops=1':(state.cat?'?cat='+state.cat:''));
  document.getElementById('canonicalLink').setAttribute('href',canonicalUrl);
  document.getElementById('ogUrl').setAttribute('content',canonicalUrl);

  document.getElementById('rentalBanner').classList.toggle('hidden',state.cat!=='vehicles');
  renderCategoryHero();

  // The shared header (stamped by tools/build-includes.js) may not carry
  // these ids — never let a missing element kill init, which blocks
  // runQuery() and leaves the whole browse page stuck on "Loading…".
  const postAdHref='post-ad'+(state.cat==='vehicles'?'?type=vehicles':'');
  const postAdBtn=document.getElementById('postAdBtn');
  if(postAdBtn)postAdBtn.href=postAdHref;
  const postAdBtnMob=document.getElementById('postAdBtnMob');
  if(postAdBtnMob)postAdBtnMob.href=postAdHref;
}

function highlightCatNav(){
  document.querySelectorAll('#catNav .cnav').forEach(a=>{
    const dc=a.getAttribute('data-cat');
    if(state.shops)a.classList.toggle('on',dc==='shops');
    else a.classList.toggle('on',dc===state.cat && state.cat!=='');
  });
}

async function runQuery(append){
  const grid=document.getElementById('resultsGrid');
  const countEl=document.getElementById('resultsCount');
  const loadBtn=document.getElementById('loadMoreBtn');
  const noun=state.shops?'shop':'listing';
  grid.classList.toggle('shops-grid',state.shops);
  if(!append){grid.innerHTML=skeletons(8);countEl.textContent='Loading '+noun+'s…';loadBtn.classList.add('hidden')}
  try{
    let rows,cardFn;
    if(state.shops){
      rows=await PMBusinesses.fetchBusinesses({q:state.q||undefined,limit:PAGE_SIZE,offset:state.offset});
      cardFn=bcard;
    }else{
      // Default "newest" sort gets paid boosts pinned first (featuredFirst);
      // an explicit sort choice (price etc.) is respected untouched.
      const defaultSort=state.sort==='created_at.desc';
      rows=await PMListings.fetchListings({category:state.cat||undefined,subcat:state.sub||undefined,q:state.q||undefined,province:state.prov||undefined,city:state.city||undefined,businessId:state.business||undefined,order:defaultSort?undefined:state.sort,featuredFirst:defaultSort,limit:PAGE_SIZE,offset:state.offset});
      cardFn=gcard;
    }
    if(!append)grid.innerHTML='';
    if(!rows.length && !append){
      grid.innerHTML=PMFeedback.empty('No '+noun+'s found'+(state.shops?' yet.':' for these filters.'),{style:'grid-column:1/-1',actionHref:'browse',actionLabel:'Clear filters and browse everything'});
      countEl.textContent='0 '+noun+'s found';
      return;
    }
    grid.insertAdjacentHTML('beforeend',rows.map((r,i)=>cardFn(r,state.offset+i)).join(''));
    if(!state.shops)syncFavouriteButtons();
    const shown=grid.querySelectorAll('.gcard, .shopcard').length;
    countEl.innerHTML='<b>'+shown+'</b> '+noun+(shown===1?'':'s')+' shown';
    loadBtn.classList.toggle('hidden',rows.length<PAGE_SIZE);
    if(!state.shops && !append)updateItemListSchema(rows);
  }catch(e){
    if(!append)grid.innerHTML=PMFeedback.error('Couldn\'t load '+noun+'s right now. Please try again shortly.',{style:'grid-column:1/-1'});
    countEl.textContent='';
  }
}

let loadingMore=false;
async function loadMore(){
  if(loadingMore)return;
  loadingMore=true;
  state.offset+=PAGE_SIZE;
  try{await runQuery(true);}finally{loadingMore=false;}
}

// Infinite scroll: auto-trigger Load More when the button nears the viewport.
// The button stays as a visible manual fallback (and for browsers without
// IntersectionObserver). runQuery hides it when a page comes back short.
function setupInfiniteScroll(){
if('IntersectionObserver' in window){
  const btn=document.getElementById('loadMoreBtn');
  if(btn)new IntersectionObserver((entries)=>{
    if(entries.some(e=>e.isIntersecting)&&!btn.classList.contains('hidden'))loadMore();
  },{rootMargin:'600px'}).observe(btn);
}
}

function syncFromUrl(){
  const p=new URLSearchParams(location.search);
  state.cat=p.get('cat')||'';
  state.q=p.get('q')||'';
  state.prov=p.get('prov')||'';
  state.city=p.get('city')||'';
  state.shops=p.get('shops')==='1';
  state.business=p.get('business')||'';
  state.sub=p.get('sub')||'';
  document.getElementById('fCat').value=state.cat;
  document.getElementById('fQ').value=state.q;
  document.getElementById('fProv').value=state.prov;
  document.getElementById('fCity').value=state.city;
  if(state.shops){
    document.getElementById('filtersPanel').classList.add('hidden');
    document.getElementById('browseLayout').classList.add('no-filters');
  }
}

function applyFilters(){
  state.cat=document.getElementById('fCat').value;
  state.q=document.getElementById('fQ').value.trim();
  state.prov=document.getElementById('fProv').value;
  state.city=document.getElementById('fCity').value;
  state.sort=document.getElementById('sortSelect').value;
  state.offset=0;
  const u=new URLSearchParams();
  if(state.cat)u.set('cat',state.cat);
  if(state.q)u.set('q',state.q);
  if(state.prov)u.set('prov',state.prov);
  if(state.city)u.set('city',state.city);
  history.replaceState(null,'','browse'+(u.toString()?'?'+u.toString():''));
  updateHero();highlightCatNav();runQuery(false);
}

function applyFiltersMobile(){
  document.getElementById('fCat').value=document.getElementById('fCatM').value;
  document.getElementById('fQ').value=document.getElementById('fQM').value;
  document.getElementById('fProv').value=document.getElementById('fProvM').value;
  document.getElementById('fCity').value=document.getElementById('fCityM').value;
  closeDrawer();
  applyFilters();
}

async function saveCurrentSearch(){
  const session=PM.getSession();
  if(!(session&&session.user)){location.href='auth?return='+encodeURIComponent(location.pathname+location.search);return;}
  const filters={category:state.cat||'',q:state.q||'',province:state.prov||'',city:state.city||'',sort:state.sort||'created_at.desc'};
  const suggestion=[state.q,state.city||state.prov,state.cat].filter(Boolean).join(' · ')||'All listings';
  const name=prompt('Name this search',suggestion);
  if(name===null)return;
  const button=document.getElementById('saveSearchBtn');button.disabled=true;
  try{await PM.saveSearch(name||suggestion,filters);button.textContent='Search saved';button.classList.add('saved');}
  catch(e){alert('Could not save this search. Please try again.');}
  finally{button.disabled=false;}
}

async function toggleFavourite(button){
  const session=PM.getSession();
  if(!(session&&session.user)){location.href='auth?return='+encodeURIComponent(location.pathname+location.search);return;}
  const id=button.getAttribute('data-save-listing');button.disabled=true;
  try{if(button.classList.contains('saved')){await PM.unsaveListing(id);button.classList.remove('saved');button.setAttribute('aria-label','Save listing');}else{await PM.saveListing(id);button.classList.add('saved');button.setAttribute('aria-label','Remove from favourites');}}
  catch(e){alert('Could not update favourites. Please try again.');}
  finally{button.disabled=false;}
}

function syncFavouriteButtons(){
  if(!(PM.getSession&&PM.getSession()))return;
  PM.listFavouriteIds().then(rows=>{const ids=new Set(rows.map(r=>String(r.listing_id)));document.querySelectorAll('[data-save-listing]').forEach(b=>b.classList.toggle('saved',ids.has(b.getAttribute('data-save-listing'))));}).catch(()=>{});
}

function openDrawer(){
  document.getElementById('fCatM').value=state.cat;
  document.getElementById('fProvM').value=state.prov;
  document.getElementById('fCityM').value=state.city;
  document.getElementById('fQM').value=state.q;
  document.getElementById('drawerBg').classList.add('show');
  document.getElementById('filterDrawer').classList.add('open');
}
function closeDrawer(){
  document.getElementById('drawerBg').classList.remove('show');
  document.getElementById('filterDrawer').classList.remove('open');
}

// ── Header search ──
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
function setupHeaderDismiss(){
document.addEventListener('click',e=>{
  const h=document.getElementById('hdr');
  const n=document.getElementById('mobNav');
  if(n && n.classList.contains('open') && h && !h.contains(e.target))n.classList.remove('open');
});

}

let initialized=false;
function init(){
  if(initialized)return;
  initialized=true;
  setupInfiniteScroll();
  setupHeaderDismiss();
  syncFromUrl();
  updateHero();
  highlightCatNav();
  runQuery(false);
}
function getState(){return Object.assign({},state);}
const api=Object.freeze({init,getState,runQuery,loadMore,syncFromUrl,applyFilters,applyFiltersMobile,saveCurrentSearch,toggleFavourite,renderListingCard:gcard,renderBusinessCard:bcard,updateItemListSchema});
root.PMBrowsePage=api;
Object.assign(root,{loadMore,applyFilters,applyFiltersMobile,saveCurrentSearch,toggleFavourite,openDrawer,closeDrawer,doSearch,toggleMob});
})(typeof self!=='undefined'?self:this);
