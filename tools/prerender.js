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
const PMListingAttrs = require('../js/listing-attrs.js');

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
  // Explicit columns: registration is not readable with the anon key, so
  // select=* on rental_vehicle_listings is refused (rental Phase 0 migration).
  const select = 'id,model,year,daily_rate,weekly_rate,monthly_rate,deposit,min_rental_days,pickup_suburb,description,is_available,created_at,updated_at,' +
    'rental_brands(label),rental_categories(label),rental_locations(city,province),' +
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

// --- page rendering ----------------------------------------------------------
// These pages use the site's Tailwind design system (the same one detail.html,
// business.html and rentals.html use), so they must load Tailwind + the
// config + fonts themselves.
const CARD = 'bg-surface-container-lowest rounded p-5 shadow-sm';
const H2 = 'font-headline-sm text-headline-sm text-on-surface font-bold mb-3 flex items-center gap-2';
const LABEL = 'text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant';
const BTN_PRIMARY = 'bg-primary text-on-primary py-3 px-4 rounded text-label-md font-label-md font-bold flex items-center justify-center gap-2';
const BTN_SECONDARY = 'bg-surface-container-low text-on-surface py-3 px-4 rounded text-label-md font-label-md font-bold flex items-center justify-center gap-2';

function icon(name, size) { return '<span class="material-symbols-outlined text-[' + (size || 18) + 'px]">' + name + '</span>'; }
function h2(iconName, text) { return '<h2 class="' + H2 + '"><span class="material-symbols-outlined text-primary text-[22px]">' + iconName + '</span>' + text + '</h2>'; }
function cap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Rating summary + review cards, shared by listing and business pages.
function reviewsHtml(reviews, subjectLabel) {
  if (!reviews || !reviews.length) return '';
  const avg = avgRating(reviews);
  const hero = '<div class="flex items-center gap-4 mb-4"><div class="font-headline-lg text-headline-lg font-extrabold text-on-surface">' + avg.toFixed(1) + '</div><div>' +
    '<div class="text-[#f59e0b] text-body-lg tracking-wider">' + stars(avg) + '</div>' +
    '<div class="text-body-sm text-on-surface-variant">Based on ' + reviews.length + ' review' + (reviews.length > 1 ? 's' : '') + (subjectLabel ? ' of ' + esc(subjectLabel) : '') + '</div></div></div>';
  const list = '<div class="flex flex-col gap-3">' + reviews.slice(0, 10).map(function (r) {
    return '<div class="bg-surface-container-low rounded p-4"><div class="flex items-center gap-3">' +
      '<div class="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-body-sm">' + initialsOf(r.reviewer_name) + '</div>' +
      '<div class="flex-1 min-w-0"><div class="font-bold text-on-surface text-body-sm">' + esc(r.reviewer_name || 'PaMarket user') + '</div><div class="text-label-sm text-on-surface-variant">' + esc(timeAgo(r.created_at)) + '</div></div>' +
      '<div class="text-[#f59e0b] text-body-sm">' + stars(r.rating) + '</div></div>' +
      (r.body ? '<p class="mt-2 text-body-sm text-on-surface whitespace-pre-line">' + esc(r.body) + '</p>' : '') + '</div>';
  }).join('') + '</div>';
  return hero + list;
}

function loadChrome() {
  return {
    header: fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8'),
    footer: fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8')
  };
}

function crumbHtml(items) {
  return '<nav aria-label="Breadcrumb" class="max-w-7xl mx-auto px-margin md:px-margin-desktop py-space-sm text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1.5 flex-wrap">' +
    items.map(function (it, i) {
      const sep = i ? '<span class="material-symbols-outlined text-[14px]">chevron_right</span>' : '';
      return sep + (it.href ? '<a href="' + it.href + '" class="hover:text-primary">' + esc(it.label) + '</a>' : '<span class="text-on-surface font-medium truncate max-w-[260px]">' + esc(it.label) + '</span>');
    }).join('') + '</nav>';
}

