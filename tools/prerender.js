// Pre-renders static, crawlable HTML pages so non-JS crawlers (Google, GPTBot,
// ClaudeBot, PerplexityBot) get real content + baked JSON-LD instead of the
// client-rendered shells at /detail?id=, /rental-detail?id= and /business?id=.
//
// Output:  l/<slug>-<id>.html  (listings + jobs — Product/JobPosting/Vehicle)
//          r/<slug>-<id>.html  (rental vehicles — Vehicle)
//          b/<slug>-<id>.html  (business shops — Store + ProfilePage)
//
// These are physical filenames only (GitHub Pages needs a real file on
// disk). The preferred/canonical public URL is the extensionless form —
// l/<slug>-<id>, r/<slug>-<id>, b/<slug>-<id> — which GitHub Pages serves
// from the very same file automatically. PMSchema.listing/rental/business
// -Url() (js/listing-schema.js) is the one place that builds the canonical
// URL; -FilePath() below is the one place that builds the on-disk name.
//
// Runs in CI (sitemap.yml) where it fetches active rows via secrets and the
// pages are committed, so the branch-based Pages deploy serves them.
//
// Run locally:  node tools/prerender.js
//               PRERENDER_OUT=/tmp/out PRERENDER_LIMIT=5 node tools/prerender.js
const fs = require('fs');
const path = require('path');
const PMSchema = require('../js/listing-schema.js');

const SITE = 'https://pamarketzw.com';
const ROOT = path.join(__dirname, '..');
const OUT = process.env.PRERENDER_OUT || ROOT;   // writes OUT/l, OUT/r, OUT/b
const LIMIT = process.env.PRERENDER_LIMIT ? parseInt(process.env.PRERENDER_LIMIT, 10) : 0;

function loadSupabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  }
  const src = fs.readFileSync(path.join(ROOT, 'js', 'supabase-config.js'), 'utf8');
  return { url: src.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1] };
}

function headers(cfg) { return { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key }; }

async function pget(cfg, pathq) {
  const res = await fetch(cfg.url + '/rest/v1/' + pathq, { headers: headers(cfg) });
  if (!res.ok) { console.warn('prerender fetch ' + res.status + ' — ' + pathq.slice(0, 80) + ' — ' + (await res.text()).slice(0, 140)); return []; }
  return res.json();
}

