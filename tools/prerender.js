// Pre-renders static, crawlable HTML pages so non-JS crawlers (Google, GPTBot,
// ClaudeBot, PerplexityBot) get real content + baked JSON-LD instead of the
// client-rendered shells at /detail?id=, /rental-detail?id= and /business?id=.
//
// Output:  l/<slug>-<id>.html  (listings + jobs — Product/JobPosting/Vehicle)
//          r/<slug>-<id>.html  (rental vehicles — Vehicle)
//          b/<slug>-<id>.html  (business shops — Store + ProfilePage)
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
  const select = 'id,title,description,price,currency,category,province,city,suburb,photos,seller_id,seller_name,seller_phone,business_id,attributes,condition,views,created_at';
  const rows = []; let offset = 0;
  for (;;) {
    const page = await pget(cfg, 'listings?status=eq.active&order=created_at.desc&select=' + select + '&limit=1000&offset=' + offset);
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000; if (LIMIT && rows.length >= LIMIT) break;
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

async function fetchActiveRentals(cfg) {
  const select = '*,rental_brands(label),rental_categories(label),rental_locations(city,province),' +
    'rental_vehicle_media(url,is_cover,sort_order),rental_vehicle_features(feature),' +
    'rental_companies(trading_name,rental_phone,rental_whatsapp)';
  const rows = await pget(cfg, 'rental_vehicle_listings?status=eq.active&admin_status=eq.approved&deleted_at=is.null&order=created_at.desc&select=' + encodeURIComponent(select) + '&limit=1000');
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

async function fetchActiveBusinesses(cfg) {
  const businesses = await pget(cfg, 'businesses?status=eq.active&order=updated_at.desc&select=*&limit=1000');
  const list = LIMIT ? businesses.slice(0, LIMIT) : businesses;
  for (const b of list) {
    let products = await pget(cfg, 'listings?business_id=eq.' + encodeURIComponent(b.id) + '&status=eq.active&select=id,title,price,currency,category&limit=20');
    if ((!products || !products.length) && b.owner_user_id) {
      products = await pget(cfg, 'listings?seller_id=eq.' + encodeURIComponent(b.owner_user_id) + '&status=eq.active&select=id,title,price,currency,category&limit=20');
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

function loadChrome() {
  const detail = fs.readFileSync(path.join(ROOT, 'detail.html'), 'utf8');
  const styleMatch = detail.match(/<style>([\s\S]*?)<\/style>/);
  return {
    style: styleMatch ? styleMatch[1] : '',
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
    '<link rel="stylesheet" href="css/site.css">\n<style>' + o.chrome.style + '</style>\n' +
    blocks + '\n</head>\n<body>\n' + o.chrome.header + '\n' + o.crumb + '\n' + o.main + '\n' + o.chrome.footer + '\n' +
    hyd +
    '<script src="js/supabase-config.js"></script>\n<script src="js/marketplace-data.js"></script>\n<script src="js/nav-dropdowns.js"></script>\n' +
    (o.extrasMeta ? '<script src="js/listing-extras.js"></script>\n<script>window.PMListingExtras&&PMListingExtras.init(' + jsonld(o.extrasMeta) + ');</script>\n' : '') +
    '</body>\n</html>\n';
}

function renderListing(l, chrome) {
  const url = PMSchema.listingUrl(l);
  const catLabel = PMSchema.catLabelOf(l);
  const loc = PMSchema.locOf(l);
  const photos = (l.photos && l.photos.length) ? l.photos : [];
  const isJob = l.category === 'jobs';
  const priceStr = isJob ? (l.price ? money(l.price, l.currency) + '/mo' : 'Salary negotiable') : money(l.price, l.currency);
  const title = esc(l.title);
  const mainImg = photos.length ? '<img src="' + esc(photos[0]) + '" alt="' + title + '">' : '<div class="gallery-main-ph">' + title + '</div>';
  const thumbs = photos.length > 1 ? '<div class="gallery-thumbs">' + photos.map(function (p, i) { return '<div class="gallery-thumb' + (i === 0 ? ' on' : '') + '"><img src="' + esc(p) + '" alt="" loading="lazy"></div>'; }).join('') + '</div>' : '';
  const profileUrl = l.seller_id ? ('profile?id=' + esc(l.seller_id)) : null;
  const phone = l.seller_phone ? String(l.seller_phone).replace(/[^\d+]/g, '') : '';
  const waHref = phone ? ('https://wa.me/' + phone.replace('+', '') + '?text=' + encodeURIComponent('Hi, I saw your listing "' + l.title + '" on PaMarket. Is it still available?')) : '';
  const waBtn = waHref ? '<a class="btn btn-whatsapp contact-btn" href="' + esc(waHref) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' : '';
  const profileBtn = profileUrl ? '<a class="btn btn-navy contact-btn" href="' + profileUrl + '">View Full Profile</a>' : '';
  const shareBtn = '<button type="button" class="btn contact-btn" id="shareBtn" style="background:#fff;border:1.5px solid var(--line);color:var(--ink)">' +
    '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Listing</button>';
  const initials = esc((l.seller_name || 'Seller').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase());
  const crumb = '<div class="crumb"><a href="/">Home</a> / <a href="browse">Browse</a> / <a href="browse?cat=' + esc(l.category) + '">' + esc(catLabel) + '</a> / <span>' + title + '</span></div>';
  const main = '<div id="detailContent"><div class="detail-wrap"><div>' +
    '<div class="gallery"><div class="gallery-main" id="galleryMain">' + mainImg + '</div>' + thumbs + '</div>' +
    '<h1 class="d-title">' + title + '</h1><div class="d-price">' + esc(priceStr) + '</div>' +
    '<div class="d-meta"><span>' + esc(loc) + '</span><span>Posted ' + esc(timeAgo(l.created_at)) + '</span>' +
    '<span style="background:#EEF2FF;color:var(--navy);padding:3px 10px;border-radius:20px;font-weight:700">' + esc(catLabel) + '</span></div>' +
    '<div class="d-section"><h3>Description</h3><div class="d-desc">' + esc(l.description || 'No description provided.') + '</div></div>' +
    '</div><div class="sidebar"><div class="seller-card">' +
    '<div class="seller-top"><div class="seller-avatar">' + initials + '</div><div><div class="seller-name">' + esc(l.seller_name || 'PaMarket Seller') + '</div><div class="seller-sub">View profile →</div></div></div>' + waBtn + profileBtn + shareBtn + '</div>' +
    '<div class="safety-card"><h4>Stay Safe</h4><ul><li>Meet in a public place during daylight hours</li><li>Never pay before seeing the item in person</li><li>Keep all conversations and payments inside PaMarket</li></ul></div>' +
    '</div></div>' +
    '<div class="similar-sec hidden" id="recentSec" style="padding-top:28px"><h2>Recently <span style="color:var(--navy)">Viewed</span></h2><div class="similar-grid" id="recentGrid"></div></div>' +
    '</div>' +
    '<div id="unavailableState" class="state-msg" style="display:none">This listing is no longer available or is being reviewed.<br><br><a href="browse">Browse other listings</a></div>';
  return shell({
    url: url, pageTitle: l.title + ' — ' + priceStr + ' | PaMarket Zimbabwe',
    desc: l.description ? String(l.description).slice(0, 155) : (l.title + ' — ' + catLabel + ' in ' + loc + ' on PaMarket, Zimbabwe.'),
    ogImg: photos[0] || (SITE + '/img/icon-512.png'), ogType: isJob ? 'website' : 'product',
    schema: [PMSchema.buildListingSchema(l), PMSchema.buildBreadcrumb(l, url)],
    crumb: crumb, main: main, hydrateListingId: l.id, chrome: chrome,
    extrasMeta: { id: l.id, title: l.title, price: l.price, currency: l.currency, photo: photos[0] || null, city: l.city, province: l.province, url: url }
  });
}

function renderRental(v, chrome) {
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
    '<div class="seller-name">' + esc(company.trading_name || 'Rental Company') + '</div><div class="seller-sub">Verified rental partner</div>' + waBtn + '</div>' +
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

function renderBusiness(b, chrome) {
  const url = PMSchema.businessUrl(b);
  const products = b._products || [];
  const reviews = b._reviews || [];
  const logo = b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name) + ' logo" style="width:88px;height:88px;border-radius:18px;object-fit:cover">' : '<div class="biz-logo">' + esc((b.name || 'S')[0].toUpperCase()) + '</div>';
  const loc = [b.suburb, b.city, b.province].filter(Boolean).join(', ') || 'Zimbabwe';
  const prodCards = products.length ? products.slice(0, 12).map(function (l) {
    return '<a class="gcard" href="' + PMSchema.listingPath(l) + '" style="display:block;border:1px solid var(--line);border-radius:12px;padding:12px;color:inherit"><div style="font-weight:700;font-size:14px">' + esc(l.title) + '</div><div style="color:var(--navy);font-weight:800;margin-top:4px">' + esc(money(l.price, l.currency)) + '</div></a>';
  }).join('') : '<div style="color:var(--mute)">No products listed yet.</div>';
  const revHtml = reviews.length ? '<div class="biz-section"><h2>Reviews</h2>' + reviews.slice(0, 8).map(function (r) {
    return '<div class="rev"><div class="rev-top"><div class="rev-who">' + esc(r.reviewer_name || 'PaMarket user') + '</div><div class="rev-stars">' + '★'.repeat(Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)))) + '</div></div><div class="rev-body">' + esc(r.body || '') + '</div></div>';
  }).join('') + '</div>' : '';
  const desc = b.description ? String(b.description).slice(0, 155) : (b.name + ' — a verified business storefront on PaMarket, Zimbabwe.');
  const crumb = '<div class="crumb"><a href="/">Home</a> / <a href="browse?shops=1">Shops</a> / <span>' + esc(b.name) + '</span></div>';
  const main = '<div class="biz-body" style="max-width:1000px;margin:0 auto;padding:24px">' +
    '<div style="display:flex;gap:18px;align-items:center">' + logo + '<div><h1 class="biz-name" style="font-size:26px;font-weight:900">' + esc(b.name) + (b.verified ? ' <span class="biz-verified">✓ Verified</span>' : '') + '</h1><div class="biz-meta"><span>' + esc(loc) + '</span></div></div></div>' +
    (b.description ? '<div class="biz-section"><h2>About</h2><div class="biz-about"><p>' + esc(b.description) + '</p></div></div>' : '') +
    '<div class="biz-section"><h2>Products</h2><div class="prod-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-top:12px">' + prodCards + '</div></div>' +
    revHtml + '</div>';
  return shell({
    url: url, pageTitle: b.name + ' — Verified Shop on PaMarket Zimbabwe', desc: desc,
    ogImg: b.cover || b.logo || (SITE + '/img/icon-512.png'), ogType: 'website',
    schema: PMSchema.buildBusinessSchema(b, url, reviews, products),
    crumb: crumb, main: main, chrome: chrome
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
  let listings, rentals, businesses, chrome = loadChrome();
  if (process.env.PRERENDER_FIXTURE) {
    const fx = JSON.parse(fs.readFileSync(process.env.PRERENDER_FIXTURE, 'utf8'));
    listings = fx.listings || []; rentals = fx.rentals || []; businesses = fx.businesses || [];
  } else {
    const cfg = loadSupabaseConfig();
    listings = await fetchActiveListings(cfg);
    rentals = await fetchActiveRentals(cfg);
    businesses = await fetchActiveBusinesses(cfg);
  }
  writeAll('l', listings, renderListing, chrome, function (l) { return PMSchema.listingPath(l); });
  writeAll('r', rentals, renderRental, chrome, function (v) { return PMSchema.rentalPath(v); });
  writeAll('b', businesses, renderBusiness, chrome, function (b) { return PMSchema.businessPath(b); });
}

main().catch(function (e) { console.error('prerender failed:', e); process.exit(1); });