// Photo gallery with thumbnails and a full-screen viewer. Returns
// { html, viewer, script } so each page type can place them.
function gallery(photos, title) {
  const main = photos.length
    ? '<img id="mainPhoto" src="' + esc(photos[0]) + '" alt="' + esc(title) + '" fetchpriority="high" decoding="async" class="w-full h-[300px] md:h-[440px] object-cover">' +
      '<span id="photoCounter" class="absolute bottom-3 right-3 bg-inverse-surface/80 text-inverse-on-surface text-[12px] font-semibold px-2.5 py-1 rounded">Photo 1 of ' + photos.length + '</span>'
    : '<div class="w-full h-[240px] flex flex-col items-center justify-center gap-2 text-on-surface-variant">' + icon('image', 44) + '<span class="text-body-sm">No photos yet</span></div>';
  const thumbs = photos.length > 1
    ? '<div class="flex gap-2 p-3 overflow-x-auto">' + photos.map(function (p, i) {
        return '<button type="button" class="gallery-thumb shrink-0 rounded overflow-hidden border-2 ' + (i === 0 ? 'border-primary' : 'border-transparent') + '" data-photo="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + esc(p) + '" alt="' + esc(title) + ' photo ' + (i + 1) + '" loading="lazy" decoding="async" class="w-20 h-16 object-cover"></button>';
      }).join('') + '</div>'
    : '';
  const html = '<div class="bg-surface-container-lowest rounded overflow-hidden shadow-sm">' +
    '<div id="galleryMain" role="button" tabindex="0" aria-label="Open full-screen photo viewer" class="relative bg-surface-container ' + (photos.length ? 'cursor-zoom-in' : '') + '">' + main + '</div>' + thumbs + '</div>';
  const pv = 'w-11 h-11 rounded-full bg-white/15 text-white text-[26px] flex items-center justify-center';
  const viewer = photos.length ? '<div id="photoViewer" role="dialog" aria-modal="true" aria-label="Full-screen photo viewer" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/90 p-4">' +
    '<button type="button" id="photoViewerClose" aria-label="Close photo viewer" class="absolute top-4 right-4 ' + pv + '">&times;</button>' +
    '<button type="button" id="photoViewerPrev" aria-label="Previous photo" class="absolute left-3 top-1/2 -translate-y-1/2 ' + pv + '">&#8249;</button>' +
    '<img id="photoViewerImg" alt="" class="max-w-full max-h-[85vh] object-contain">' +
    '<button type="button" id="photoViewerNext" aria-label="Next photo" class="absolute right-3 top-1/2 -translate-y-1/2 ' + pv + '">&#8250;</button>' +
    '<div id="photoViewerCount" class="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-body-sm"></div></div>' : '';
  const script = photos.length ? '(function(){var photos=' + jsonld(photos) + ',title=' + jsonld(title) + ',i=0,main=document.getElementById("galleryMain"),mainImg=document.getElementById("mainPhoto"),counter=document.getElementById("photoCounter"),viewer=document.getElementById("photoViewer"),img=document.getElementById("photoViewerImg"),count=document.getElementById("photoViewerCount"),touch=0;' +
    'function show(n){i=(n+photos.length)%photos.length;mainImg.src=photos[i];counter.textContent="Photo "+(i+1)+" of "+photos.length;document.querySelectorAll(".gallery-thumb").forEach(function(t,x){t.classList.toggle("border-primary",x===i);t.classList.toggle("border-transparent",x!==i);});img.src=photos[i];img.alt=title+" - photo "+(i+1);count.textContent=(i+1)+" of "+photos.length;}' +
    'function open(){viewer.classList.remove("hidden");viewer.classList.add("flex");show(i);document.body.style.overflow="hidden";}' +
    'function close(){viewer.classList.add("hidden");viewer.classList.remove("flex");document.body.style.overflow="";main.focus();}' +
    'document.querySelectorAll(".gallery-thumb").forEach(function(t){t.onclick=function(){show(Number(t.dataset.photo));};});' +
    'main.onclick=open;main.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}};' +
    'document.getElementById("photoViewerClose").onclick=close;document.getElementById("photoViewerPrev").onclick=function(){show(i-1);};document.getElementById("photoViewerNext").onclick=function(){show(i+1);};' +
    'viewer.onclick=function(e){if(e.target===viewer)close();};' +
    'viewer.addEventListener("touchstart",function(e){touch=e.changedTouches[0].clientX;},{passive:true});viewer.addEventListener("touchend",function(e){var d=e.changedTouches[0].clientX-touch;if(Math.abs(d)>45)show(i+(d<0?1:-1));},{passive:true});' +
    'document.addEventListener("keydown",function(e){if(viewer.classList.contains("hidden"))return;if(e.key==="Escape")close();if(e.key==="ArrowLeft")show(i-1);if(e.key==="ArrowRight")show(i+1);});})();' : '';
  return { html: html, viewer: viewer, script: script };
}