async function fetchActiveListings(cfg) {
  const select = 'id,title,description,price,currency,category,province,city,suburb,photos,seller_id,seller_name,seller_phone,business_id,attributes,condition,views,featured_until,created_at';
  const rows = []; let offset = 0;
  for (;;) {
    const page = await pget(cfg, 'listings?status=eq.active&order=created_at.desc&select=' + select + '&limit=1000&offset=' + offset);
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000; if (LIMIT && rows.length >= LIMIT) break;
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

// One bulk fetch of recent reviews, grouped by seller — powers the visible
// "Seller Reviews" section (and JSON-LD aggregateRating) on every /l/ page
// without a per-listing request.
async function fetchReviewsBySeller(cfg) {
  const bySeller = {}; let offset = 0;
  for (;;) {
    const page = await pget(cfg, 'reviews?select=seller_id,reviewer_name,rating,body,created_at&order=created_at.desc&limit=1000&offset=' + offset);
    for (const r of page) {
      if (!r.seller_id) continue;
      (bySeller[r.seller_id] = bySeller[r.seller_id] || []).push(r);
    }
    if (page.length < 1000 || offset >= 9000) break;
    offset += 1000;
  }
  return bySeller;
}

async function fetchActiveRentals(cfg) {
  const select = '*,rental_brands(label),rental_categories(label),rental_locations(city,province),' +
    'rental_vehicle_media(url,is_cover,sort_order),rental_vehicle_features(feature),' +
    'rental_companies(business_id,trading_name,rental_phone,rental_whatsapp,rental_email,' +
    'year_established,deposit_policy,driver_available,cross_border,insurance_included,avg_rating,review_count)';
  const rows = await pget(cfg, 'rental_vehicle_listings?status=eq.active&admin_status=eq.approved&deleted_at=is.null&order=created_at.desc&select=' + encodeURIComponent(select) + '&limit=1000');
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

async function fetchActiveBusinesses(cfg) {
  const businesses = await pget(cfg, 'businesses?status=eq.active&order=updated_at.desc&select=*&limit=1000');
  const list = LIMIT ? businesses.slice(0, LIMIT) : businesses;
  const prodSelect = 'id,title,price,currency,category,photos,suburb,city,province';
  for (const b of list) {
    let products = await pget(cfg, 'listings?business_id=eq.' + encodeURIComponent(b.id) + '&status=eq.active&select=' + prodSelect + '&limit=20');
    if ((!products || !products.length) && b.owner_user_id) {
      products = await pget(cfg, 'listings?seller_id=eq.' + encodeURIComponent(b.owner_user_id) + '&status=eq.active&select=' + prodSelect + '&limit=20');
    }
    b._products = products || [];
    b._reviews = b.owner_user_id
      ? await pget(cfg, 'reviews?seller_id=eq.' + encodeURIComponent(b.owner_user_id) + '&select=reviewer_name,rating,body,created_at&order=created_at.desc&limit=20')
      : [];
  }
  return list;
}

// --- rendering helpers -------------------------------------------------------
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(n, c) { n = Number(n) || 0; return (c === 'ZWG' || c === 'ZiG' ? 'ZWG ' : '$') + n.toLocaleString('en-US'); }
function timeAgo(iso) {
  const d = new Date(iso); const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  return d.toISOString().slice(0, 10);
}
// Escape "<" so a "</script>" in any user string can't break out of a
// <script type="application/ld+json"> tag.
function jsonld(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }
function stars(r) { const f = Math.max(0, Math.min(5, Math.round(Number(r) || 0))); return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f); }
function initialsOf(name) { return esc(String(name || 'P').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || 'P'); }
function avgRating(reviews) { return reviews.length ? reviews.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0) / reviews.length : 0; }

// Styled review cards + rating summary, shared by listing and business pages.
// The .rev/.rating-* CSS lives in the page style blocks (detail.html and
// business.html) that shell() bakes in.
function reviewsHtml(reviews, subjectLabel) {
  if (!reviews || !reviews.length) return '';
  const avg = avgRating(reviews);
  const hero = '<div class="rating-hero"><div class="rating-big">' + avg.toFixed(1) + '</div><div>' +
    '<div class="rating-stars">' + stars(avg) + '</div>' +
    '<div class="rating-count">Based on ' + reviews.length + ' verified review' + (reviews.length > 1 ? 's' : '') + (subjectLabel ? ' of ' + esc(subjectLabel) : '') + '</div></div></div>';
  const list = '<div class="rev-list">' + reviews.slice(0, 10).map(function (r) {
    return '<div class="rev"><div class="rev-top"><div class="rev-av">' + initialsOf(r.reviewer_name) + '</div>' +
      '<div><div class="rev-who">' + esc(r.reviewer_name || 'PaMarket user') + '</div><div class="rev-date">' + esc(timeAgo(r.created_at)) + '</div></div>' +
      '<div class="rev-stars">' + stars(r.rating) + '</div></div>' +
      (r.body ? '<div class="rev-body">' + esc(r.body) + '</div>' : '') + '</div>';
  }).join('') + '</div>';
  return hero + list;
}

function loadChrome() {
  const detail = fs.readFileSync(path.join(ROOT, 'detail.html'), 'utf8');
  const business = fs.readFileSync(path.join(ROOT, 'business.html'), 'utf8');
  const styleMatch = detail.match(/<style>([\s\S]*?)<\/style>/);
  const bizStyleMatch = business.match(/<style>([\s\S]*?)<\/style>/);
  return {
    style: styleMatch ? styleMatch[1] : '',
    bizStyle: bizStyleMatch ? bizStyleMatch[1] : '',
    header: fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8'),
    footer: fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8')
  };
}

// Shared page shell. o: { url, pageTitle, desc, ogImg, ogType, schema[], crumb,
// main, hydrateListingId?, chrome }
function shell(o) {
  const blocks = o.schema.map(function (s) { return '<script type="application/ld+json">' + jsonld(s) + '</script>'; }).join('\n');
  const hyd = o.hydrateListingId ? (
    '<script>window.__LISTING_ID=' + JSON.stringify(String(o.hydrateListingId)) + ';</script>\n' +
    '<script>(function(){\n' +
    '  try{ if(window.PM&&PM.fetchListingState){ PM.fetchListingState(window.__LISTING_ID).then(function(state){\n' +
    '    if(state==="removed"||state==="review"||state==="sold"){\n' +
    '      var c=document.getElementById("detailContent"); if(c)c.style.display="none";\n' +
    '      var u=document.getElementById("unavailableState"); if(u)u.style.display="block";\n' +
    '      var m=document.querySelector("meta[name=robots]"); if(m)m.setAttribute("content","noindex, nofollow");\n' +
    '    }\n' +
    '  }).catch(function(){}); } }catch(e){}\n' +
    '})();</script>\n') : '';
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2601167334065110"\n     crossorigin="anonymous"></script>\n' +
    '<meta charset="UTF-8">\n<base href="' + SITE + '/">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(o.pageTitle) + '</title>\n' +
    '<meta name="description" content="' + esc(o.desc) + '">\n' +
    '<link rel="canonical" href="' + o.url + '">\n' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">\n' +
    '<meta property="og:type" content="' + (o.ogType || 'website') + '">\n' +
    '<meta property="og:title" content="' + esc(o.pageTitle) + '">\n' +
    '<meta property="og:description" content="' + esc(o.desc) + '">\n' +
    '<meta property="og:image" content="' + esc(o.ogImg) + '">\n' +
    '<meta property="og:url" content="' + o.url + '">\n<meta property="og:locale" content="en_ZW">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + esc(o.pageTitle) + '">\n' +
    '<meta name="twitter:description" content="' + esc(o.desc) + '">\n' +
    '<meta name="twitter:image" content="' + esc(o.ogImg) + '">\n' +
    '<meta name="geo.region" content="ZW">\n<meta name="geo.placename" content="Zimbabwe">\n' +
    '<link rel="icon" href="img/icon-192.png" type="image/png">\n' +
    '<link rel="stylesheet" href="css/site.css">\n<style>' + (o.style || o.chrome.style) + '</style>\n' +
    blocks + '\n</head>\n<body>\n' + o.chrome.header + '\n' + o.crumb + '\n' + o.main + '\n' + o.chrome.footer + '\n' +
    hyd +
    '<script src="js/supabase-config.js"></script>\n<script src="js/session.js"></script>\n<script src="js/marketplace-data.js"></script>\n<script src="js/nav-dropdowns.js"></script>\n' +
    (o.extrasMeta ? '<script src="js/listing-extras.js"></script>\n<script>window.PMListingExtras&&PMListingExtras.init(' + jsonld(o.extrasMeta) + ');</script>\n' : '') +
    (o.afterScripts ? '<script>' + o.afterScripts + '</script>\n' : '') +
    '</body>\n</html>\n';
}

function renderListing(l, chrome) {
  // This static page IS the canonical — it's the one with real content
  // (detail.html is a client-rendered shell that's empty until Supabase
  // data loads, which makes Google's indexer do extra, unreliable work for
  // no benefit). PMSchema.listingUrl(l) is the extensionless public URL;
  // sitemap.xml, detail.html's own canonical and this page's own canonical
  // all agree on it (GitHub Pages serves this same file at both the
  // extensionless URL and its on-disk l/*.html name — see PMSchema.
  // listingFilePath). detail.html's own canonical points HERE too, so the
  // two pages still agree — avoiding the "Duplicate, Google chose different
  // canonical than user" alert (2026-07-28) the old self-vs-live split
  // caused, just with the agreement flipped to the content-rich page.
  const url = PMSchema.listingUrl(l);
  const catLabel = PMSchema.catLabelOf(l);
  const loc = PMSchema.locOf(l);
  const photos = (l.photos && l.photos.length) ? l.photos : [];
  const isJob = l.category === 'jobs';
  const priceStr = isJob ? (l.price ? money(l.price, l.currency) + '/mo' : 'Salary negotiable') : money(l.price, l.currency);
  const title = esc(l.title);
  const mainImg = photos.length ? '<img src="' + esc(photos[0]) + '" alt="' + title + '" fetchpriority="high" decoding="async"><span class="gallery-open-hint">↗ View full image</span><span class="gallery-count">1 / ' + photos.length + '</span>' : '<div class="gallery-main-ph">' + title + '</div>';
  const thumbs = photos.length ? '<div class="gallery-thumbs" id="galleryThumbs">' + photos.map(function (p, i) { return '<button type="button" class="gallery-thumb' + (i === 0 ? ' on' : '') + '" data-photo="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + esc(p) + '" alt="" loading="lazy" decoding="async"></button>'; }).join('') + '</div>' : '<div class="gallery-thumbs" id="galleryThumbs"></div>';
  const profileUrl = l.seller_id ? ('profile?id=' + esc(l.seller_id)) : null;
  const phone = l.seller_phone ? String(l.seller_phone).replace(/[^\d+]/g, '') : '';
  const waHref = phone ? ('https://wa.me/' + phone.replace('+', '') + '?text=' + encodeURIComponent('Hi, I saw your listing "' + l.title + '" on PaMarket. Is it still available?')) : '';
  const waBtn = waHref ? '<a class="btn btn-whatsapp contact-btn" href="' + esc(waHref) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' : '';
  const callBtn = phone ? '<a class="btn btn-navy contact-btn contact-primary" href="tel:' + esc(phone) + '">Call seller</a>' : '';
  const profileBtn = profileUrl ? '<a class="btn btn-navy contact-btn" href="' + profileUrl + '">View Full Profile</a>' : '';
  const shareBtn = '<button type="button" class="btn contact-btn" id="shareBtn" style="background:#fff;border:1.5px solid var(--line);color:var(--ink)">' +
    '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Listing</button>';
  const initials = esc((l.seller_name || 'Seller').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase());
  const reviews = l._reviews || [];
  const avg = avgRating(reviews);
  const ratingLine = reviews.length
    ? '<div class="seller-rating"><span class="stars">' + stars(avg) + '</span><span>' + avg.toFixed(1) + ' · ' + reviews.length + ' review' + (reviews.length > 1 ? 's' : '') + '</span></div>'
    : '';
  const revSection = reviews.length
    ? '<div class="d-section"><h3>Seller Reviews</h3>' + reviewsHtml(reviews, 'this seller') + '</div>'
    : '';
  const featured = !!(l.featured_until && new Date(l.featured_until) > new Date());
  const attrs = l.attributes && typeof l.attributes === 'object' ? l.attributes : {};
  const condition = attrs.condition || l.condition || 'Not specified';
  const special = l.category === 'vehicles' && (attrs.mileage || l.mileage) ? { value: String(attrs.mileage || l.mileage), label: 'Mileage' } : null;
  const statRows = [special || { value: condition, label: 'Condition' }, { value: catLabel, label: 'Category' }, { value: Number(l.views || 0).toLocaleString(), label: 'Views' }];
  const stats = '<div class="d-stats">' + statRows.map(function (s) { return '<div class="d-stat"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>'; }).join('') + '</div>';
  const crumb = '<div class="crumb"><a href="/">Home</a> / <a href="browse">Browse</a> / <a href="browse?cat=' + esc(l.category) + '">' + esc(catLabel) + '</a> / <span>' + title + '</span></div>';
  const mainPremium = '<div id="detailContent"><div class="detail-wrap"><div class="detail-main">' +
    '<div class="gallery"><div class="gallery-main" id="galleryMain" role="button" tabindex="0" aria-label="Open full-screen photo viewer">' + mainImg + '</div>' + thumbs + '</div>' +
    '<section class="listing-summary"><div class="d-chips">' + (featured ? '<span class="d-chip featured">&#9733; Featured</span>' : '') + '<span class="d-chip">' + esc(catLabel) + '</span></div>' +
    '<div class="d-heading-row"><h1 class="d-title">' + title + '</h1><div class="d-price">' + esc(priceStr) + '</div></div>' +
    '<div class="d-meta"><span>' + esc(loc) + '</span><span>Posted ' + esc(timeAgo(l.created_at)) + '</span>' + (l.views ? '<span>' + Number(l.views).toLocaleString() + ' views</span>' : '') + '</div>' + stats + '</section>' +
    '<div class="d-section"><h3>About this listing</h3><div class="d-desc">' + esc(l.description || 'No description provided.') + '</div></div>' + revSection +
    '</div><div class="sidebar"><div class="seller-card">' +
    '<div class="seller-top"><div class="seller-avatar">' + initials + '</div><div><div class="seller-name">' + esc(l.seller_name || 'PaMarket Seller') + '</div><div class="seller-sub">View profile &rarr;</div></div></div>' + ratingLine +
    '<div class="seller-trust"><strong>Safe contact</strong><span>Check the seller profile and inspect before paying.</span></div>' +
    '<div class="contact-actions">' + callBtn + waBtn + profileBtn + '</div><div class="seller-secondary-actions">' + shareBtn + '</div></div>' +
    '<div class="safety-card"><h4>Stay Safe</h4><ul><li>Meet in a public place during daylight hours</li><li>Never pay before seeing the item in person</li><li>PaMarket does not handle payments or delivery</li></ul></div>' +
    '</div></div><div class="similar-sec hidden" id="recentSec" style="padding-top:28px"><h2>Recently <span style="color:var(--navy)">Viewed</span></h2><div class="similar-grid" id="recentGrid"></div></div></div>' +
    '<div class="photo-viewer" id="photoViewer" role="dialog" aria-modal="true" aria-label="Full-screen listing photo viewer"><button type="button" class="pv-btn pv-close" id="photoViewerClose" aria-label="Close photo viewer">&times;</button><button type="button" class="pv-btn pv-prev" id="photoViewerPrev" aria-label="Previous photo">&#8249;</button><img class="photo-viewer-img" id="photoViewerImg" alt="Expanded listing photo"><button type="button" class="pv-btn pv-next" id="photoViewerNext" aria-label="Next photo">&#8250;</button><div class="pv-count" id="photoViewerCount"></div></div>' +
    '<div id="unavailableState" class="state-msg" style="display:none">This listing is no longer available or is being reviewed.<br><br><a href="browse">Browse other listings</a></div>';
  const photoScript = '(function(){var photos=' + jsonld(photos) + ',title=' + jsonld(l.title) + ',i=0,main=document.getElementById("galleryMain"),viewer=document.getElementById("photoViewer"),img=document.getElementById("photoViewerImg"),count=document.getElementById("photoViewerCount"),touch=0;function show(n){if(!photos.length)return;i=(n+photos.length)%photos.length;main.querySelector("img").src=photos[i];var c=main.querySelector(".gallery-count");if(c)c.textContent=(i+1)+" / "+photos.length;document.querySelectorAll(".gallery-thumb").forEach(function(t,x){t.classList.toggle("on",x===i);});img.src=String(photos[i]);img.alt=title+" - photo "+(i+1);count.textContent=(i+1)+" of "+photos.length;}function open(){if(!photos.length)return;viewer.classList.add("open");show(i);document.body.style.overflow="hidden";document.getElementById("photoViewerClose").focus();}function close(){viewer.classList.remove("open");document.body.style.overflow="";main.focus();}document.querySelectorAll(".gallery-thumb").forEach(function(t){t.onclick=function(){show(Number(t.dataset.photo));};});main.onclick=open;main.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}};document.getElementById("photoViewerClose").onclick=close;document.getElementById("photoViewerPrev").onclick=function(){show(i-1);};document.getElementById("photoViewerNext").onclick=function(){show(i+1);};viewer.onclick=function(e){if(e.target===viewer)close();};viewer.addEventListener("touchstart",function(e){touch=e.changedTouches[0].clientX;},{passive:true});viewer.addEventListener("touchend",function(e){var d=e.changedTouches[0].clientX-touch;if(Math.abs(d)>45)show(i+(d<0?1:-1));},{passive:true});document.addEventListener("keydown",function(e){if(!viewer.classList.contains("open"))return;if(e.key==="Escape")close();if(e.key==="ArrowLeft")show(i-1);if(e.key==="ArrowRight")show(i+1);});})();';
  return shell({
    url: url, pageTitle: l.title + ' — ' + priceStr + ' | PaMarket Zimbabwe',
    desc: l.description ? String(l.description).slice(0, 155) : (l.title + ' — ' + catLabel + ' in ' + loc + ' on PaMarket, Zimbabwe.'),
    ogImg: photos[0] || (SITE + '/img/icon-512.png'), ogType: isJob ? 'website' : 'product',
    schema: [PMSchema.buildListingSchema(l, url, reviews), PMSchema.buildBreadcrumb(l, url)],
    crumb: crumb, main: mainPremium, hydrateListingId: l.id, chrome: chrome,
    extrasMeta: { id: l.id, title: l.title, price: l.price, currency: l.currency, photo: photos[0] || null, city: l.city, province: l.province, url: url },
    afterScripts: photoScript
  });
}

function renderRental(v, chrome) {
  // See renderListing's comment: this static page is the canonical (real
  // content, matches sitemap.xml); rental-detail.html's own canonical now
  // points here too, so the two pages still agree.
  const url = PMSchema.rentalUrl(v);
  const title = PMSchema.rentalTitle(v);
  const media = (v.rental_vehicle_media || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
  const loc = [v.pickup_suburb, v.rental_locations && v.rental_locations.city].filter(Boolean).join(', ') || 'Zimbabwe';
  const catLabel = (v.rental_categories && v.rental_categories.label) || '';
  const company = v.rental_companies || {};
  const priceStr = v.daily_rate ? ('$' + Number(v.daily_rate).toLocaleString() + '/day') : 'Price on application';
  const rates = [];
  if (v.weekly_rate) rates.push('<span><b>$' + Number(v.weekly_rate).toLocaleString() + '</b> /week</span>');
  if (v.monthly_rate) rates.push('<span><b>$' + Number(v.monthly_rate).toLocaleString() + '</b> /month</span>');
  if (v.deposit) rates.push('<span><b>$' + Number(v.deposit).toLocaleString() + '</b> deposit</span>');
  const features = (v.rental_vehicle_features || []).map(function (f) { return f.feature; }).filter(Boolean);
  const featHtml = features.length ? '<div class="d-section"><h3>Features</h3><div class="feat-chips">' + features.map(function (f) { return '<span class="feat-chip">' + esc(f) + '</span>'; }).join('') + '</div></div>' : '';
  const mainImg = media.length ? '<img src="' + esc(media[0].url) + '" alt="' + esc(title) + '">' : '<div class="gallery-main-ph">' + esc(title) + '</div>';
  const thumbs = media.length > 1 ? '<div class="gallery-thumbs">' + media.map(function (m, i) { return '<div class="gallery-thumb' + (i === 0 ? ' on' : '') + '"><img src="' + esc(m.url) + '" alt="" loading="lazy"></div>'; }).join('') + '</div>' : '';
  const phone = company.rental_whatsapp || company.rental_phone;
  const waHref = phone ? ('https://wa.me/' + String(phone).replace(/[^\d+]/g, '').replace('+', '') + '?text=' + encodeURIComponent('Hi, I saw your ' + title + ' rental on PaMarket. Is it available?')) : '';
  const waBtn = waHref ? '<a class="btn btn-whatsapp contact-btn" href="' + esc(waHref) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' : '';
  const emailBtn = company.rental_email ? '<a class="btn btn-outline contact-btn" href="mailto:' + esc(company.rental_email) + '">Email the Company</a>' : '';
  const profileBtn = company.business_id ? '<a class="btn btn-navy contact-btn" href="business?id=' + esc(company.business_id) + '">View Business Profile</a>' : '';
  // Parity with rental-detail.html's live JS render — same chats?biz= entry
  // point business.html/b/*.html already use (rental companies ARE
  // businesses via rental_companies.business_id).
  const messageBtn = company.business_id
    ? '<a class="btn btn-navy contact-btn" href="chats?biz=' + esc(company.business_id) + '"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="vertical-align:-3px;margin-right:6px"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>Message via PaMarket</a>'
    : '';
  const companyName = company.trading_name || 'Rental Company';
  const companyInitials = esc(companyName.split(' ').map(function (w) { return w[0]; }).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'RC');
  const companyRating = (company.review_count > 0 && company.avg_rating)
    ? '<div class="seller-rating"><span class="stars">' + stars(company.avg_rating) + '</span><span>' + Number(company.avg_rating).toFixed(1) + ' · ' + company.review_count + ' review' + (company.review_count > 1 ? 's' : '') + '</span></div>'
    : '';
  const infoChips = [];
  if (company.year_established) infoChips.push('Est. ' + company.year_established);
  if (company.driver_available) infoChips.push('Driver available');
  if (company.cross_border) infoChips.push('Cross-border allowed');
  if (company.insurance_included) infoChips.push('Insurance included');
  if (company.deposit_policy) infoChips.push(company.deposit_policy);
  const infoChipsHtml = infoChips.length ? '<div class="feat-chips" style="margin:10px 0">' + infoChips.map(function (c) { return '<span class="feat-chip">' + esc(c) + '</span>'; }).join('') + '</div>' : '';
  const crumb = '<div class="crumb"><a href="/">Home</a> / <a href="rentals">Vehicle Rental</a> / <span>' + esc(title) + '</span></div>';
  const main = '<div id="detailContent"><div class="detail-wrap"><div>' +
    '<div class="gallery"><div class="gallery-main" id="galleryMain">' + mainImg + '</div>' + thumbs + '</div>' +
    '<h1 class="d-title">' + esc(title) + '</h1>' +
    '<div class="d-avail"><span class="d-avail ' + (v.is_available ? 'yes' : 'no') + '">' + (v.is_available ? 'Available Now' : 'Currently Booked') + '</span></div>' +
    '<div class="d-price">' + esc(priceStr) + '</div>' +
    (rates.length ? '<div class="d-rates">' + rates.join('') + '</div>' : '') +
    '<div class="d-meta"><span>' + esc(loc) + '</span>' + (catLabel ? '<span style="background:#EEF2FF;color:var(--navy);padding:3px 10px;border-radius:20px;font-weight:700">' + esc(catLabel) + '</span>' : '') + (v.min_rental_days ? '<span>Min ' + v.min_rental_days + ' day' + (v.min_rental_days === 1 ? '' : 's') + '</span>' : '') + '</div>' +
    '<div class="d-section"><h3>Description</h3><div class="d-desc">' + esc(v.description || 'No description provided.') + '</div></div>' + featHtml +
    '</div><div class="sidebar"><div class="seller-card">' +
    '<div class="seller-top"><div class="seller-avatar">' + companyInitials + '</div><div><div class="seller-name">' + esc(companyName) + '</div><div class="seller-sub">Verified rental partner on PaMarket</div></div></div>' +
    companyRating + infoChipsHtml + messageBtn + waBtn + emailBtn + profileBtn + '</div>' +
    '<div class="safety-card"><h4>Stay Safe</h4><ul><li>Confirm the vehicle and terms before paying</li><li>Keep all conversations and payments inside PaMarket</li></ul></div>' +
    '</div></div></div>';
  return shell({
    url: url, pageTitle: title + ' Rental — PaMarket Zimbabwe',
    desc: 'Rent a ' + title + ' in Zimbabwe' + (v.daily_rate ? ' from $' + Number(v.daily_rate).toLocaleString() + '/day' : '') + '. Book directly with a verified rental company on PaMarket.',
    ogImg: (media[0] && media[0].url) || (SITE + '/img/icon-512.png'), ogType: 'product',
    schema: [PMSchema.buildRentalSchema(v, url), PMSchema.buildRentalBreadcrumb(v, url)],
    crumb: crumb, main: main, chrome: chrome
  });
}

// Mirrors the live business.html render() so the static /b/ page and the
// client-rendered /business?id= page look identical. Uses business.html's
// own <style> block (chrome.bizStyle) — the .biz-*/.rev-*/.rating-* classes
// don't exist in detail.html's styles.
const BIZ_TYPE_LABEL = { individual: 'Individual Seller', company: 'Registered Company', agency: 'Agency' };
const CAT_LABEL = { property: 'Property', vehicles: 'Vehicles', electronics: 'Electronics', furniture: 'Furniture', fashion: 'Fashion', services: 'Services', agriculture: 'Agriculture', rooms: 'Rooms', pets: 'Pets', kids: 'Baby & Kids', jobs: 'Jobs', other: 'Other' };

function bizProdCard(l) {
  const photo = l.photos && l.photos.length ? l.photos[0] : null;
  const loc = [l.suburb, l.city].filter(Boolean).join(', ') || l.province || 'Zimbabwe';
  const media = photo
    ? '<img class="pm-card-img-el" src="' + esc(photo) + '" alt="' + esc(l.title) + '" loading="lazy">'
    : '<div class="pm-card-ph" style="color:var(--navy)">' + esc(String(l.title || '').split(' ').slice(0, 3).join(' ')) + '</div>';
  return '<a class="pm-card" href="' + PMSchema.listingPath(l) + '">' +
    '<div class="pm-card-img" style="background:var(--paper)">' + media + '</div>' +
    '<div class="pm-card-body">' +
    '<div class="pm-card-price">' + esc(money(l.price, l.currency)) + '</div>' +
    '<div class="pm-card-title">' + esc(l.title) + '</div>' +
    '<div class="pm-card-loc">📍 ' + esc(loc) + '</div>' +
    '</div></a>';
}

function renderBusiness(b, chrome) {
  // See renderListing's comment: this static page is the canonical (real
  // content, matches sitemap.xml); business.html's own canonical now
  // points here too, so the two pages still agree.
  const url = PMSchema.businessUrl(b);
  const products = b._products || [];
  const reviews = b._reviews || [];
  const verified = (b.verification_level || 0) > 0;
  const loc = [b.suburb, b.city, b.province].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') || 'Zimbabwe';
  const avg = avgRating(reviews);
  const year = b.created_at ? new Date(b.created_at).getFullYear() : '';
  const cats = (b.category || '').split('|').filter(Boolean);
  const cover = b.cover ? '<img src="' + esc(b.cover) + '" alt="' + esc(b.name) + ' cover">' : '';
  const logo = b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name) + ' logo">' : initialsOf(b.name);

  // This static page has no client-side identity check (it's baked at build
  // time for crawlers/anonymous visitors), so "Message Business" is always
  // shown — mirrors business.html's non-owner branch. If the owner
  // themselves lands here and clicks it, js/chats.js's resolveBizEntry
  // already guards against messaging your own business with a clear toast.
  let actions = '<a class="btn btn-navy" href="chats?biz=' + esc(b.id) + '"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="vertical-align:-3px;margin-right:6px"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>Message Business</a>';
  const wa = b.whatsapp || b.phone;
  if (wa) actions += '<a class="btn btn-whatsapp" href="https://wa.me/' + esc(String(wa).replace(/[^0-9]/g, '')) + '" target="_blank" rel="noopener">WhatsApp</a>';
  if (b.phone) actions += '<a class="btn btn-navy" href="tel:' + esc(b.phone) + '">Call</a>';
  if (b.email) actions += '<a class="btn btn-outline" href="mailto:' + esc(b.email) + '">Email</a>';

  let statHtml = '';
  if (reviews.length) statHtml += '<div class="biz-stat"><div class="n">' + avg.toFixed(1) + ' ★</div><div class="l">' + reviews.length + ' review' + (reviews.length > 1 ? 's' : '') + '</div></div>';
  statHtml += '<div class="biz-stat"><div class="n">' + products.length + '</div><div class="l">Listings</div></div>';
  if (year) statHtml += '<div class="biz-stat"><div class="n">' + year + '</div><div class="l">On PaMarket since</div></div>';

  const crumb = '<div class="crumb"><a href="/">Home</a> / <a href="browse?shops=1">Shops</a> / <span>' + esc(b.name) + '</span></div>';
  const main =
    '<div class="biz-cover">' + cover + '</div>' +
    '<div class="biz-head">' +
      '<div class="biz-id">' +
        '<div class="biz-logo">' + logo + '</div>' +
        '<div class="biz-id-name">' +
          '<div class="biz-name-row"><h1 class="biz-name">' + esc(b.name) + '</h1>' +
            (verified ? '<span class="biz-verified">✓ Verified</span>' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="biz-meta">' +
        '<span>🏷️ ' + esc(BIZ_TYPE_LABEL[b.biz_type] || 'Seller') + '</span>' +
        '<span>📍 ' + esc(loc) + '</span>' +
      '</div>' +
      '<div class="biz-stats">' + statHtml + '</div>' +
      '<div class="biz-actions">' + (actions || '<span class="sub" style="color:var(--mute);font-size:13px">No contact details provided</span>') + '</div>' +
    '</div>' +
    '<div class="biz-body">' +
      (b.description ? '<div class="biz-section biz-about"><h2>About</h2><p>' + esc(b.description) + '</p>' +
        (cats.length ? '<div class="cat-chips">' + cats.map(function (c) { return '<span class="pm-chip">' + esc(CAT_LABEL[c] || c) + '</span>'; }).join('') + '</div>' : '') + '</div>' : '') +
      '<div class="biz-section"><h2>Listings</h2><div class="sub">Products &amp; services from ' + esc(b.name) + '</div>' +
        (products.length
          ? '<div class="prod-grid">' + products.slice(0, 12).map(bizProdCard).join('') + '</div>'
          : '<div class="empty-state">No live listings yet. Check back soon.</div>') +
      '</div>' +
      '<div class="biz-section"><h2>Reviews &amp; Ratings</h2>' +
        (reviews.length ? reviewsHtml(reviews) : '<div class="empty-state">This shop has no reviews yet.</div>') +
      '</div>' +
    '</div>';
  const desc = b.description ? String(b.description).slice(0, 155) : (b.name + ' — a verified business storefront on PaMarket, Zimbabwe.');
  return shell({
    url: url, pageTitle: b.name + ' — Verified Shop on PaMarket Zimbabwe', desc: desc,
    ogImg: b.cover || b.logo || (SITE + '/img/icon-512.png'), ogType: 'website',
    schema: PMSchema.buildBusinessSchema(b, url, reviews, products),
    crumb: crumb, main: main, chrome: chrome, style: chrome.bizStyle
  });
}

function writeAll(dir, rows, renderFn, chrome, pathFn) {
  const outDir = path.join(OUT, dir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const row of rows) {
    if (!row || !row.id) continue;
    try {
      fs.writeFileSync(path.join(outDir, path.basename(pathFn(row))), renderFn(row, chrome), 'utf8');
      n++;
    } catch (e) { console.warn('prerender: skip ' + dir + '/' + row.id + ' — ' + e.message); }
  }
  console.log('prerender: wrote ' + n + ' page(s) to ' + dir + '/');
  return n;
}

async function main() {
  let listings, rentals, businesses, reviewsBySeller = {}, chrome = loadChrome();
  if (process.env.PRERENDER_FIXTURE) {
    const fx = JSON.parse(fs.readFileSync(process.env.PRERENDER_FIXTURE, 'utf8'));
    listings = fx.listings || []; rentals = fx.rentals || []; businesses = fx.businesses || [];
    reviewsBySeller = fx.reviewsBySeller || {};
  } else {
    const cfg = loadSupabaseConfig();
    listings = await fetchActiveListings(cfg);
    rentals = await fetchActiveRentals(cfg);
    businesses = await fetchActiveBusinesses(cfg);
    reviewsBySeller = await fetchReviewsBySeller(cfg);
  }
  for (const l of listings) l._reviews = (l.seller_id && reviewsBySeller[l.seller_id]) || [];
  writeAll('l', listings, renderListing, chrome, function (l) { return PMSchema.listingFilePath(l); });
  writeAll('r', rentals, renderRental, chrome, function (v) { return PMSchema.rentalFilePath(v); });
  writeAll('b', businesses, renderBusiness, chrome, function (b) { return PMSchema.businessFilePath(b); });
}

main().catch(function (e) { console.error('prerender failed:', e); process.exit(1); });