function specsHtml(category, attributes, condition) {
  const d = PMListingAttrs.describe(category, attributes, condition);
  const specs = d.subcategory ? [{ label: 'Category', value: d.subcategory }].concat(d.specs) : d.specs;
  let out = '';
  if (specs.length) {
    out += '<section class="' + CARD + '">' + h2('list_alt', 'Specifications') + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">' +
      specs.map(function (s) { return '<div class="bg-surface-container-low rounded p-3"><span class="text-label-sm font-label-sm text-on-surface-variant block">' + esc(s.label) + '</span><span class="text-body-lg text-on-surface font-bold">' + esc(s.value) + '</span></div>'; }).join('') +
      '</div></section>';
  }
  if (d.features) {
    out += '<section class="' + CARD + '">' + h2('check_circle', esc(d.features.label)) + '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-body-sm">' +
      d.features.items.map(function (f) { return '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px] text-primary">check</span>' + esc(f) + '</div>'; }).join('') +
      '</div></section>';
  }
  return out;
}

const SAFETY_BAND = '<section class="bg-primary rounded p-5 md:p-6 text-on-primary"><h2 class="font-headline-sm text-headline-sm font-bold mb-4">Trade Safely on PaMarket</h2><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
  ['Meet in Public Spaces', 'Zero Upfront Deposits', 'Inspect Before Paying', 'Report Suspicious Sellers'].map(function (t, i) {
    return '<div class="bg-primary-container/40 rounded p-3"><span class="text-label-sm font-bold text-primary-fixed block mb-1">0' + (i + 1) + '</span><span class="text-body-sm font-semibold block">' + t + '</span></div>';
  }).join('') + '</div><a href="safety.html" class="inline-block mt-4 text-label-md font-bold underline">Full Safety Guidelines &rarr;</a></section>';

function avatar(text, img) {
  return '<div class="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-body-lg overflow-hidden shrink-0">' + (img || text) + '</div>';
}

// Shared page shell. o: { url, pageTitle, desc, ogImg, ogType, schema[], crumb,
// main, hydrateListingId?, chrome, extrasMeta?, afterScripts? }
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
    '<meta charset="UTF-8">\n<base href="' + SITE + '/">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(o.pageTitle) + '</title>\n' +
    '<meta name="description" content="' + esc(o.desc) + '">\n' +
    '<link rel="canonical" href="' + o.url + '">\n' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">\n' +
    '<meta property="og:type" content="' + (o.ogType || 'website') + '">\n' +
    '<meta property="og:site_name" content="PaMarket">\n' +
    '<meta property="og:title" content="' + esc(o.pageTitle) + '">\n' +
    '<meta property="og:description" content="' + esc(o.desc) + '">\n' +
    '<meta property="og:image" content="' + esc(o.ogImg) + '">\n' +
    '<meta property="og:url" content="' + o.url + '">\n<meta property="og:locale" content="en_ZW">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + esc(o.pageTitle) + '">\n' +
    '<meta name="twitter:description" content="' + esc(o.desc) + '">\n' +
    '<meta name="twitter:image" content="' + esc(o.ogImg) + '">\n' +
    '<meta name="geo.region" content="ZW">\n<meta name="geo.placename" content="Zimbabwe">\n' +
    '<link rel="icon" href="img/icon-192.png" type="image/png">\n<link rel="apple-touch-icon" href="img/icon-192.png">\n' +
    blocks + '\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@100..900&family=Manrope:wght@100..900&display=swap" rel="stylesheet"/>\n' +
    '<style>html,body{margin:0;padding:0;}body{overscroll-behavior:none;}::-webkit-scrollbar{display:none;}</style>\n' +
    '<script src="https://cdn.tailwindcss.com"></script>\n<script src="js/tailwind-config.js"></script>\n' +
    '</head>\n<body class="bg-surface-container font-body-md text-on-surface antialiased min-h-screen">\n' +
    o.chrome.header + '\n<main class="w-full pt-[148px] bg-surface-container min-h-screen pb-space-2xl">\n' + o.crumb + '\n' + o.main + '\n</main>\n' + o.chrome.footer + '\n' +
    (o.viewer || '') + hyd +
    '<script src="js/supabase-config.js"></script>\n<script src="js/listing-schema.js"></script>\n<script src="js/session.js"></script>\n<script src="js/marketplace-data.js"></script>\n' +
    (o.extrasMeta ? '<script src="js/listing-extras.js"></script>\n<script>window.PMListingExtras&&PMListingExtras.init(' + jsonld(o.extrasMeta) + ');</script>\n' : '') +
    (o.afterScripts ? '<script>' + o.afterScripts + '</script>\n' : '') +
    '</body>\n</html>\n';
}

function renderListing(l, chrome) {
  // This static page IS the canonical: it has the real content, while
  // detail.html is a client-rendered shell. PMSchema.listingUrl(l) is the
  // extensionless public URL that sitemap.xml and detail.html also use.
  const url = PMSchema.listingUrl(l);
  const catLabel = PMSchema.catLabelOf(l);
  const loc = PMSchema.locOf(l);
  const photos = (l.photos && l.photos.length) ? l.photos : [];
  const isJob = l.category === 'jobs';
  const priceStr = isJob ? (l.price ? money(l.price, l.currency) + '/mo' : 'Salary negotiable') : (l.price ? money(l.price, l.currency) : 'Contact for price');
  const attrs = l.attributes && typeof l.attributes === 'object' ? l.attributes : {};
  const condition = l.condition || attrs.condition || '';
  const phone = l.seller_phone ? String(l.seller_phone).replace(/[^\d+]/g, '') : '';
  const waHref = 'https://wa.me/' + (phone ? phone.replace('+', '') : '') + '?text=' + encodeURIComponent('Hi, I saw your listing "' + l.title + '" on PaMarket. Is it still available?');
  const reviews = l._reviews || [];
  const avg = avgRating(reviews);
  const featured = !!(l.featured_until && new Date(l.featured_until) > new Date());
  const g = gallery(photos, l.title);
  const badge = 'text-label-sm font-label-sm text-on-surface-variant flex items-center gap-1';
  const badges = (featured ? '<span class="bg-secondary-fixed text-on-secondary-fixed text-label-sm font-bold px-2.5 py-1 rounded">&#9733; Featured</span>' : '') +
    '<a href="browse?cat=' + esc(l.category) + '" class="bg-surface-container text-on-surface-variant text-label-sm font-label-sm px-2.5 py-1 rounded hover:text-primary">' + esc(catLabel) + '</a>' +
    '<span class="' + badge + '">' + icon('schedule', 14) + 'Listed ' + esc(timeAgo(l.created_at)) + '</span>' +
    '<span class="' + badge + '">' + icon('location_on', 14) + esc(loc) + '</span>' +
    (l.views ? '<span class="' + badge + '">' + icon('visibility', 14) + Number(l.views).toLocaleString() + ' views</span>' : '');
  const sub = [l.province, condition ? cap(condition) + ' condition' : null].filter(Boolean).join(' &bull; ');
  const sellerName = l.seller_name || 'PaMarket Seller';
  const sellerCard = '<section class="' + CARD + '"><div class="flex items-center gap-3">' + avatar(initialsOf(sellerName)) +
    '<div class="min-w-0"><div class="font-bold text-on-surface text-body-lg truncate">' + esc(sellerName) + '</div>' +
    (reviews.length ? '<div class="text-body-sm text-on-surface-variant"><span class="text-[#f59e0b]">' + stars(avg) + '</span> ' + avg.toFixed(1) + ' &middot; ' + reviews.length + ' review' + (reviews.length > 1 ? 's' : '') + '</div>' : '<div class="text-body-sm text-on-surface-variant">Seller on PaMarket</div>') +
    '</div></div>' +
    (l.seller_id ? '<a href="profile?id=' + esc(l.seller_id) + '" class="mt-4 ' + BTN_SECONDARY + '">View seller profile</a>' : '') +
    '<p class="mt-3 text-body-sm text-on-surface-variant">Always meet in a public place and inspect the item before paying. PaMarket never asks for deposits.</p></section>';
  const contactCard = '<section class="' + CARD + '"><span class="' + LABEL + '">' + (isJob ? 'Salary' : 'Asking price') + '</span>' +
    '<div class="font-price-primary text-headline-md font-extrabold text-primary mt-1 mb-4">' + esc(priceStr) + '</div>' +
    '<div class="flex flex-col gap-2">' +
    '<a href="' + esc(waHref) + '" target="_blank" rel="noopener" class="' + BTN_PRIMARY + '">' + icon('chat') + 'Chat on WhatsApp</a>' +
    (phone ? '<a href="tel:' + esc(phone) + '" class="' + BTN_SECONDARY + '">' + icon('call') + 'Call seller</a>' : '') +
    '</div><div class="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant text-label-sm font-label-sm">' +
    '<button type="button" id="shareBtn" class="flex items-center gap-1 text-on-surface-variant hover:text-primary">' + icon('share', 16) + 'Share</button>' +
    '<a href="detail?id=' + esc(l.id) + '" class="flex items-center gap-1 text-on-surface-variant hover:text-primary">' + icon('favorite', 16) + 'Save</a>' +
    '<a href="safety.html" class="flex items-center gap-1 text-on-surface-variant hover:text-error">' + icon('flag', 16) + 'Report</a></div></section>';
  // data-* location is read back by tools/generate-landing-pages.js.
  const main = '<div id="detailContent" class="max-w-7xl mx-auto px-margin md:px-margin-desktop" data-suburb="' + esc(l.suburb || '') + '" data-city="' + esc(l.city || '') + '" data-province="' + esc(l.province || '') + '">' +
    '<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-space-base mb-space-base"><div class="flex-1 min-w-0">' +
    '<div class="flex flex-wrap items-center gap-2 mb-2">' + badges + '</div>' +
    '<h1 class="font-headline-lg text-headline-md md:text-headline-lg text-on-surface font-bold leading-tight break-words">' + esc(l.title) + '</h1>' +
    (sub ? '<p class="text-body-md text-on-surface-variant mt-1">' + sub + '</p>' : '') + '</div>' +
    '<div class="bg-surface-container-lowest rounded p-4 shadow-sm shrink-0 w-full lg:w-64"><span class="' + LABEL + '">' + (isJob ? 'Salary' : 'Asking price') + '</span><div class="font-price-primary text-headline-md font-extrabold text-primary mt-1">' + esc(priceStr) + '</div></div></div>' +
    '<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-base"><div class="lg:col-span-8 flex flex-col gap-space-base min-w-0">' +
    g.html + specsHtml(l.category, attrs, l.condition) +
    '<section class="' + CARD + '">' + h2('description', 'Description') + '<p class="text-body-md text-on-surface leading-relaxed whitespace-pre-line break-words">' + esc(l.description || 'No description provided.') + '</p></section>' +
    '<section class="' + CARD + '">' + h2('location_on', 'Location') + '<p class="text-body-md text-on-surface-variant">' + esc([l.suburb, l.city, l.province].filter(Boolean).join(', ') || 'Zimbabwe') + '</p><p class="text-label-sm text-on-surface-variant mt-2">Agree on an exact meeting point with the seller before you travel.</p></section>' +
    (reviews.length ? '<section class="' + CARD + '">' + h2('star', 'Seller Reviews') + reviewsHtml(reviews, 'this seller') + '</section>' : '') +
    SAFETY_BAND + '</div>' +
    '<aside class="lg:col-span-4 flex flex-col gap-space-base lg:sticky lg:top-[164px] self-start w-full">' + contactCard + sellerCard + '</aside></div>' +
    '<section id="recentSec" class="hidden mt-space-xl"><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface mb-space-base">Recently Viewed</h2><div id="recentGrid" class="grid grid-cols-2 lg:grid-cols-4 gap-space-md"></div></section>' +
    '</div>' +
    '<div id="unavailableState" style="display:none" class="max-w-xl mx-auto px-margin py-space-2xl text-center"><h1 class="font-headline-md text-headline-md font-bold text-on-surface">This listing is no longer available</h1><p class="text-on-surface-variant mt-2">It may have been sold or is being reviewed.</p><a href="browse" class="inline-block mt-4 bg-primary text-on-primary px-5 py-2.5 rounded font-bold">Browse other listings</a></div>';
  return shell({
    url: url, pageTitle: l.title + ' — ' + priceStr + ' | PaMarket Zimbabwe',
    desc: l.description ? String(l.description).slice(0, 155) : (l.title + ' — ' + catLabel + ' in ' + loc + ' on PaMarket, Zimbabwe.'),
    ogImg: photos[0] || (SITE + '/img/icon-512.png'), ogType: isJob ? 'website' : 'product',
    schema: [PMSchema.buildListingSchema(l, url, reviews), PMSchema.buildBreadcrumb(l, url)],
    crumb: crumbHtml([{ label: 'Home', href: 'index.html' }, { label: 'Browse', href: 'browse' }, { label: catLabel, href: 'browse?cat=' + esc(l.category) }, { label: l.title }]),
    main: main, viewer: g.viewer, hydrateListingId: l.id, chrome: chrome,
    extrasMeta: { id: l.id, title: l.title, price: l.price, currency: l.currency, photo: photos[0] || null, city: l.city, province: l.province, url: url },
    afterScripts: g.script
  });
}

function renderRental(v, chrome) {
  // See renderListing: this static page is the canonical, and
  // rental-detail.html's canonical points here too.
  const url = PMSchema.rentalUrl(v);
  const title = PMSchema.rentalTitle(v);
  const media = (v.rental_vehicle_media || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
  const photos = media.map(function (m) { return m.url; }).filter(Boolean);
  const loc = [v.pickup_suburb, v.rental_locations && v.rental_locations.city].filter(Boolean).join(', ') || 'Zimbabwe';
  const catLabel = (v.rental_categories && v.rental_categories.label) || '';
  const company = v.rental_companies || {};
  const priceStr = v.daily_rate ? ('$' + Number(v.daily_rate).toLocaleString() + '/day') : 'Price on application';
  const rates = [];
  if (v.weekly_rate) rates.push({ label: 'Weekly', value: '$' + Number(v.weekly_rate).toLocaleString() });
  if (v.monthly_rate) rates.push({ label: 'Monthly', value: '$' + Number(v.monthly_rate).toLocaleString() });
  if (v.deposit) rates.push({ label: 'Deposit', value: '$' + Number(v.deposit).toLocaleString() });
  if (v.min_rental_days) rates.push({ label: 'Minimum', value: v.min_rental_days + ' day' + (v.min_rental_days === 1 ? '' : 's') });
  const features = (v.rental_vehicle_features || []).map(function (f) { return f.feature; }).filter(Boolean);
  const phone = company.rental_whatsapp || company.rental_phone;
  const companyName = company.trading_name || 'Rental Company';
  const g = gallery(photos, title);
  const infoChips = [];
  if (company.year_established) infoChips.push('Est. ' + company.year_established);
  if (company.driver_available) infoChips.push('Driver available');
  if (company.cross_border) infoChips.push('Cross-border allowed');
  if (company.insurance_included) infoChips.push('Insurance included');
  if (company.deposit_policy) infoChips.push(company.deposit_policy);
  const chip = function (t) { return '<span class="bg-surface-container-low text-on-surface text-label-sm font-semibold px-2.5 py-1 rounded-full">' + esc(t) + '</span>'; };
  const actions = (company.business_id ? '<a href="chats?biz=' + esc(company.business_id) + '" class="' + BTN_PRIMARY + '">' + icon('forum') + 'Message via PaMarket</a>' : '') +
    (phone ? '<a href="https://wa.me/' + esc(String(phone).replace(/[^\d]/g, '')) + '?text=' + encodeURIComponent('Hi, I saw your ' + title + ' rental on PaMarket. Is it available?') + '" target="_blank" rel="noopener" class="' + (company.business_id ? BTN_SECONDARY : BTN_PRIMARY) + '">' + icon('chat') + 'Chat on WhatsApp</a>' : '') +
    (company.rental_email ? '<a href="mailto:' + esc(company.rental_email) + '" class="' + BTN_SECONDARY + '">' + icon('mail') + 'Email the company</a>' : '') +
    (company.business_id ? '<a href="business?id=' + esc(company.business_id) + '" class="' + BTN_SECONDARY + '">' + icon('storefront') + 'View company profile</a>' : '');
  const main = '<div id="detailContent" class="max-w-7xl mx-auto px-margin md:px-margin-desktop">' +
    '<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-space-base mb-space-base"><div class="flex-1 min-w-0">' +
    '<div class="flex flex-wrap items-center gap-2 mb-2">' + (catLabel ? '<span class="bg-surface-container text-on-surface-variant text-label-sm px-2.5 py-1 rounded">' + esc(catLabel) + '</span>' : '') +
    '<span class="text-label-sm font-bold px-2.5 py-1 rounded ' + (v.is_available ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-error-container text-on-error-container') + '">' + (v.is_available ? 'Taking rental requests' : 'Not taking new requests') + '</span>' +
    '<span class="text-label-sm text-on-surface-variant flex items-center gap-1">' + icon('location_on', 14) + esc(loc) + '</span></div>' +
    '<h1 class="font-headline-lg text-headline-md md:text-headline-lg text-on-surface font-bold leading-tight">' + esc(title) + '</h1></div>' +
    '<div class="bg-surface-container-lowest rounded p-4 shadow-sm shrink-0 w-full lg:w-64"><span class="' + LABEL + '">Daily rate</span><div class="font-price-primary text-headline-md font-extrabold text-primary mt-1">' + esc(priceStr) + '</div></div></div>' +
    '<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-base"><div class="lg:col-span-8 flex flex-col gap-space-base min-w-0">' + g.html +
    (rates.length ? '<section class="' + CARD + '">' + h2('payments', 'Rates &amp; terms') + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">' + rates.map(function (r) { return '<div class="bg-surface-container-low rounded p-3"><span class="text-label-sm text-on-surface-variant block">' + r.label + '</span><span class="text-body-lg text-on-surface font-bold">' + esc(r.value) + '</span></div>'; }).join('') + '</div></section>' : '') +
    '<section class="' + CARD + '">' + h2('description', 'Description') + '<p class="text-body-md text-on-surface leading-relaxed whitespace-pre-line">' + esc(v.description || 'No description provided.') + '</p></section>' +
    (features.length ? '<section class="' + CARD + '">' + h2('check_circle', 'Features') + '<div class="flex flex-wrap gap-2">' + features.map(chip).join('') + '</div></section>' : '') +
    SAFETY_BAND + '</div>' +
    '<aside class="lg:col-span-4 flex flex-col gap-space-base lg:sticky lg:top-[164px] self-start w-full"><section class="' + CARD + '"><div class="flex items-center gap-3">' + avatar(initialsOf(companyName)) +
    '<div class="min-w-0"><div class="font-bold text-on-surface text-body-lg">' + esc(companyName) + '</div>' +
    ((company.review_count > 0 && company.avg_rating) ? '<div class="text-body-sm text-on-surface-variant"><span class="text-[#f59e0b]">' + stars(company.avg_rating) + '</span> ' + Number(company.avg_rating).toFixed(1) + ' &middot; ' + company.review_count + ' review' + (company.review_count > 1 ? 's' : '') + '</div>' : '<div class="text-body-sm text-on-surface-variant">Rental partner on PaMarket</div>') +
    '</div></div>' + (infoChips.length ? '<div class="flex flex-wrap gap-2 mt-3">' + infoChips.map(chip).join('') + '</div>' : '') +
    '<div class="flex flex-col gap-2 mt-4">' + actions + '</div></section></aside></div></div>';
  return shell({
    url: url, pageTitle: title + ' Rental — PaMarket Zimbabwe',
    desc: 'Rent a ' + title + ' in Zimbabwe' + (v.daily_rate ? ' from $' + Number(v.daily_rate).toLocaleString() + '/day' : '') + '. Book directly with a verified rental company on PaMarket.',
    ogImg: photos[0] || (SITE + '/img/icon-512.png'), ogType: 'product',
    schema: [PMSchema.buildRentalSchema(v, url), PMSchema.buildRentalBreadcrumb(v, url)],
    crumb: crumbHtml([{ label: 'Home', href: 'index.html' }, { label: 'Car Rental', href: 'rentals' }, { label: title }]),
    main: main, viewer: g.viewer, chrome: chrome, afterScripts: g.script
  });
}

const BIZ_TYPE_LABEL = { individual: 'Individual Seller', company: 'Registered Company', agency: 'Agency' };
const CAT_LABEL = { property: 'Property', vehicles: 'Vehicles', electronics: 'Electronics', furniture: 'Furniture', fashion: 'Fashion', services: 'Services', agriculture: 'Agriculture', rooms: 'Rooms', pets: 'Pets', kids: 'Baby & Kids', jobs: 'Jobs', other: 'Other' };

function productCard(l) {
  const photo = l.photos && l.photos.length ? l.photos[0] : null;
  const loc = [l.suburb, l.city].filter(Boolean).join(', ') || l.province || 'Zimbabwe';
  return '<a href="' + PMSchema.listingPath(l) + '" class="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">' +
    '<div class="aspect-[4/3] overflow-hidden bg-surface-container">' +
    (photo ? '<img src="' + esc(photo) + '" alt="' + esc(l.title) + '" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform">'
      : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant">' + icon('image', 36) + '</div>') +
    '</div><div class="p-3"><div class="font-bold text-primary">' + esc(money(l.price, l.currency)) + '</div>' +
    '<div class="font-semibold text-on-surface truncate">' + esc(l.title) + '</div>' +
    '<div class="text-label-sm text-on-surface-variant truncate">' + esc(loc) + '</div></div></a>';
}

function renderBusiness(b, chrome) {
  // See renderListing: this static page is the canonical, and
  // business.html's canonical points here too.
  const url = PMSchema.businessUrl(b);
  const products = b._products || [];
  const reviews = b._reviews || [];
  const verified = (b.verification_level || 0) >= 2;
  const loc = [b.suburb, b.city, b.province].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') || 'Zimbabwe';
  const avg = avgRating(reviews);
  const year = b.created_at ? new Date(b.created_at).getFullYear() : '';
  const cats = (b.category || '').split('|').filter(Boolean);
  // The mobile Create/Manage Shop flow only writes businesses.photos, never
  // .cover/.logo, so fall back to the first photo.
  const photos = Array.isArray(b.photos) ? b.photos.filter(Boolean) : [];
  const coverSrc = b.cover || photos[0] || '';
  const logoImg = b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name) + ' logo" class="w-full h-full object-cover">' : '';
  const wa = b.whatsapp || b.phone;
  const actions = '<a href="chats?biz=' + esc(b.id) + '" class="' + BTN_PRIMARY + '">' + icon('forum') + 'Message business</a>' +
    (wa ? '<a href="https://wa.me/' + esc(String(wa).replace(/[^0-9]/g, '')) + '" target="_blank" rel="noopener" class="' + BTN_SECONDARY + '">' + icon('chat') + 'WhatsApp</a>' : '') +
    (b.phone ? '<a href="tel:' + esc(b.phone) + '" class="' + BTN_SECONDARY + '">' + icon('call') + 'Call</a>' : '') +
    (b.email ? '<a href="mailto:' + esc(b.email) + '" class="' + BTN_SECONDARY + '">' + icon('mail') + 'Email</a>' : '');
  const stats = [];
  if (reviews.length) stats.push({ n: avg.toFixed(1) + ' &#9733;', l: reviews.length + ' review' + (reviews.length > 1 ? 's' : '') });
  stats.push({ n: String(products.length), l: 'Listings' });
  if (year) stats.push({ n: String(year), l: 'On PaMarket since' });
  const main = '<div id="detailContent" class="max-w-7xl mx-auto px-margin md:px-margin-desktop flex flex-col gap-space-base">' +
    '<section class="bg-surface-container-lowest rounded overflow-hidden shadow-sm">' +
    '<div class="h-40 md:h-64 bg-gradient-to-br from-primary to-primary-container">' + (coverSrc ? '<img src="' + esc(coverSrc) + '" alt="' + esc(b.name) + ' cover" class="w-full h-full object-cover">' : '') + '</div>' +
    '<div class="p-5 md:p-6"><div class="flex items-end gap-4 -mt-14 md:-mt-16">' +
    '<div class="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-primary-fixed text-on-primary-fixed border-4 border-surface-container-lowest flex items-center justify-center font-bold text-headline-sm overflow-hidden shrink-0">' + (logoImg || initialsOf(b.name)) + '</div></div>' +
    '<div class="mt-3 flex flex-wrap items-center gap-2"><h1 class="font-headline-lg text-headline-md md:text-headline-lg text-on-surface font-bold">' + esc(b.name) + '</h1>' +
    (verified ? '<span class="bg-primary-fixed text-on-primary-fixed text-label-sm font-bold px-2.5 py-1 rounded-full flex items-center gap-1">' + icon('verified', 14) + 'Verified</span>' : '') + '</div>' +
    '<div class="mt-1 flex flex-wrap gap-3 text-body-sm text-on-surface-variant"><span class="flex items-center gap-1">' + icon('storefront', 16) + esc(BIZ_TYPE_LABEL[b.biz_type] || 'Seller') + '</span><span class="flex items-center gap-1">' + icon('location_on', 16) + esc(loc) + '</span></div>' +
    '<div class="mt-4 grid grid-cols-3 gap-2.5 max-w-md">' + stats.map(function (s) { return '<div class="bg-surface-container-low rounded p-3 text-center"><div class="font-bold text-on-surface text-body-lg">' + s.n + '</div><div class="text-label-sm text-on-surface-variant">' + s.l + '</div></div>'; }).join('') + '</div>' +
    '<div class="mt-4 grid grid-cols-2 sm:flex gap-2">' + actions + '</div></div></section>' +
    (b.description ? '<section class="' + CARD + '">' + h2('info', 'About') + '<p class="text-body-md text-on-surface leading-relaxed whitespace-pre-line">' + esc(b.description) + '</p>' +
      (cats.length ? '<div class="flex flex-wrap gap-2 mt-3">' + cats.map(function (c) { return '<span class="bg-surface-container-low text-on-surface text-label-sm font-semibold px-2.5 py-1 rounded-full">' + esc(CAT_LABEL[c] || c) + '</span>'; }).join('') + '</div>' : '') + '</section>' : '') +
    (photos.length ? '<section class="' + CARD + '">' + h2('photo_library', 'Shop Photos') + '<div class="grid grid-cols-2 md:grid-cols-4 gap-2">' + photos.map(function (p, i) { return '<img src="' + esc(p) + '" alt="' + esc(b.name) + ' photo ' + (i + 1) + '" loading="lazy" decoding="async" class="w-full aspect-square object-cover rounded">'; }).join('') + '</div></section>' : '') +
    '<section class="' + CARD + '">' + h2('sell', 'Listings') +
    (products.length ? '<div class="grid grid-cols-2 lg:grid-cols-4 gap-space-md">' + products.slice(0, 12).map(productCard).join('') + '</div>' : '<p class="text-on-surface-variant">No live listings yet. Check back soon.</p>') + '</section>' +
    '<section class="' + CARD + '">' + h2('star', 'Reviews &amp; Ratings') + (reviews.length ? reviewsHtml(reviews) : '<p class="text-on-surface-variant">This shop has no reviews yet.</p>') + '</section>' +
    '</div>';
  const desc = b.description ? String(b.description).slice(0, 155) : (b.name + ' — a verified business storefront on PaMarket, Zimbabwe.');
  return shell({
    url: url, pageTitle: b.name + ' — Verified Shop on PaMarket Zimbabwe', desc: desc,
    ogImg: b.cover || photos[0] || b.logo || (SITE + '/img/icon-512.png'), ogType: 'website',
    schema: PMSchema.buildBusinessSchema(b, url, reviews, products),
    crumb: crumbHtml([{ label: 'Home', href: 'index.html' }, { label: 'Businesses', href: 'businesses' }, { label: b.name }]),
    main: main, chrome: chrome
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
